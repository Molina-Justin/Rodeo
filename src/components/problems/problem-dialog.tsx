import { LockIcon } from "lucide-react"

import {
  DIFFICULTY_LABELS,
  DIFFICULTY_STYLES,
  STATUS_META,
} from "@/components/problems/problem-meta"
import { ProblemTimer } from "@/components/problems/problem-timer"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import {
  OUTCOME_LABELS,
  deriveStatus,
  formatDuration,
  formatElapsed,
} from "@/lib/attempts"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/use-app-store"
import type { Attempt, Problem, ProblemStatus } from "@/types"

const dotStyles: Record<ProblemStatus, string> = {
  "not-started": "bg-muted-foreground/40",
  solved: "bg-emerald-500",
  review: "bg-amber-500",
  struggling: "bg-destructive",
}

function AttemptRow({ attempt }: { attempt: Attempt }) {
  const status = deriveStatus(attempt)

  return (
    <li className="flex items-center gap-4 rounded-lg bg-muted/50 px-4 py-3 text-sm">
      <span className={cn("size-2 shrink-0 rounded-full", dotStyles[status])} />
      <span className="w-16 font-mono text-xs text-muted-foreground">
        {formatElapsed(attempt.completedAt)}
      </span>
      <span className="w-12 tabular-nums">
        {formatDuration(attempt.durationMinutes)}
      </span>
      <span className="text-muted-foreground">
        {OUTCOME_LABELS[attempt.outcome]}
      </span>
    </li>
  )
}

interface ProblemDialogProps {
  problem: Problem | null
  onOpenChange: (open: boolean) => void
}

export function ProblemDialog({ problem, onOpenChange }: ProblemDialogProps) {
  const attempts = useAppStore((state) => state.attempts)

  if (!problem) {
    return null
  }

  const problemAttempts = attempts
    .filter((attempt) => attempt.problemId === problem.id)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))

  const status = deriveStatus(problemAttempts[0])
  const { label: statusLabel, icon: StatusIcon, className: statusClass } =
    STATUS_META[status]

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="gap-4 p-5">
          <div className="flex flex-col gap-3">
            <DialogTitle className="flex items-baseline gap-2 leading-snug">
              <span className="font-mono text-xs text-muted-foreground">
                #{problem.id}
              </span>
              {problem.title}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Badge
                className={cn("rounded-md font-medium", DIFFICULTY_STYLES[problem.difficulty])}
              >
                {DIFFICULTY_LABELS[problem.difficulty]}
              </Badge>
              <Badge
                variant="secondary"
                className="rounded-md font-normal"
              >
                {problemAttempts.length}{" "}
                {problemAttempts.length === 1 ? "attempt" : "attempts"}
              </Badge>
              <Badge
                variant="outline"
                className={cn("gap-1.5 rounded-md font-normal", statusClass)}
              >
                <StatusIcon className="size-3.5" />
                {statusLabel}
              </Badge>
              {problem.premium ? (
                <Badge
                  variant="outline"
                  className="gap-1.5 rounded-md font-normal text-amber-600 dark:text-amber-400"
                >
                  <LockIcon className="size-3.5" />
                  Premium
                </Badge>
              ) : null}
            </DialogDescription>
          </div>

          <ProblemTimer problem={problem} />
        </DialogHeader>

        <Separator />

        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Attempt history</h3>
            <span className="text-xs text-muted-foreground">
              {problemAttempts.length}{" "}
              {problemAttempts.length === 1 ? "attempt" : "attempts"}
            </span>
          </div>
          {problemAttempts.length === 0 ? (
            <p className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              No attempts logged yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {problemAttempts.map((attempt) => (
                <AttemptRow key={attempt.completedAt} attempt={attempt} />
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
