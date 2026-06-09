import type { DashboardTone } from "@/lib/dashboard"
import type { Difficulty } from "@/types"

/** Tinted stat-card surfaces, matching the design palette across light and dark modes. */
export const TONE_SURFACE: Record<DashboardTone, string> = {
  emerald:
    "bg-emerald-500/10 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber:
    "bg-orange-500/10 text-orange-950 dark:bg-orange-950/40 dark:text-orange-300",
  indigo:
    "bg-indigo-500/10 text-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-300",
  violet:
    "bg-purple-500/10 text-purple-950 dark:bg-purple-950/40 dark:text-purple-300",
}

/** Same tones at badge scale, for the review queue tags. */
export const TONE_TAG: Record<DashboardTone, string> = {
  emerald:
    "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  amber:
    "bg-orange-500/15 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
  indigo:
    "bg-indigo-500/15 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300",
  violet:
    "bg-purple-500/15 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
}

export const TONE_TEXT: Record<DashboardTone, string> = {
  emerald: "text-emerald-700 dark:text-emerald-400",
  amber: "text-orange-700 dark:text-orange-400",
  indigo: "text-indigo-700 dark:text-indigo-400",
  violet: "text-purple-700 dark:text-purple-400",
}

/**
 * Difficulty tints for the inverted "next up" surface, where the card
 * background flips with the theme and the text tint has to flip against it.
 */
export const INVERTED_DIFFICULTY: Record<Difficulty, string> = {
  easy: "bg-emerald-500/20 text-emerald-300 dark:text-emerald-400",
  medium: "bg-indigo-500/20 text-indigo-300 dark:text-indigo-400",
  hard: "bg-orange-500/20 text-orange-300 dark:text-orange-400",
}

export const DIFFICULTY_BAR: Record<Difficulty, string> = {
  easy: "bg-emerald-500",
  medium: "bg-indigo-500",
  hard: "bg-orange-500",
}

/** Shared chart palette, aligned with the cycle stat surfaces. */
export const CHART_COLORS = {
  emerald: "#10b981",
  orange: "#f97316",
  indigo: "#6366f1",
  violet: "#a855f7",
  grid: "var(--border)",
  axis: "var(--muted-foreground)",
} as const

export const DASHBOARD_CHART_CARD =
  "flex flex-col justify-between h-full rounded-2xl border border-border/70 p-4 shadow-sm sm:p-5"
export const DASHBOARD_CHART_HEADER = "p-0 pb-4"
export const DASHBOARD_CHART_HEIGHT = "h-64 w-full"
export const CHART_TOOLTIP_CLASS =
  "flex flex-col gap-1.5 rounded-lg border border-border/80 bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-md"

/** Five-step activity ramp, index-aligned with `ActivityDay.level`. */
export const HEATMAP_LEVELS = [
  "bg-black/10 dark:bg-white/15",
  "bg-emerald-200 dark:bg-emerald-950/80",
  "bg-emerald-300 dark:bg-emerald-800/80",
  "bg-emerald-400 dark:bg-emerald-600",
  "bg-emerald-500 dark:bg-emerald-500",
]

export const RANGE_OPTIONS = [
  { value: "30", label: "30d", days: 30 },
  { value: "60", label: "60d", days: 60 },
  { value: "90", label: "90d", days: 90 },
  { value: "180", label: "6m", days: 180 },
] as const

export type RangeOptionValue = (typeof RANGE_OPTIONS)[number]["value"]

export const META_TEXT =
  "font-mono text-xs tracking-tight text-muted-foreground tabular-nums"

/**
 * The study slab inverts the theme (`bg-foreground`), so a switch cannot keep
 * its own tokens — `bg-input` and the dark unchecked thumb both resolve to the
 * slab's own surface and vanish. Pin the track and thumb to the inverted pair.
 */
export const INVERTED_SWITCH =
  "cursor-pointer data-checked:bg-emerald-400 data-unchecked:bg-background/25 dark:data-unchecked:bg-background/25 dark:data-unchecked:[&_[data-slot=switch-thumb]]:bg-background"
