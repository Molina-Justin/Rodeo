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

Regenerate the checked-in TypeScript API contract after changing a FastAPI
route or schema:

```bash
cd frontend
npm run generate:api
```

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
```

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
