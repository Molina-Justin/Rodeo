"""One leased worker for transcription and post-commit recording deletion."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from threading import Event, Thread
from uuid import uuid4

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from rodeo.config import Settings
from rodeo.db import session_factory_for_url
from rodeo.models import Job, JobStatus, Recording, Transcription
from rodeo.models.enums import TranscriptionStatus
from rodeo.services.attempts import DELETE_RECORDING_JOB_KIND
from rodeo.services.recordings import recording_path
from rodeo.services.transcriptions import TRANSCRIBE_JOB_KIND

logger = logging.getLogger(__name__)


def utc_now() -> datetime:
    return datetime.now(UTC)


class DurableWorker:
    """Claims one database job at a time with a renewable-on-restart lease."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.worker_id = f"rodeo-{uuid4()}"
        self.stop_event = Event()
        self.thread = Thread(target=self._run, name="rodeo-worker", daemon=True)
        self._factory = session_factory_for_url(
            settings.resolved_database_url,
            settings.sqlite_busy_timeout_ms,
        )

    def start(self) -> None:
        self.thread.start()

    def stop(self) -> None:
        self.stop_event.set()
        self.thread.join(timeout=max(5, self.settings.worker_lease_seconds))

    def _run(self) -> None:
        self._reclaim_expired()
        while not self.stop_event.is_set():
            try:
                if not self._process_one():
                    self.stop_event.wait(self.settings.worker_poll_interval_seconds)
            except Exception:  # Never let a malformed job kill the worker.
                logger.exception("Durable worker loop failed")
                self.stop_event.wait(self.settings.worker_poll_interval_seconds)

    def _reclaim_expired(self) -> None:
        now = utc_now()
        with self._factory.begin() as database:
            for job in database.scalars(
                select(Job).where(
                    Job.status == JobStatus.PROCESSING,
                    Job.lease_expires_at.is_not(None),
                    Job.lease_expires_at < now,
                )
            ):
                job.status = JobStatus.QUEUED
                job.locked_by = None
                job.lease_expires_at = None

    def _claim(self, database: Session) -> Job | None:
        now = utc_now()
        job = database.scalar(
            select(Job)
            .where(
                Job.available_at <= now,
                or_(
                    Job.status == JobStatus.QUEUED,
                    (Job.status == JobStatus.PROCESSING)
                    & (Job.lease_expires_at.is_not(None))
                    & (Job.lease_expires_at < now),
                ),
            )
            .order_by(Job.available_at, Job.created_at)
            .limit(1)
        )
        if job is None:
            return None
        job.status = JobStatus.PROCESSING
        job.locked_by = self.worker_id
        job.lease_expires_at = now + timedelta(seconds=self.settings.worker_lease_seconds)
        job.attempts += 1
        return job

    def _process_one(self) -> bool:
        with self._factory.begin() as database:
            job = self._claim(database)
            if job is None:
                return False
            job_id = job.id

        with self._factory() as database:
            job = database.get(Job, job_id)
            if job is None or job.locked_by != self.worker_id:
                return True
            if job.kind == TRANSCRIBE_JOB_KIND:
                transcription_id = job.payload.get("transcription_id")
                if isinstance(transcription_id, str):
                    transcription = database.get(Transcription, transcription_id)
                    if transcription is not None:
                        transcription.status = TranscriptionStatus.PROCESSING
                        transcription.started_at = utc_now()
                        database.commit()
            try:
                if job.kind == TRANSCRIBE_JOB_KIND:
                    self._transcribe(database, job)
                elif job.kind == DELETE_RECORDING_JOB_KIND:
                    self._delete_recording_file(job)
                else:
                    raise ValueError(f"unsupported job kind {job.kind!r}")
            except Exception as error:
                self._fail(database, job, error)
            else:
                job.status = JobStatus.COMPLETED
                job.completed_at = utc_now()
                job.lease_expires_at = None
                job.locked_by = None
            database.commit()
        return True

    def _delete_recording_file(self, job: Job) -> None:
        storage_key = job.payload.get("storage_key")
        if not isinstance(storage_key, str):
            raise ValueError("delete job is missing a storage key")
        recording_path(self.settings, storage_key).unlink(missing_ok=True)

    def _transcribe(self, database: Session, job: Job) -> None:
        transcription_id = job.payload.get("transcription_id")
        if not isinstance(transcription_id, str):
            raise ValueError("transcription job is missing a transcription id")
        transcription = database.get(Transcription, transcription_id)
        if transcription is None:
            return
        recording = database.get(Recording, transcription.recording_id)
        if recording is None:
            raise ValueError("transcription recording no longer exists")
        model_path = self.settings.installed_transcription_model_path()
        if not self.settings.transcription_enabled or model_path is None:
            raise RuntimeError("configured transcription model is unavailable")

        # Explicitly opening through PyAV validates the WebM/Opus decode path
        # before faster-whisper invokes its FFmpeg-backed decoder.
        import av
        from faster_whisper import WhisperModel

        path = recording_path(self.settings, recording.storage_key)
        with av.open(path):
            model = WhisperModel(str(model_path), local_files_only=True)
            segments, info = model.transcribe(str(path))
            stored_segments = [
                {
                    "start_seconds": float(segment.start),
                    "end_seconds": float(segment.end),
                    "text": segment.text.strip(),
                }
                for segment in segments
            ]
        transcription.status = TranscriptionStatus.COMPLETED
        transcription.raw_text = " ".join(
            segment["text"] for segment in stored_segments if segment["text"]
        ).strip()
        transcription.segments = stored_segments
        transcription.language = info.language
        transcription.model = self.settings.transcription_model
        transcription.error_code = None
        transcription.error_message = None
        transcription.completed_at = utc_now()

    def _fail(self, database: Session, job: Job, error: Exception) -> None:
        logger.warning("Durable job %s failed: %s", job.id, error)
        if job.kind == TRANSCRIBE_JOB_KIND:
            transcription_id = job.payload.get("transcription_id")
            if isinstance(transcription_id, str):
                transcription = database.get(Transcription, transcription_id)
                if transcription is not None:
                    transcription.status = TranscriptionStatus.FAILED
                    transcription.error_code = "transcription_failed"
                    transcription.error_message = str(error)
                    transcription.completed_at = utc_now()
        job.status = JobStatus.FAILED
        job.error_code = "job_failed"
        job.error_message = str(error)
        job.completed_at = utc_now()
        job.lease_expires_at = None
        job.locked_by = None
