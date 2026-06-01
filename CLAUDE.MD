# Project Context
This is a single-user, local-first technical interview preparation app. It acts as a time tracker, spaced-repetition engine, and progress dashboard. The aesthetic is modern, minimalist, and structural.

# Tech Stack
- Frontend: React
- Language: TypeScript
- Styling: Tailwind CSS
- UI Library: shadcn/ui
- Icons: lucide-react
- State Management: Zustand
  
# Git & Commit Rules (CRITICAL)
- Branch names MUST strictly follow the format: `Rodeo-{#}`, where `#` increments by 1 from the previous branch number (e.g., `Rodeo-1`, `Rodeo-2`).
- All commit messages MUST strictly follow this format: `[Rodeo #{Branch #}] {message}` (e.g., `[Rodeo #1] initialize project structure`).
- The `{message}` portion must be concise and NO LONGER than two sentences.
- NEVER generate commit messages that include "Co-authored-by: Claude" or mention Claude, AI, or any other entity.
- The repository must contain ZERO references to Claude or AI assistance.
- I am the sole author of all code and commits. Do not add metadata, tags, or signatures indicating otherwise.

# UI & Component Constraints
1. **shadcn/ui Exclusivity:** You must use shadcn/ui for all major UI elements to maintain a consistent and clean design. Do not invent custom UI components if a shadcn equivalent exists.
2. **Iconography:** Exclusively use `lucide-react` for all icons. Do not use HeroIcons, FontAwesome, or custom SVGs unless explicitly requested.
3. **Tailwind Canonical Classes:** NEVER use arbitrary values (e.g., `w-[3px]`, `pt-[30px]`, `bg-white/[0.04]`, `rounded-[2px]`) if a canonical Tailwind utility class exists. Use standard scale classes like `w-0.75`, `pt-7.5`, `bg-white/4`, and `rounded-xs`.
4. **Available shadcn/ui Components (Use these as your primary toolkit):**
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

# AI Assistant Role & Tone
- Act as a senior, principal-level software engineer.
- Be concise, direct, and pragmatic.
- Eliminate robotic transitions, pleasantries, and moralizing (e.g., skip "Here is the code..." or "I hope this helps!").
- Do not apologize if you make a mistake. Simply output the corrected code.

# Code Style & Generation Rules
1. **No boilerplate explanations:** Only explain complex algorithmic logic or architectural decisions.
2. **Complete Code:** When outputting code, provide the complete, working file unless explicitly instructed to only provide a snippet. Do not use placeholders like `// ... rest of code` unless the file is massive.
3. **Clean Code:** Prioritize readable, declarative code. Use early returns to avoid deep nesting.
4. **Types:** Enforce strict TypeScript typing. Avoid `any`. Define Zustand store interfaces clearly.
5. **Imports:** Organize imports systematically: built-in modules, third-party libraries (e.g., `lucide-react`, `zustand`), shadcn components, local utils/types.
6. **Project Structure & Clean Organization:** Maintain a clean, highly organized repository. Group related items logically into dedicated folders (e.g., group by feature or by type such as `/components`, `/hooks`, `/store`, `/utils`). Do not dump files into root directories.

# Architectural Constraints
1. **Local-First:** Do not suggest cloud databases or multi-user architectural patterns (Auth, JWTs, etc.). This is a single-user local SQLite app.
2. **Deterministic Engine:** Do not introduce AI calls, LLMs, or stochastic processes for mastery scoring, spaced repetition, or the roadmap. These must remain pure mathematical functions.
3. **Data Flow:** Every user log (attempt) must trigger an immediate re-computation of derived state in the Zustand store (streak, mastery score, next-up queue).