"""Schedules the periodic database snapshot on a daemon thread."""

from __future__ import annotations

import logging
from contextlib import suppress
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Event, Lock, Thread

from rodeo.config import Settings
from rodeo.services.backups import latest_backup, run_backup

logger = logging.getLogger(__name__)

TICK_SECONDS = 60.0
RETRY_DELAY = timedelta(minutes=10)


class BackupScheduler:
    """Snapshots once per interval, counting from the newest backup on disk."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.interval = timedelta(hours=settings.backup_interval_hours)
        self.stop_event = Event()
        self.run_lock = Lock()
        self.state_lock = Lock()
        self.next_attempt_at: datetime | None = None
        self.thread = Thread(target=self._run, name="rodeo-backups", daemon=True)

    def start(self) -> None:
        if not self.settings.backup_enabled:
            logger.info("Database backups are disabled")
            return
        with self.state_lock:
            self.next_attempt_at = self.due_at(now=datetime.now(UTC))
        self.thread.start()

    def stop(self) -> None:
        self.stop_event.set()
        if self.thread.is_alive():
            self.thread.join(timeout=5)

    def due_at(self, *, now: datetime) -> datetime:
        """Restarts must not each cut a snapshot and prune a real daily one."""
        previous = latest_backup(self.settings)
        if previous is None:
            return now
        written_at = datetime.fromtimestamp(previous.stat().st_mtime, UTC)
        return written_at + self.interval

    def run_now(self, *, now: datetime | None = None) -> Path:
        """Create a user-requested snapshot and update scheduler status."""
        if not self.settings.backup_enabled:
            raise RuntimeError("Backups are disabled")
        target = self._attempt(now=now or datetime.now(UTC), scheduled=False)
        if target is None:
            raise RuntimeError("Backup did not run")
        return target

    def next_attempt(self) -> datetime | None:
        with self.state_lock:
            return self.next_attempt_at

    def _attempt(self, *, now: datetime, scheduled: bool) -> Path | None:
        with self.run_lock:
            with self.state_lock:
                if (
                    scheduled
                    and self.next_attempt_at is not None
                    and now < self.next_attempt_at
                ):
                    return None

            try:
                target = run_backup(self.settings, now=now)
                if target is None:
                    raise RuntimeError("Backups are disabled")
            except Exception:
                with self.state_lock:
                    self.next_attempt_at = now + RETRY_DELAY
                logger.exception(
                    "Database backup failed; retrying in %d minutes",
                    int(RETRY_DELAY.total_seconds() / 60),
                )
                raise

            with self.state_lock:
                self.next_attempt_at = now + self.interval
            return target

    def _run(self) -> None:
        while not self.stop_event.is_set():
            now = datetime.now(UTC)
            with self.state_lock:
                next_attempt_at = self.next_attempt_at
            if next_attempt_at is not None and now >= next_attempt_at:
                with suppress(Exception):
                    self._attempt(now=now, scheduled=True)
            self.stop_event.wait(TICK_SECONDS)
