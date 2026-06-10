# Rodeo

A single-user, local-first technical interview preparation app: time tracker, spaced-repetition engine, and progress dashboard.

## Stack

React + TypeScript, Vite, TanStack Query, Tailwind CSS, shadcn/ui, FastAPI,
SQLAlchemy, SQLite, and a local faster-whisper worker.

## Scripts

Run frontend commands from `frontend/`:

```bash
cd frontend
npm run dev        # start the dev server on http://localhost:5199
npm run build      # typecheck and build for production
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run format     # prettier
npm run test       # vitest: engine, component, and chart tests
npm run test:e2e   # playwright: the whole app against a real backend
```

During development, Vite proxies `/api` requests to
`http://127.0.0.1:8000`.

Run the API from `backend/`:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -e '.[dev,ai]'
.venv/bin/python -m uvicorn rodeo.main:app --host 127.0.0.1 --port 8000
```

The first startup migrates SQLite and seeds the bundled LeetCode catalog. For
local development, data defaults to `/data`; set `RODEO_DATA_DIR` to a writable
directory when running outside Docker. `RODEO_TIMEZONE` controls calendar-day
scheduling semantics.

## Review queue

Rodeo’s review queue uses spaced retrieval practice for solved coding problems.
Each logged attempt schedules the next review based on whether the problem was
solved independently, solved with help, reviewed from a solution, and whether
it was completed within the target time for its difficulty. Fast independent
solves increase the interval; hints result in an earlier follow-up, while
reviewing a solution or not finishing resets the problem to review the next
day. A problem leaves the automatic queue only after four consecutive,
well-spaced, fast independent solves. No cron job is required: Rodeo shows an
active problem when its saved due date is today or earlier in the configured
timezone.

Regenerate the checked-in TypeScript API contract after changing a FastAPI
route or schema:

```bash
cd frontend
npm run generate:api
```

## Mastery and readiness

Topic Mastery scores evidence across distinct problems, not just the quality
of whatever got attempted. Large topics use a 50-problem breadth target;
smaller topics use every catalog problem. Two clean solves therefore score 4%
in a large topic, while about 38 reach the 75% target. Only the latest result
for each problem counts, so repetition cannot inflate mastery. It reads the
same per-attempt outcome the review queue derives above and does not decay on
its own.

The Readiness Score blends three signals, weighted so a single attempt can't
dominate the result: discounted mastery (70%) — a catalog-weighted average
where each solved problem's quality is itself scaled by difficulty and by how
efficiently it was solved against its target time, then decayed the longer
it has sat overdue for review; catalog coverage (20%) — the plain fraction of
the catalog ever solved; and recent practice cadence (10%) — how much of the
selected window carried an attempt. See
[`docs/mastery-and-readiness.md`](docs/mastery-and-readiness.md) for the full
formula and the reasoning behind the weights.

## Settings

Settings includes editable templates for dashboard session prompts and
per-attempt review prompts. Templates are stored in Rodeo's local database,
support context variables, and are included in workspace exports. Clearing a
workspace also removes saved templates and restores the built-in defaults.

## Verification

```bash
cd backend
.venv/bin/python -m ruff check rodeo tests scripts
.venv/bin/python -m mypy rodeo tests scripts
.venv/bin/python -m pytest -q

cd ../frontend
npm run lint
npx tsc -b
npm run build
npm run test
npm run test:e2e
```

## Tests

Four layers, fastest first. Each one catches something the layer below it
cannot; see [docs/testing-strategy.md](docs/testing-strategy.md) for what
belongs where.

| Layer | Command | Covers |
| --- | --- | --- |
| Service and API | `pytest` (`backend/`) | scheduling math, mastery, review queue, attempt replay, transcription, migrations, and every HTTP endpoint against the seeded catalog |
| Engine parity | `pytest` (`backend/tests/test_engine_parity.py`) | the Python and TypeScript engines agreeing, and the policy-v2 golden snapshot |
| Unit and component | `npm run test` (`frontend/`) | the client engine, formatting and prompt export, every dashboard card, the review queue, the attempt history, and the transcript panel, with the API faked by MSW |
| End to end | `npm run test:e2e` (`frontend/`) | the real browser against a real FastAPI process on a throwaway database: charts painting with real dimensions, the timer, and the log-attempt loop |

`npm run test:e2e` starts its own API on port 8123 and its own Vite server on
port 5198, so it never touches a running dev server or real practice data.
Install the browser once with `npx playwright install chromium`.

The two engines are kept honest by a shared fixture. Regenerate it from the
TypeScript engine with `npm run generate:fixtures` (from `frontend/`), and
regenerate the Python golden snapshot with
`.venv/bin/python scripts/dump_engine_golden.py` (from `backend/`). Read the
diffs: an unexplained change to either is a scheduling regression.

## Docker

```bash
docker compose up --build
```

The image serves the SPA and API from one origin with one Uvicorn process. A
single `/data` volume owns SQLite, recordings, queued jobs, and local model
overrides. The default bundled transcription model is `base.en`; set the
`WHISPER_MODEL` build argument to choose another compatible model.

Practice-session time is recoverable after a page reload because the server
owns the clock. Audio captured by `MediaRecorder` remains in page memory until
Stop & log uploads it, so audio recorded before an unexpected reload cannot be
recovered.

## Structure

- `frontend/src/components/layout` — app shell: header and theme toggle
- `frontend/src/components/sidebar` — sidebar shell and navigation groups
- `frontend/src/components/dashboard` — dashboard surfaces
- `frontend/src/components/brand` — logo mark
- `frontend/src/components/ui` — shadcn/ui primitives
- `frontend/src/store` — Zustand state
- `frontend/src/types` — shared types
- `frontend/src/api` — generated OpenAPI types and the same-origin API client
- `backend/rodeo/routers` — HTTP contracts
- `backend/rodeo/services` — catalog, attempt, scheduling, audio, and dashboard logic
- `backend/rodeo/workers` — leased transcription and file-cleanup jobs
- `backend/alembic` — SQLite migrations
