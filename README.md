# Rodeo

Rodeo is a local, single-user technical interview practice app. Track timed
problem attempts, revisit work with spaced repetition, and follow progress on
the dashboard.

## What it includes

- A searchable LeetCode problem catalog
- Timed practice sessions with attempt notes and optional audio recording
- A deterministic review queue based on completed attempts
- Mastery, readiness, and activity views
- Interview goals and editable prompt templates
- Local workspace export and clearing controls

## Quick start

Docker Compose is the supported way to run Rodeo. It builds the frontend and
the API into one image, applies migrations, and serves everything from a single
origin.

Requirements: Docker Desktop (or Docker Engine with the Compose plugin).

```bash
git clone <repository-url> rodeo
cd rodeo
docker compose up --build
```

The first build downloads the Whisper transcription model and takes several
minutes; later builds are cached. When the app is ready it logs the address to
open:

```text
INFO:     Rodeo is ready at http://127.0.0.1:8000
```

If that port is taken, change both the host side of `ports` and
`RODEO_PUBLIC_URL` in `compose.yml`.

Rodeo runs entirely on your machine and makes no outbound service calls. To
change the scheduling timezone or the transcription model, edit the
`environment` block in `compose.yml`.

Day-to-day commands:

```bash
docker compose up -d
docker compose logs -f
docker compose down
docker compose up --build
```

## Your data

Everything Rodeo stores lives in `./data` next to the repository. This includes
the SQLite database, your recordings, and the backups. It is a plain folder on your
computer, not a Docker volume, so `docker compose down` never touches it.

The folder is git-ignored, which means it will not appear in `git status` and
some editors grey it out. It is still there:

```text
data/
  rodeo.db              your problems, attempts, and review schedule
  recordings/           audio from practice sessions
  backups/              daily snapshots, kept for two weeks
```

### Backups

Rodeo copies the database into `data/backups/` once a day and keeps the last
14. Each snapshot is one self-contained file. Recordings are copied once each
into `data/backups/recordings/`, and a recording you delete stays in the backup
for two weeks in case you change your mind.

Settings → Backups shows when the last one ran, where they are, and can make
one immediately.

### Restoring

Open Settings → Backups → Browse snapshots, pick one, and choose **Restore**.
Rodeo confirms, restarts itself, and the page reloads when it comes back.

The restore puts the database back and returns any recordings that snapshot
needs. Your current database is saved to `data/backups/pre-restore/` first, so
a restore can itself be undone.

A restore can also be run from a terminal, which is the way to do it if the app
will not start:

```bash
scripts/restore-backup --list
scripts/restore-backup rodeo-20260830T123045Z.db
```

### Testing the full backup and restore flow

For a disposable test workspace, start with an empty `data/` directory and add
realistic practice history:

```bash
docker compose up -d --build
scripts/seed-demo-data
```

The generator adds more than 25 varied attempts across easy, medium, and hard
problems, including repeated reviews, timed sessions, notes, interview goals,
and a custom prompt template. It refuses to run if it finds existing workspace
data, so it cannot silently mix fixtures into real history.

Capture a baseline, then use Settings → Backups → Back up now:

```bash
scripts/workspace-fingerprint --verbose
```

Save the first line. Change the workspace through the app. For example, edit an
attempt, add another, or use Settings → Clear workspace. Then run the fingerprint
again to confirm it changed. Restore the saved snapshot through Settings and run
the command a third time. The final SHA-256 must exactly match the baseline.
The fingerprint covers the logical database contents and all live recording
files, while ignoring the backup directory itself.

The automated equivalent is covered by
`backend/tests/test_demo_data.py`: populate → snapshot → clear/add → restore →
exact fingerprint comparison.

### Protecting against losing the computer

These backups live on the same disk as the original. Include the whole `data`
folder in Time Machine, File History, or whatever you already use, so a drive
failure or a lost laptop does not take your practice history with it.

On Linux the container runs as root, so files under `./data` are root-owned;
use `sudo` to move or delete them.

See [Backups and Restore](docs/backups-and-restore.md) for how the snapshots
are taken and why.

## Development

The Docker image is the deliverable; run the two processes directly only when
you are changing code. This uses a separate throwaway database at
`backend/.data`, not the workspace above. Stop the container first. Both bind
to port 8000.

Requirements: Python 3.12+ and Node 22+.

### Backend

```bash
cd backend
cp .env.example .env
python3.12 -m venv .venv
.venv/bin/pip install -e '.[dev]'
.venv/bin/python -m uvicorn rodeo.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite server runs on <http://127.0.0.1:5199> and proxies `/api` to the
backend.

On startup, Rodeo applies outstanding SQLite migrations. A new database is
seeded with the bundled LeetCode catalog.

## Configuration

Environment variables are read with the `RODEO_` prefix; see
`backend/.env.example` for the full development set.
`RODEO_DATA_DIR` selects the data directory and `RODEO_TIMEZONE` defines the
timezone used for calendar-day scheduling. `RODEO_BACKUP_ENABLED`,
`RODEO_BACKUP_INTERVAL_HOURS` (default 24), and `RODEO_BACKUP_RETENTION`
(default 14) control the database snapshots described above, and
`RODEO_BACKUP_INCLUDE_RECORDINGS` (default true) controls the audio mirror.
The interval must be 1 to 8,760 hours and retention must be 1 to 365 snapshots;
invalid values prevent startup instead of silently weakening recovery.

## Review queue

Each completed attempt updates the review schedule. Fast independent solves
extend the interval; hints bring the next review closer; solutions and failed
attempts schedule an earlier review. A problem graduates from the automatic
queue after repeated, well-spaced, fast independent solves.

See [Review Queue Rules](docs/review-queue-rules.md) for the complete policy.

## Mastery and readiness

Topic Mastery measures progress across distinct problems. The Readiness Score
combines mastery, coverage, and recent practice cadence.

See [Mastery and Readiness](docs/mastery-and-readiness.md) for the formulas.

## Settings and workspace data

Interview Goals can store a target role, target interview date, and years of
experience. Prompt templates support their documented context variables.

Goals and templates are stored locally and included in workspace exports.
Templates can be reset to their built-in defaults; clearing the workspace
removes saved goals and templates.

## Verification

Run backend checks from `backend/`:

```bash
.venv/bin/python -m ruff check rodeo tests scripts
.venv/bin/python -m mypy rodeo tests scripts
.venv/bin/python -m pytest -q
```

Run frontend checks from `frontend/`:

```bash
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
```

Regenerate frontend API types after changing a FastAPI route or schema:

```bash
cd frontend
npm run generate:api
```

## Project layout

```text
frontend/  React application and generated API types
backend/   FastAPI application, SQLite models, scheduling, and workers
docs/      Product rules and implementation rationale
```
