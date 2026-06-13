# Testing strategy

Rodeo is a deterministic engine wrapped in a set of charts. Those two halves
fail in completely different ways, so they are tested in completely different
ways. This file records what each layer is responsible for and, more
usefully, what it deliberately cannot catch, so a new test lands in the right
place instead of the convenient one.

## The four layers

### 1. Service and API tests: `backend/tests/`

`pytest` against an in-memory or temporary SQLite database. Two styles live
here on purpose:

- **Service tests** (`test_scheduling.py`, `test_attempts.py`,
  `test_dashboard.py`, `test_catalog.py`, `test_sessions_and_audio.py`) call
  the functions directly with a frozen clock. Scheduling is pure maths over
  calendar days; it deserves tests that pin exact numbers, and those are
  unreadable through HTTP.
- **API tests** (`test_api_regression.py`) drive the real application through
  `TestClient`: migrations run, the bundled catalog seeds, the origin check
  applies, and every router is mounted. This is where wiring failures show up
  such as a moved route, an invalid query parameter, or a changed status code.
  A service test cannot detect those failures.

Both are fast enough to run on every save, so there is no reason to skip them.

### 2. Engine parity: `backend/tests/test_engine_parity.py`

Rodeo currently runs the scheduling engine **twice**:

- `backend/rodeo/services/scheduling.py` is the source of truth and implements
  policy v2 (see [review-queue-rules.md](review-queue-rules.md)).
- `frontend/src/lib/dashboard.ts` carries a policy-v2 projection for the rich
  client-side dashboard, sidebar due badge, and review queue page. Attempt
  responses include the saved difficulty and time target so replay uses the
  same historical inputs as the server.

Two implementations of one algorithm drift silently, and the drift surfaces as
a wrong number on a screen rather than as an error. The parity layer makes it
loud instead:

- `frontend/scripts/dump-dashboard-fixtures.ts` runs the **TypeScript** engine
  over a set of histories: an empty one, an all-failures one, two attempts on
  the same day, a daylight-saving boundary, an attempt on a problem that left
  the catalog, and a mixed history. It records the results to
  `backend/tests/fixtures/dashboard-parity.json`.
- `frontend/src/lib/dashboard.test.ts` asserts the TypeScript engine still
  reproduces that recording, which stops the client half from moving unnoticed.
- `backend/tests/test_engine_parity.py` replays the same histories through the
  **Python** engine and asserts the two agree on mastery, problem status,
  attempt counts, lapses, confidence, and which attempt is latest.

The engines must agree on review interval, due date, mastery, problem status,
attempt counts, lapses, confidence, clean-review streak, and the sidebar/server
due count. There is no allowlist for drift.

`backend/tests/fixtures/engine-v2-golden.json` separately pins the Python
engine's own output, including the v2-only fields (`next_due_on`,
`graduated_at`, `clean_quick_streak`). Regenerate with
`scripts/dump_engine_golden.py` and read the diff.

If the rich dashboard moves fully to server projections, this layer can
collapse into the API tests. Until then, exact parity is required.

### 3. Unit and component tests: `frontend/src/**/*.test.tsx`

Vitest in jsdom. Covers the client engine, the formatting helpers, the prompt
builders, every dashboard card, the review queue page, the attempt history, and
the transcript panel.

Two pieces of harness are load-bearing and easy to break:

- **jsdom reports every element as zero-sized.** Recharts measures its
  container and draws nothing at zero width, so `src/test/setup.ts` gives every
  element a real bounding box. Without it, chart tests pass against blank SVGs.
- **MSW must start before the test modules import.** `openapi-fetch` captures
  `globalThis.fetch` when `src/api/client.ts` loads, so `server.listen()` runs
  at setup-module scope rather than inside `beforeAll`. Starting it later
  leaves the API client holding the unpatched fetch, and requests escape to
  whatever is really listening on the origin. This is usually a dev server, which
  answers plausibly enough that the tests still look like they pass.

`src/test/server.ts` is a small in-memory backend rather than a set of mocked
modules, so writes are visible to later reads and the real hooks, the real
query cache, and the real client all take part.

The clock is frozen with `vi.setSystemTime` wherever a component reads
`new Date()` internally, which the review queue and the dashboard both do.

### 4. End to end: `frontend/e2e/`

Playwright drives Chromium against a real Uvicorn process on a throwaway
database (`backend/.e2e-data/`) and a dedicated Vite server, on ports that do
not collide with development. Nothing is mocked.

This layer earns its cost on exactly two things:

- **Charts actually painting.** The specs assert every `recharts-surface` has
  a non-zero width and height. A card that renders a correctly-structured but
  invisible SVG passes every other layer.
- **The full loop.** Start the timer, stop and log, reload the page, and find
  the attempt still there. This proves the server owns the state, not the
  browser.

It also fails the run on any console error during a dashboard render, which
catches the class of React warning that never breaks an assertion.

## Where a new test belongs

- Scheduling or mastery arithmetic → a service test, with exact numbers.
- A route, status code, or query parameter → `test_api_regression.py`.
- Anything either engine computes → add the history to the parity fixture, so
  both halves are covered at once.
- Whether a card renders, an empty state appears, or a click calls back → a
  component test.
- Whether it is visible, laid out, and durable across a reload → end to end.

Prefer the fastest layer that can actually observe the failure. An end-to-end
test for arithmetic is slow and vague; a service test for a chart proves
nothing.
