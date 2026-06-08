import { ChevronRightIcon, FileTextIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  EFFORT_LABELS,
  OUTCOME_LABELS,
  bestDuration,
  deriveStatus,
  durationDelta,
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

function Delta({ minutes }: { minutes: number }) {
  if (minutes === 0) {
    return <span className="text-xs text-muted-foreground">even</span>
  }

  const faster = minutes < 0
  const Icon = faster ? TrendingDownIcon : TrendingUpIcon

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs tabular-nums",
        faster
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-muted-foreground"
      )}
    >
      <Icon className="size-3.5" />
      {faster ? "-" : "+"}
      {formatDuration(Math.abs(minutes))}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  )
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

  const best = bestDuration(attempts)
  const latest = attempts[0]

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-4 rounded-lg bg-muted/50 px-4 py-3">
        <Stat label="Attempts" value={String(attempts.length)} />
        <Stat
          label="Best time"
          value={best === undefined ? "—" : formatDuration(best)}
        />
        <Stat label="Last outcome" value={OUTCOME_LABELS[latest.outcome]} />
      </div>

      <ul className="flex flex-col gap-2">
        {attempts.map((attempt, index) => (
          <AttemptRow
            key={attempt.id}
            attempt={attempt}
            delta={durationDelta(attempt, attempts[index + 1])}
            onOpenReport={() => onOpenReport(attempt)}
          />
        ))}
      </ul>
    </div>
  )
}

function AttemptRow({
  attempt,
  delta,
  onOpenReport,
}: {
  attempt: Attempt
  delta: number | undefined
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
        <span className={cn("size-2 shrink-0 rounded-full", dotStyles[status])} />
        <span className="w-16 font-mono text-xs text-muted-foreground">
          {formatElapsed(attempt.completedAt)}
        </span>
        <Badge
          className={cn("rounded-md font-medium", outcomeStyles[attempt.outcome])}
        >
          {OUTCOME_LABELS[attempt.outcome]}
        </Badge>
        <span className={detailClass}>{EFFORT_LABELS[attempt.effort]}</span>
        {hasNotes ? (
          <FileTextIcon className="size-3.5 text-muted-foreground" />
        ) : null}
        <span className="ml-auto tabular-nums">
          {formatDuration(attempt.durationMinutes)}
        </span>
        <span className="w-20 text-right">
          {delta === undefined ? (
            <span className={detailClass}>first</span>
          ) : (
            <Delta minutes={delta} />
          )}
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  )
}
