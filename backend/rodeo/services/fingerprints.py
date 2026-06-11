"""Stable logical fingerprints for backup and restore verification."""

from __future__ import annotations

import base64
import hashlib
import json
import sqlite3
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path

from rodeo.config import Settings

type Scalar = str | int | float | dict[str, str] | None


@dataclass(frozen=True, slots=True)
class WorkspaceFingerprint:
    sha256: str
    tables: int
    rows: int
    recordings: int
    recording_bytes: int


def _database_path(settings: Settings) -> Path:
    prefix = "sqlite+pysqlite:///"
    if not settings.resolved_database_url.startswith(prefix):
        raise ValueError("Workspace fingerprints require Rodeo's SQLite database")
    return Path(settings.resolved_database_url.removeprefix(prefix))


def _identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def _scalar(value: object) -> Scalar:
    if value is None or isinstance(value, str | int | float):
        return value
    if isinstance(value, bytes):
        return {"base64": base64.b64encode(value).decode("ascii")}
    raise TypeError(f"Unsupported SQLite value in fingerprint: {type(value)!r}")


def _canonical(value: object) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def fingerprint_workspace(settings: Settings) -> WorkspaceFingerprint:
    """Hash database schema/rows and every live recording without modifying them."""
    database_path = _database_path(settings)
    uri = f"file:{database_path.resolve().as_posix()}?mode=ro"
    digest = hashlib.sha256()
    row_count = 0

    with closing(sqlite3.connect(uri, uri=True)) as connection:
        tables = list(
            connection.execute(
                "SELECT name, sql FROM sqlite_master "
                "WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )
        )
        for table_name, schema in tables:
            digest.update(_canonical(["table", table_name, schema]))
            statement = f"SELECT * FROM {_identifier(table_name)}"
            rows = [
                [_scalar(value) for value in row]
                for row in connection.execute(statement)
            ]
            encoded_rows = sorted(_canonical(row) for row in rows)
            for encoded_row in encoded_rows:
                digest.update(b"\n")
                digest.update(encoded_row)
            row_count += len(rows)

    recording_count = 0
    recording_bytes = 0
    if settings.recordings_dir.is_dir():
        for path in sorted(
            (path for path in settings.recordings_dir.iterdir() if path.is_file()),
            key=lambda item: item.name,
        ):
            digest.update(_canonical(["recording", path.name, path.stat().st_size]))
            with path.open("rb") as recording:
                while chunk := recording.read(1024 * 1024):
                    digest.update(chunk)
                    recording_bytes += len(chunk)
            recording_count += 1

    return WorkspaceFingerprint(
        sha256=digest.hexdigest(),
        tables=len(tables),
        rows=row_count,
        recordings=recording_count,
        recording_bytes=recording_bytes,
    )


__all__ = ["WorkspaceFingerprint", "fingerprint_workspace"]
