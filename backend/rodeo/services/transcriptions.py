"""Transcription request state; the worker performs the expensive work."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from rodeo.models import Attempt, Job, JobStatus, Recording, Transcription
from rodeo.models.enums import TranscriptionStatus
from rodeo.models.json_types import JSONValue
from rodeo.schemas.transcriptions import (
    TranscriptionCorrection,
    TranscriptionResponse,
    TranscriptionSegment,
)
from rodeo.services.attempts import recompute_problem_review_state

TRANSCRIBE_JOB_KIND = "transcribe-recording"


class TranscriptionError(RuntimeError):
    pass


class TranscriptionNotFoundError(TranscriptionError):
    pass


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _segment_number(value: JSONValue, field: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TranscriptionError(f"transcription segment {field} must be numeric")
    return float(value)


def to_response(transcription: Transcription) -> TranscriptionResponse:
    return TranscriptionResponse(
        id=transcription.id,
        recording_id=transcription.recording_id,
        status=transcription.status,
        raw_text=transcription.raw_text,
        corrected_text=transcription.corrected_text,
        segments=tuple(
            TranscriptionSegment(
                start_seconds=_segment_number(
                    segment["start_seconds"], "start_seconds"
                ),
                end_seconds=_segment_number(segment["end_seconds"], "end_seconds"),
                text=str(segment["text"]),
            )
            for segment in transcription.segments
        ),
        language=transcription.language,
        model=transcription.model,
        retry_count=transcription.retry_count,
        error_code=transcription.error_code,
        error_message=transcription.error_message,
        started_at=(
            _aware(transcription.started_at)
            if transcription.started_at is not None
            else None
        ),
        completed_at=(
            _aware(transcription.completed_at)
            if transcription.completed_at is not None
            else None
        ),
        created_at=_aware(transcription.created_at),
        updated_at=_aware(transcription.updated_at),
    )


def _recording_for_attempt(database: Session, attempt_id: str) -> Recording:
    attempt = database.get(Attempt, attempt_id)
    if attempt is None:
        raise TranscriptionNotFoundError(f"attempt {attempt_id!r} was not found")
    recording = database.scalar(
        select(Recording).where(Recording.attempt_id == attempt_id)
    )
    if recording is None:
        raise TranscriptionNotFoundError("attempt has no recording")
    return recording


def request_transcription(
    database: Session,
    *,
    attempt_id: str,
    now: datetime,
) -> TranscriptionResponse:
    recording = _recording_for_attempt(database, attempt_id)
    transcription = database.scalar(
        select(Transcription).where(Transcription.recording_id == recording.id)
    )
    if transcription is None:
        transcription = Transcription(recording_id=recording.id)
        database.add(transcription)
        database.flush()
        database.add(
            Job(
                kind=TRANSCRIBE_JOB_KIND,
                status=JobStatus.QUEUED,
                payload={"transcription_id": transcription.id},
                available_at=_aware(now),
            )
        )
        database.flush()
    return to_response(transcription)


def get_transcription(database: Session, *, attempt_id: str) -> TranscriptionResponse:
    return to_response(
        database.scalar(
            select(Transcription)
            .join(Recording, Recording.id == Transcription.recording_id)
            .where(Recording.attempt_id == attempt_id)
        )
        or _raise_not_found(attempt_id)
    )


def _raise_not_found(attempt_id: str) -> Transcription:
    raise TranscriptionNotFoundError(f"attempt {attempt_id!r} has no transcription")


def correct_transcription(
    database: Session,
    *,
    attempt_id: str,
    payload: TranscriptionCorrection,
    now: datetime,
    timezone_name: str,
) -> TranscriptionResponse:
    transcription = _transcription_model_for_attempt(database, attempt_id)
    transcription.corrected_text = payload.corrected_text
    database.flush()
    attempt = database.get(Attempt, attempt_id)
    if attempt is None:
        raise TranscriptionNotFoundError(f"attempt {attempt_id!r} was not found")
    recompute_problem_review_state(
        database,
        problem_id=attempt.problem_id,
        now=now,
        timezone_name=timezone_name,
    )
    return to_response(transcription)


def retry_transcription(
    database: Session,
    *,
    attempt_id: str,
    now: datetime,
) -> TranscriptionResponse:
    transcription = _transcription_model_for_attempt(database, attempt_id)
    if transcription.status is TranscriptionStatus.PROCESSING:
        raise TranscriptionError("transcription is already processing")
    if transcription.status is TranscriptionStatus.COMPLETED:
        raise TranscriptionError("completed transcription cannot be retried")
    transcription.status = TranscriptionStatus.QUEUED
    transcription.error_code = None
    transcription.error_message = None
    transcription.started_at = None
    transcription.completed_at = None
    transcription.retry_count += 1
    database.add(
        Job(
            kind=TRANSCRIBE_JOB_KIND,
            status=JobStatus.QUEUED,
            payload={"transcription_id": transcription.id},
            available_at=_aware(now),
        )
    )
    database.flush()
    return to_response(transcription)


def _transcription_model_for_attempt(
    database: Session, attempt_id: str
) -> Transcription:
    transcription = database.scalar(
        select(Transcription)
        .join(Recording, Recording.id == Transcription.recording_id)
        .where(Recording.attempt_id == attempt_id)
    )
    if transcription is None:
        raise TranscriptionNotFoundError(f"attempt {attempt_id!r} has no transcription")
    return transcription
