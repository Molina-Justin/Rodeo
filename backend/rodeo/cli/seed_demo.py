"""Populate an empty Rodeo workspace with `python -m rodeo.cli.seed_demo`."""

from __future__ import annotations

import logging
import sys
from datetime import UTC, datetime

from rodeo.config import get_settings
from rodeo.db import dispose_database_engines, session_factory_for_url
from rodeo.main import prepare_storage
from rodeo.services.catalog import seed_catalog
from rodeo.services.demo_data import DemoDataError, seed_demo_data
from rodeo.services.migrations import upgrade_database


def main() -> int:
    logging.basicConfig(level=logging.WARNING, format="%(message)s")
    settings = get_settings()
    prepare_storage(settings)
    upgrade_database(settings.resolved_database_url)
    factory = session_factory_for_url(
        settings.resolved_database_url,
        settings.sqlite_busy_timeout_ms,
    )
    try:
        with factory.begin() as session:
            seed_catalog(session)
            summary = seed_demo_data(
                session,
                now=datetime.now(UTC),
                timezone_name=settings.timezone,
            )
    except DemoDataError as error:
        print(f"Demo data was not added: {error}", file=sys.stderr)
        return 1
    finally:
        dispose_database_engines()

    print(
        "Added "
        f"{summary.attempts} attempts across {summary.problems_practiced} problems, "
        f"{summary.practice_sessions} timed sessions, and {summary.settings} settings."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
