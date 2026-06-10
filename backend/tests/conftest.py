from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from rodeo.config import Settings
from rodeo.db import dispose_database_engines, session_factory_for_url
from rodeo.main import create_app
from rodeo.services.migrations import upgrade_database


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        environment="test",
        data_dir=tmp_path / "data",
        database_url=f"sqlite+pysqlite:///{tmp_path / 'test.db'}",
        allowed_hosts=["testserver"],
        allowed_origins=["http://testserver"],
        bundled_models_dir=tmp_path / "bundled-models",
    )


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as test_client:
        yield test_client
    dispose_database_engines()


@pytest.fixture
def db_session(settings: Settings) -> Iterator[Session]:
    upgrade_database(settings.resolved_database_url)
    factory = session_factory_for_url(
        settings.resolved_database_url, settings.sqlite_busy_timeout_ms
    )
    with factory() as session:
        yield session
    dispose_database_engines()
