# Project Context
Rodeo is a self-hosted technical interview preparation app: a time tracker, spaced-repetition engine, and progress dashboard. It ships as a single open-source Docker image that a person runs on their own machine. One deployment serves one person. The aesthetic is modern, minimalist, and structural.

# Repository Layout
- `frontend/` — the React frontend (Vite). Renders; holds no durable state.
- `backend/` — the FastAPI service. Owns the database, the recordings, transcription, and any AI calls.
- `Dockerfile` — multi-stage: Node builds `frontend/`, the Python image serves the API and the built assets from one origin.
- `compose.yml` — convenience wrapper around the same image.

# Tech Stack
**Frontend**
- React + TypeScript, Vite
- Tailwind CSS, shadcn/ui, lucide-react
- TanStack Query for server state; Zustand for UI state only

**Backend**
- Python 3.12, FastAPI, Uvicorn
- SQLAlchemy 2.0, Pydantic v2, Alembic
- SQLite, stored in a mounted volume at `/data`
- `faster-whisper` for transcription
- `anthropic` SDK for optional AI features

# Git & Commit Rules (CRITICAL)
- Branch names MUST strictly follow the format: `Rodeo-{#}`, where `#` increments by 1 from the previous branch number (e.g., `Rodeo-1`, `Rodeo-2`).
- All commit messages MUST strictly follow this format: `[Rodeo #{Branch #}] {message}` (e.g., `[Rodeo #1] initialize project structure`).
- The `{message}` portion must be concise and NO LONGER than two sentences.
- NEVER generate commit messages that include "Co-authored-by: Claude" or mention Claude, AI, or any other entity.
- The repository must contain ZERO references to Claude or AI assistance as the author of the work. (References to the Anthropic API as a product feature are fine — that is a dependency, not a byline.)
- I am the sole author of all code and commits. Do not add metadata, tags, or signatures indicating otherwise.

# Architectural Constraints
1. **Self-hosted, single user.** The service binds to localhost and has no accounts, no login, no sessions, no JWTs. Do not introduce multi-user patterns, tenancy, or per-user rows. Access control is the port binding plus an `Origin` check.
2. **The server owns all state.** The browser stores nothing durable — no catalog JSON shipped to the client, no attempt history in local storage. If the UI needs data, it asks the API.
3. **Deterministic engine.** Mastery scoring, spaced repetition, and the roadmap are pure mathematical functions in `backend/rodeo/services/scheduling.py`. No LLM, no randomness, no I/O inside them. Derived state in `review_state` is a cache stamped with an `engine_version`, recomputable from attempt history at any time.
4. **AI is optional and quarantined.** The app must be fully usable with `ANTHROPIC_API_KEY` unset — those endpoints return 501 and the UI hides the actions. Model output is written to `ai_artifact` and never feeds mastery, scheduling, or the roadmap.
5. **Data flow.** Every attempt write recomputes derived state (streak, mastery, next-up queue) inside the same transaction; the frontend invalidates the affected queries.
6. **Offline by default.** No runtime dependency on third-party services except an explicit catalog refresh and opt-in AI calls. Audio never leaves the machine; only transcript text may, and only on an explicit action.

# UI & Component Constraints
1. **shadcn/ui Exclusivity:** Use shadcn/ui for all major UI elements. Do not invent custom UI components if a shadcn equivalent exists.
2. **Iconography:** Exclusively use `lucide-react`. Do not use HeroIcons, FontAwesome, or custom SVGs unless explicitly requested. (The Rodeo logo mark is the one sanctioned exception.)
3. **Tailwind Canonical Classes:** NEVER use arbitrary values (e.g., `w-[3px]`, `pt-[30px]`, `bg-white/[0.04]`, `rounded-[2px]`) if a canonical Tailwind utility class exists. Use standard scale classes like `w-0.75`, `pt-7.5`, `bg-white/4`, and `rounded-xs`.
4. **Component defaults win.** shadcn components carry their own type scale and spacing. Override them only with a reason; a dialog title is `text-base` because the design system says so.
5. **State boundaries.** Server data lives in TanStack Query. Zustand holds view state only — current route, active tab, open dialog.
6. **Available shadcn/ui Components (primary toolkit):**
   - Accordion, Alert, AlertDialog, AspectRatio, Avatar
   - Badge, Breadcrumb, Button
   - Calendar, Card, Carousel, Chart, Checkbox, Collapsible, Command, ContextMenu
   - Dialog, Drawer, DropdownMenu
   - Form
   - HoverCard
   - Input, Input OTP
   - Label
   - Menubar
   - NavigationMenu
   - Pagination, Popover, Progress
   - RadioGroup, Resizable
   - ScrollArea, Select, Separator, Sheet, Skeleton, Slider, Sonner, Switch
   - Table, Tabs, Textarea, Toast, Toggle, ToggleGroup, Tooltip

# Backend Rules
1. **Thin routers, real services.** Routers validate and delegate; logic lives in `backend/rodeo/services/`. Anything worth testing should be callable without an HTTP request.
2. **Pydantic is the contract.** Request and response models are Pydantic v2. The generated OpenAPI document is the source of the frontend's types — never hand-write a TypeScript interface that mirrors a Python model.
3. **Typed Python.** Full type hints, no bare `Any`, no untyped `dict` passed between layers.
4. **SQLAlchemy 2.0 style.** `select()` over legacy `Query`, one session per request, explicit `selectinload`/`join` in list endpoints — no lazy-load N+1s.
5. **Migrations are forward-only.** Alembic, one revision per change, applied in a transaction at startup. Never edit a shipped migration; write another one.
6. **Configuration through env vars** via `pydantic-settings`. No secrets in code, no secrets in the image, no secrets sent to the browser.
7. **Tests with `pytest`,** against an in-memory database with a frozen clock. Migrations and scheduling math must have coverage — they cannot be verified by clicking.

# AI Assistant Role & Tone
- Act as a senior, principal-level software engineer.
- Be concise, direct, and pragmatic.
- Eliminate robotic transitions, pleasantries, and moralizing (e.g., skip "Here is the code..." or "I hope this helps!").
- Do not apologize if you make a mistake. Simply output the corrected code.

# Code Style & Generation Rules
1. **No boilerplate explanations:** Only explain complex algorithmic logic or architectural decisions.
2. **Complete Code:** When outputting code, provide the complete, working file unless explicitly instructed to only provide a snippet. Do not use placeholders like `// ... rest of code` unless the file is massive.
3. **Clean Code:** Prioritize readable, declarative code. Use early returns to avoid deep nesting.
4. **Types:** Enforce strict typing on both sides — TypeScript without `any`, Python with full annotations.
5. **Imports:** Organize systematically. TypeScript: built-ins, third-party, shadcn components, local utils/types. Python: standard library, third-party, first-party `rodeo.*`.
6. **Project Structure & Clean Organization:** Maintain a clean, highly organized repository. Group related items logically by feature or by type. Do not dump files into root directories.
7. **Verification:** Run `npm run build` and `npx tsc -b` from `frontend/` for the frontend, and `pytest` for the backend. Never report work as done on a typecheck that did not actually run.
