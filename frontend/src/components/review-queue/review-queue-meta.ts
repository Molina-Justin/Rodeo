import type { Difficulty } from "@/types"

export type DueTone = "overdue" | "today" | "upcoming"

export interface DueToneColors {
  dot: string
  badge: string
  badgeText: string
  text: string
  label: string
}

export const DUE_TONES: Record<DueTone, DueToneColors> = {
  overdue: {
    dot: "bg-orange-500",
    badge: "bg-orange-500",
    badgeText: "text-orange-950",
    text: "text-orange-700 dark:text-orange-400",
    label: "Overdue",
  },
  today: {
    dot: "bg-indigo-500",
    badge: "bg-indigo-500",
    badgeText: "text-indigo-950",
    text: "text-indigo-700 dark:text-indigo-400",
    label: "Due today",
  },
  upcoming: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-500",
    badgeText: "text-emerald-950",
    text: "text-muted-foreground",
    label: "Upcoming",
  },
}

export function dueTone(dueInDays: number): DueTone {
  if (dueInDays < 0) return "overdue"
  if (dueInDays === 0) return "today"
  return "upcoming"
}

export function dueLabel(dueInDays: number): string {
  if (dueInDays < 0) return `${Math.abs(dueInDays)}d late`
  if (dueInDays === 0) return "Today"
  if (dueInDays === 1) return "Tomorrow"
  return `In ${dueInDays}d`
}

export function rationale(
  dueInDays: number,
  lapses: number,
  intervalDays: number
): string {
  if (dueInDays < 0) {
    return `${lapses} ${lapses === 1 ? "lapse" : "lapses"}. Looking up a solution resets the interval to one day.`
  }

  if (dueInDays === 0) {
    return `Back on a ${intervalDays}-day interval. A clean pass multiplies it by 2.5.`
  }

  return "Not due yet. Reviewing early costs you the spacing effect."
}

export const DIFFICULTY_BADGE: Record<Difficulty, string> = {
  easy: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  hard: "bg-destructive/10 text-destructive",
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
}

export interface QueueRange {
  value: string
  label: string
  days: number
}

export const QUEUE_RANGES: QueueRange[] = [
  { value: "today", label: "Today", days: 0 },
  { value: "7", label: "7d", days: 7 },
  { value: "30", label: "30d", days: 30 },
]
