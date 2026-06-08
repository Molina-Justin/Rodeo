import { LockIcon } from "lucide-react"

import {
  DIFFICULTY_LABELS,
  DIFFICULTY_STYLES,
  STATUS_META,
} from "@/components/problems/problem-meta"
import { AttemptHistory } from "@/components/problems/attempt-history"
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
import { deriveStatus } from "@/lib/attempts"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/use-app-store"
import type { Problem } from "@/types"

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
          <AttemptHistory attempts={problemAttempts} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
