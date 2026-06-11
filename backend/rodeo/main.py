from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware import Middleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from rodeo.config import Settings, get_settings
from rodeo.db import dispose_database_engines, session_factory_for_url
from rodeo.models.base import utc_now
from rodeo.routers import api_router
from rodeo.security import OriginCheckMiddleware
from rodeo.services.attempts import rebuild_review_states_if_engine_changed
from rodeo.services.catalog import seed_catalog
from rodeo.services.migrations import upgrade_database
from rodeo.services.restore import apply_pending_restore
from rodeo.static import SPAStaticFiles
from rodeo.workers.backups import BackupScheduler
from rodeo.workers.transcription import DurableWorker

# Uvicorn configures handlers for its own loggers only; a "rodeo.*" logger would
# propagate to an unconfigured root and never reach the container logs.
logger = logging.getLogger("uvicorn.error")


def prepare_storage(settings: Settings) -> None:
    for directory in (
        settings.data_dir,
        settings.recordings_dir,
        settings.temporary_dir,
        settings.local_models_dir,
        settings.backups_dir,
    ):
        directory.mkdir(parents=True, exist_ok=True)


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        prepare_storage(app_settings)
        restored = apply_pending_restore(app_settings)
        if restored is not None:
            logger.info(
                "Restored %s before startup (%d recording(s) recovered)",
                restored["restored"],
                len(restored["recordings_restored"]),
            )
        # Migrations run after a restore so an older snapshot is brought forward.
        upgrade_database(app_settings.resolved_database_url)
        factory = session_factory_for_url(
            app_settings.resolved_database_url,
            app_settings.sqlite_busy_timeout_ms,
        )
        with factory.begin() as session:
            seed_catalog(session)
            rebuild_review_states_if_engine_changed(
                session,
                now=utc_now(),
                timezone_name=app_settings.timezone,
            )
        worker = DurableWorker(app_settings)
        worker.start()
        _app.state.worker = worker
        backups = BackupScheduler(app_settings)
        backups.start()
        _app.state.backups = backups
        logger.info("Rodeo is ready at %s", app_settings.public_url)
        yield
        backups.stop()
        worker.stop()
        dispose_database_engines()

    middleware = [
        Middleware(TrustedHostMiddleware, allowed_hosts=app_settings.allowed_hosts),
        Middleware(
            OriginCheckMiddleware,
            allowed_origins=app_settings.effective_allowed_origins,
        ),
    ]
    app = FastAPI(
        title=app_settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
        middleware=middleware,
    )
    app.state.settings = app_settings
    app.include_router(api_router, prefix=app_settings.api_prefix)
    if app_settings.static_dir.is_dir():
        app.mount(
            "/",
            SPAStaticFiles(directory=app_settings.static_dir, html=True),
            name="web",
        )
    return app


app = create_app()
