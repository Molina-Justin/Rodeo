from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from functools import partial
from threading import Lock

from sqlalchemy import Engine, create_engine
from sqlalchemy.engine.interfaces import DBAPIConnection
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import ConnectionPoolEntry
from starlette.requests import Request

from rodeo.config import Settings, get_settings

EngineKey = tuple[str, int]
_engines: dict[EngineKey, Engine] = {}
_session_factories: dict[EngineKey, sessionmaker[Session]] = {}
_registry_lock = Lock()


def configure_sqlite_connection(
    dbapi_connection: DBAPIConnection,
    _connection_record: ConnectionPoolEntry,
    *,
    busy_timeout_ms: int = 5_000,
) -> None:
    if not isinstance(dbapi_connection, sqlite3.Connection):
        return

    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute(f"PRAGMA busy_timeout={busy_timeout_ms:d}")
    finally:
        cursor.close()


def engine_for_url(database_url: str, busy_timeout_ms: int = 5_000) -> Engine:
    key = (database_url, busy_timeout_ms)
    with _registry_lock:
        existing_engine = _engines.get(key)
        if existing_engine is not None:
            return existing_engine

    connect_args: dict[str, bool] = {}
    if database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False

    engine = create_engine(
        database_url,
        connect_args=connect_args,
        pool_pre_ping=True,
    )
    if database_url.startswith("sqlite"):
        from sqlalchemy import event

        event.listen(
            engine,
            "connect",
            partial(
                configure_sqlite_connection,
                busy_timeout_ms=busy_timeout_ms,
            ),
        )

    with _registry_lock:
        raced_engine = _engines.setdefault(key, engine)
    if raced_engine is not engine:
        engine.dispose()
        return raced_engine
    return engine


def get_engine(settings: Settings | None = None) -> Engine:
    resolved_settings = settings or get_settings()
    return engine_for_url(
        resolved_settings.resolved_database_url,
        resolved_settings.sqlite_busy_timeout_ms,
    )


def session_factory_for_url(
    database_url: str,
    busy_timeout_ms: int = 5_000,
) -> sessionmaker[Session]:
    key = (database_url, busy_timeout_ms)
    with _registry_lock:
        existing_factory = _session_factories.get(key)
        if existing_factory is not None:
            return existing_factory

    factory = sessionmaker(
        bind=engine_for_url(database_url, busy_timeout_ms),
        class_=Session,
        autoflush=False,
        expire_on_commit=False,
    )
    with _registry_lock:
        return _session_factories.setdefault(key, factory)


def get_db_session(request: Request) -> Iterator[Session]:
    settings: Settings = request.app.state.settings
    factory = session_factory_for_url(
        settings.resolved_database_url,
        settings.sqlite_busy_timeout_ms,
    )
    with factory() as session:
        yield session


def dispose_database_engines() -> None:
    with _registry_lock:
        engines = list(_engines.values())
        _engines.clear()
        _session_factories.clear()

    for engine in engines:
        engine.dispose()
