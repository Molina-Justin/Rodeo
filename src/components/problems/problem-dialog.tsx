import { ExternalLinkIcon, LockIcon, TagIcon, TimerIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { problemUrl } from "@/lib/problems"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/use-app-store"
import type { Problem } from "@/types"
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_STYLES,
  STATUS_META,
} from "@/components/problems/problem-meta"

interface ProblemDialogProps {
  problem: Problem | null
  onOpenChange: (open: boolean) => void
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  )
}

export function ProblemDialog({ problem, onOpenChange }: ProblemDialogProps) {
  const attempts = useAppStore((state) => state.attempts)

  if (!problem) {
    return null
  }

  const problemAttempts = attempts
    .filter((attempt) => attempt.problemId === problem.id)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))

  const latest = problemAttempts[0]
  const status = deriveStatus(latest)
  const { label: statusLabel, icon: StatusIcon, className: statusClass } =
    STATUS_META[status]

  const totalMinutes = problemAttempts.reduce(
    (total, attempt) => total + attempt.durationMinutes,
    0
  )

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-6 sm:max-w-lg">
        <DialogHeader className="gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-sky-700/80 dark:text-sky-300/80">
              #{problem.id}
            </span>
            <Badge
              className={cn(
                "rounded-md font-medium",
                DIFFICULTY_STYLES[problem.difficulty]
              )}
            >
              {DIFFICULTY_LABELS[problem.difficulty]}
            </Badge>
            {problem.premium ? (
              <Badge
                variant="outline"
                className="gap-1 rounded-md font-normal text-amber-600 dark:text-amber-400"
              >
                <LockIcon className="size-3" />
                Premium
              </Badge>
            ) : null}
          </div>
          <DialogTitle className="text-xl leading-snug">
            {problem.title}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <StatusIcon className={cn("size-4", statusClass)} />
            <span className={statusClass}>{statusLabel}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4">
          <Stat label="Acceptance">{problem.acceptance.toFixed(1)}%</Stat>
          <Stat label="Attempts">{problemAttempts.length}</Stat>
          <Stat label="Time invested">
            {totalMinutes === 0 ? "—" : formatDuration(totalMinutes)}
          </Stat>
        </div>

        {problem.topics.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <TagIcon className="size-3.5 text-violet-600 dark:text-violet-400" />
              Topics
            </span>
            <div className="flex flex-wrap gap-1.5">
              {problem.topics.map((topic) => (
                <Badge
                  key={topic}
                  variant="outline"
                  className="rounded-md border-violet-500/20 bg-violet-500/10 font-normal text-violet-700 dark:text-violet-300"
                >
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        <Separator />

        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <TimerIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            Attempt history
          </span>
          {problemAttempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No attempts logged yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {problemAttempts.map((attempt) => (
                <li
                  key={attempt.completedAt}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span>{formatElapsed(attempt.completedAt)}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="tabular-nums">
                      {formatDuration(attempt.durationMinutes)}
                    </span>
                    <span>·</span>
                    <span>{OUTCOME_LABELS[attempt.outcome]}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-lg"
            render={
              <a href={problemUrl(problem)} target="_blank" rel="noreferrer" />
            }
          >
            <ExternalLinkIcon />
            Open on LeetCode
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
