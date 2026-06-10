import { FileTextIcon, MicIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  EFFORT_LABELS,
  OUTCOME_LABELS,
  deriveStatus,
  formatDuration,
  formatElapsed,
} from "@/lib/attempts"
import { cn } from "@/lib/utils"
import type { Attempt, AttemptOutcome, ProblemStatus } from "@/types"

const detailClass = "text-xs text-muted-foreground"

const dotStyles: Record<ProblemStatus, string> = {
  "not-started": "bg-muted-foreground/40",
  solved: "bg-emerald-500",
  review: "bg-amber-500",
  struggling: "bg-destructive",
}

const outcomeStyles: Record<AttemptOutcome, string> = {
  optimal: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  hint: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  solution: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  failed: "bg-destructive/10 text-destructive",
}

/** Attempts arrive newest first. */
export function AttemptHistory({
  attempts,
  onOpenReport,
}: {
  attempts: Attempt[]
  onOpenReport: (attempt: Attempt) => void
}) {
  if (attempts.length === 0) {
    return (
      <p className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        No attempts logged yet. Start the timer above to record one.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {attempts.map((attempt) => (
        <AttemptRow
          key={attempt.id}
          attempt={attempt}
          onOpenReport={() => onOpenReport(attempt)}
        />
      ))}
    </ul>
  )
}

function AttemptRow({
  attempt,
  onOpenReport,
}: {
  attempt: Attempt
  onOpenReport: () => void
}) {
  const status = deriveStatus(attempt)
  const hasNotes = attempt.notes.trim() !== ""

  return (
    <li>
      <button
        type="button"
        onClick={onOpenReport}
        className="flex w-full items-center gap-3 rounded-lg border border-border px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
      >
        <span
          className={cn("size-2 shrink-0 rounded-full", dotStyles[status])}
        />
        <span className="w-16 font-mono text-xs text-muted-foreground">
          {formatElapsed(attempt.completedAt)}
        </span>
        <Badge
          className={cn(
            "rounded-md font-medium",
            outcomeStyles[attempt.outcome]
          )}
        >
          {OUTCOME_LABELS[attempt.outcome]}
        </Badge>
        <span className={detailClass}>{EFFORT_LABELS[attempt.effort]}</span>
        {hasNotes ? (
          <FileTextIcon className="size-3.5 text-muted-foreground" />
        ) : null}
        {attempt.audioUrl ? (
          <MicIcon className="size-3.5 text-violet-600 dark:text-violet-400" />
        ) : null}
        <span className="ml-auto tabular-nums">
          {formatDuration(attempt.durationMinutes)}
        </span>
        <span className="shrink-0 text-xs font-medium text-primary">
          View Attempt
        </span>
      </button>
    </li>
  )
}
