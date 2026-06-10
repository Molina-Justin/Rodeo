# Rodeo

A single-user, local-first technical interview preparation app: time tracker, spaced-repetition engine, and progress dashboard.

## Stack

React + TypeScript, Vite, Tailwind CSS, shadcn/ui, lucide-react, Zustand.

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

## Structure

- `frontend/src/components/layout` — app shell: header and theme toggle
- `frontend/src/components/sidebar` — sidebar shell and navigation groups
- `frontend/src/components/dashboard` — dashboard surfaces
- `frontend/src/components/brand` — logo mark
- `frontend/src/components/ui` — shadcn/ui primitives
- `frontend/src/store` — Zustand state
- `frontend/src/types` — shared types
