"""`python -m rodeo.cli.fingerprint` — hash the current logical workspace."""

from __future__ import annotations

import argparse

from rodeo.config import get_settings
from rodeo.services.fingerprints import fingerprint_workspace


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m rodeo.cli.fingerprint",
        description="Print a stable SHA-256 of the Rodeo database and recordings.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Also print the table, row, and recording counts",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    arguments = build_parser().parse_args(argv)
    result = fingerprint_workspace(get_settings())
    print(result.sha256)
    if arguments.verbose:
        print(
            f"{result.tables} tables, {result.rows} rows, "
            f"{result.recordings} recordings ({result.recording_bytes} bytes)"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
