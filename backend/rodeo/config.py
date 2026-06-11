from __future__ import annotations

from datetime import timedelta
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="RODEO_",
        extra="ignore",
    )

    environment: Literal["development", "test", "production"] = "development"
    app_name: str = "Rodeo"
    api_prefix: str = "/api/v1"
    timezone: str = "America/New_York"

    public_url: str = "http://127.0.0.1:8000"

    data_dir: Path = Path("/data")
    static_dir: Path = Path("/app/static")
    database_url: str | None = None
    database_filename: str = "rodeo.db"
    sqlite_busy_timeout_ms: int = 5_000
    max_recording_bytes: int = 1_073_741_824

    allowed_hosts: list[str] = Field(
        default_factory=lambda: ["127.0.0.1", "localhost", "testserver"]
    )
    allowed_origins: list[str] = Field(
        default_factory=lambda: [
            "http://127.0.0.1:5199",
            "http://localhost:5199",
        ]
    )

    backup_enabled: bool = True
    backup_interval_hours: int = Field(default=24, gt=0, le=8_760)
    backup_retention: int = Field(default=14, ge=1, le=365)
    backup_include_recordings: bool = True

    transcription_enabled: bool = True
    transcription_model: str = "base.en"
    bundled_models_dir: Path = Path("/opt/rodeo-models")
    worker_poll_interval_seconds: float = 1.0
    worker_lease_seconds: int = 300

    @property
    def resolved_database_url(self) -> str:
        if self.database_url is not None:
            return self.database_url

        database_path = (self.data_dir / self.database_filename).resolve()
        return f"sqlite+pysqlite:///{database_path.as_posix()}"

    @property
    def recordings_dir(self) -> Path:
        return self.data_dir / "recordings"

    @property
    def temporary_dir(self) -> Path:
        return self.data_dir / "tmp"

    @property
    def backups_dir(self) -> Path:
        return self.data_dir / "backups"

    @property
    def backup_recordings_dir(self) -> Path:
        return self.backups_dir / "recordings"

    @property
    def pre_restore_dir(self) -> Path:
        """Databases displaced by a restore, kept so one can be undone."""
        return self.backups_dir / "pre-restore"

    @property
    def backup_retention_window(self) -> timedelta:
        """How long a deleted recording stays recoverable."""
        return timedelta(hours=self.backup_interval_hours) * self.backup_retention

    @property
    def local_models_dir(self) -> Path:
        return self.data_dir / "models"

    def installed_transcription_model_path(self) -> Path | None:
        local_model = self.local_models_dir / self.transcription_model
        if local_model.exists():
            return local_model

        bundled_model = self.bundled_models_dir / self.transcription_model
        if bundled_model.exists():
            return bundled_model

        return None

    @property
    def effective_allowed_origins(self) -> list[str]:
        """Development may use Vite; production accepts same-origin only."""
        return [] if self.environment == "production" else self.allowed_origins


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
