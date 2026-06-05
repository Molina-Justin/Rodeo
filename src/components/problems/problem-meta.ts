import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  type LucideIcon,
} from "lucide-react"

import type { Difficulty, ProblemStatus } from "@/types"

export const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  easy: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  hard: "bg-destructive/10 text-destructive",
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
}

export const STATUS_META: Record<
  ProblemStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  "not-started": {
    label: "Not started",
    icon: CircleDashedIcon,
    className: "text-muted-foreground",
  },
  solved: {
    label: "Solved",
    icon: CircleCheckIcon,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  review: {
    label: "Review",
    icon: CircleDotIcon,
    className: "text-amber-600 dark:text-amber-400",
  },
  struggling: {
    label: "Struggling",
    icon: CircleAlertIcon,
    className: "text-destructive",
  },
}
