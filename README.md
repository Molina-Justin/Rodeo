# Rodeo

A single-user, local-first technical interview preparation app: time tracker, spaced-repetition engine, and progress dashboard.

## Stack

React + TypeScript, Vite, Tailwind CSS, shadcn/ui, lucide-react, Zustand.

## Scripts

```bash
npm run dev        # start the dev server on http://localhost:5199
npm run build      # typecheck and build for production
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run format     # prettier
```

## Structure

- `src/components/layout` — app shell: header, dashboard toolbar, theme toggle
- `src/components/sidebar` — sidebar shell and navigation groups
- `src/components/dashboard` — dashboard surfaces
- `src/components/brand` — logo mark
- `src/components/ui` — shadcn/ui primitives
- `src/store` — Zustand state
- `src/types` — shared types
