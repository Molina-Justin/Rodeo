import { ArrowLeftIcon, PencilIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  BLOCKER_LABELS,
  EFFORT_LABELS,
  OUTCOME_LABELS,
  durationDelta,
  formatDuration,
  formatElapsed,
} from "@/lib/attempts"
import { renderMarkdown } from "@/lib/markdown"
import { cn } from "@/lib/utils"
import type { Attempt, AttemptOutcome } from "@/types"

const outcomeStyles: Record<AttemptOutcome, string> = {
  optimal: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  hint: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  solution: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  failed: "bg-destructive/10 text-destructive",
}

function formatFullDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function Detail({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

interface AttemptReportProps {
  attempt: Attempt
  previous: Attempt | undefined
  onBack: () => void
  onEdit: () => void
}

export function AttemptReport({
  attempt,
  previous,
  onBack,
  onEdit,
}: AttemptReportProps) {
  const delta = durationDelta(attempt, previous)

  return (
    <div className="-mx-5 -mb-1 flex flex-col border-y border-border">
      <div className="flex items-center justify-between gap-3 px-6 pt-4">
        <span className="text-sm font-medium">Attempt report</span>
        <span className="text-xs text-muted-foreground">
          {formatElapsed(attempt.completedAt)}
        </span>
      </div>

      <div className="flex flex-col gap-5 px-6 py-5">
        <div className="grid grid-cols-2 gap-5">
          <Detail label="Date">{formatFullDate(attempt.completedAt)}</Detail>
          <Detail label="Time spent">
            <span className="tabular-nums">
              {formatDuration(attempt.durationMinutes)}
            </span>
            {delta === undefined ? null : (
              <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                {delta === 0
                  ? "same as previous"
                  : `${delta < 0 ? "-" : "+"}${formatDuration(Math.abs(delta))} vs previous`}
              </span>
            )}
          </Detail>
          <Detail label="Help needed">
            <Badge
              className={cn(
                "rounded-md font-medium",
                outcomeStyles[attempt.outcome]
              )}
            >
              {OUTCOME_LABELS[attempt.outcome]}
            </Badge>
          </Detail>
          <Detail label="Effort">{EFFORT_LABELS[attempt.effort]}</Detail>
        </div>

        <Detail label="Sticking point">
          {BLOCKER_LABELS[attempt.blocker]}
        </Detail>

        <Detail label="Notes">
          {attempt.notes.trim() === "" ? (
            <span className="text-muted-foreground">No notes recorded.</span>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5">
              {renderMarkdown(attempt.notes)}
            </div>
          )}
        </Detail>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/40 px-6 py-4">
        <Button
          type="button"
          variant="ghost"
          className="rounded-lg"
          onClick={onBack}
        >
          <ArrowLeftIcon />
          Back
        </Button>
        <Button type="button" className="rounded-lg" onClick={onEdit}>
          <PencilIcon />
          Edit attempt
        </Button>
      </div>
    </div>
  )
}
