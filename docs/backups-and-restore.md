# Backups and Restore

Why the backup system works the way it does. For day-to-day use see the
[Your data](../README.md#your-data) section of the README.

## Durability of the live database

SQLite runs in WAL mode with `synchronous=FULL`, set on every connection in
`backend/rodeo/db.py`.

WAL means a write is appended to `rodeo.db-wal` and marked committed only once
it is fully written, so an interrupted write leaves the main database intact
and recoverable rather than half-modified. `synchronous=FULL` makes SQLite wait
for the data to reach the disk before reporting a commit, which is what carries
a committed attempt through a power cut rather than just a crashed process.

Rodeo writes a few rows per practice session, so the cost is invisible. It is
set explicitly rather than left to SQLite's default so that the guarantee is a
decision in the code.

## Taking a snapshot

Snapshots are written with `VACUUM INTO`, not a file copy. In WAL mode the most
recent commits may still live in `rodeo.db-wal`; copying `rodeo.db` alone would
silently omit them. `VACUUM INTO` reads through a normal transaction, so it
folds in the WAL contents and needs no write lock. The app keeps running while
it runs.

Every snapshot is verified with `PRAGMA quick_check` immediately after it is
written. A snapshot that fails is deleted rather than left on disk, so a
corrupt file can never become the most recent backup. A failed run is retried
after 10 minutes.

Scheduling counts from the newest snapshot's modification time, not from
process start. Otherwise every restart would cut a fresh snapshot and prune a
real daily one, and a day of restarts would leave a backup history minutes
deep.

## Recordings

Audio files are immutable: each upload is written under a new UUID and never
rewritten. Copying the directory daily would rewrite the same data 14 times, so
the mirror copies each file once, the first time it sees it.

`recordings-manifest.json` tracks when each file was copied and when it went
missing from the live directory. A deleted recording's copy is kept for the
retention window before being swept, so an accidental deletion is recoverable;
without that window the mirror would simply track deletions and protect
nothing.

## Restoring

A running application holds the database open, and its worker thread holds
connections of its own, so the file cannot be swapped underneath it. The
restore therefore never happens in the running process.

Choosing **Restore** in Settings validates the snapshot immediately. An
unreadable file is rejected there and then rather than failing after a
restart. It writes a `restore-request.json` into the data directory and asks
uvicorn to stop with SIGTERM. The graceful stop matters: the lifespan closes
the database and checkpoints the WAL before anything reads it. The container
restart policy brings the process back, and the restore runs at startup before
migrations, so an older snapshot is then brought forward to the current schema.

The request file is deleted before the restore is attempted, not after. A
restore that fails therefore cannot put the application into a restart loop; it
boots on the database it already had, which the preserve step has just copied
aside. Outside a container nothing would restart the process, so in that case
the request is staged and the person restarts Rodeo themselves.

`backend/rodeo/services/restore.py` holds the logic; `scripts/restore-backup`
only sequences the container around it, and `python -m rodeo.cli.restore` runs
it directly outside Docker.

The order matters:

1. Verify the snapshot with the full `integrity_check`. It is slower than
   `quick_check`, but this runs once and reads a file that may be weeks old.
   Nothing is touched until it passes.
2. Copy the current database aside into `data/backups/pre-restore/`, using
   `VACUUM INTO` for the same reason snapshots use it: if the previous shutdown
   was unclean, committed work is sitting in the WAL that step 4 deletes.
3. Replace the live database through a temporary file and an atomic rename.
4. Delete `rodeo.db-wal` and `rodeo.db-shm`, which describe the database that
   was just replaced.
5. Copy back any recording the restored database references that is missing
   from `data/recordings/` but still held in the mirror. Restoring an older
   snapshot reintroduces rows for recordings deleted since; without this the
   app returns with attempts whose audio is gone.

Pre-restore copies follow the same retention count as snapshots. They are named
`pre-restore-*.db` and live in their own directory. Snapshot detection uses
a strict `rodeo-YYYYMMDDTHHMMSSZ.db` match, so it cannot mistake one for a
backup and schedule from it.
