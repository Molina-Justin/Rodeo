"""`python -m rodeo.cli.restore` — put a snapshot back with the app stopped."""

from __future__ import annotations

import argparse
import logging
import sys

from rodeo.config import get_settings
from rodeo.services.backups import existing_backups
from rodeo.services.restore import RestoreError, restore_database


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m rodeo.cli.restore",
        description="Restore a Rodeo database snapshot. Stop Rodeo first.",
    )
    parser.add_argument(
        "backup_name",
        nargs="?",
        help="Snapshot filename, e.g. rodeo-20260830T123045Z.db",
    )
    parser.add_argument(
        "--list", action="store_true", help="List available snapshots and exit"
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    arguments = build_parser().parse_args(argv)
    settings = get_settings()

    if arguments.list:
        snapshots = existing_backups(settings)
        if not snapshots:
            print(f"No snapshots in {settings.backups_dir}")
            return 0
        for path in snapshots:
            print(f"{path.name}\t{path.stat().st_size:,} bytes")
        return 0

    if arguments.backup_name is None:
        build_parser().print_usage(sys.stderr)
        return 2

    try:
        result = restore_database(settings, backup_name=arguments.backup_name)
    except RestoreError as error:
        print(f"Restore cancelled: {error}", file=sys.stderr)
        return 1

    print(f"Restored {result['restored']}")
    if result["preserved"]:
        print(f"Previous database preserved as pre-restore/{result['preserved']}")
    if result["recordings_restored"]:
        print(f"Recovered {len(result['recordings_restored'])} recording(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
