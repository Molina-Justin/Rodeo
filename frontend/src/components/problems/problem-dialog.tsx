import * as React from "react"
import { LockIcon } from "lucide-react"

import {
  DIFFICULTY_LABELS,
  DIFFICULTY_STYLES,
  STATUS_META,
} from "@/components/problems/problem-meta"
import { AttemptForm } from "@/components/problems/attempt-form"
import { AttemptHistory } from "@/components/problems/attempt-history"
import { AttemptReport } from "@/components/problems/attempt-report"
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
import type { Attempt, AttemptDraft, Problem } from "@/types"

interface ProblemDialogProps {
  problem: Problem | null
  onOpenChange: (open: boolean) => void
}

type View =
  | { kind: "overview" }
  | { kind: "report"; attemptId: string }
  | { kind: "edit"; attemptId: string }

export function ProblemDialog({ problem, onOpenChange }: ProblemDialogProps) {
  const attempts = useAppStore((state) => state.attempts)
  const logAttempt = useAppStore((state) => state.logAttempt)
  const updateAttempt = useAppStore((state) => state.updateAttempt)
  const [view, setView] = React.useState<View>({ kind: "overview" })
  const [logDurationMinutes, setLogDurationMinutes] = React.useState<
    number | null
  >(null)
  const [timerKey, setTimerKey] = React.useState(0)
  const [sessionInProgress, setSessionInProgress] = React.useState(false)
  const [pendingAudioUrl, setPendingAudioUrl] = React.useState<string>()

  React.useEffect(() => {
    setView({ kind: "overview" })
    setLogDurationMinutes(null)
    setTimerKey(0)
    setSessionInProgress(false)
    setPendingAudioUrl(undefined)
  }, [problem?.id])

  const discardPendingAudio = () => {
    if (pendingAudioUrl) {
      URL.revokeObjectURL(pendingAudioUrl)
    }
    setPendingAudioUrl(undefined)
  }

  if (!problem) {
    return null
  }

  const problemAttempts = attempts
    .filter((attempt) => attempt.problemId === problem.id)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))

  const selectedIndex =
    view.kind === "overview"
      ? -1
      : problemAttempts.findIndex((attempt) => attempt.id === view.attemptId)
  const selectedAttempt =
    selectedIndex === -1 ? undefined : problemAttempts[selectedIndex]
  const previousAttempt =
    selectedIndex === -1 ? undefined : problemAttempts[selectedIndex + 1]

  const status = deriveStatus(problemAttempts[0])
  const {
    label: statusLabel,
    icon: StatusIcon,
    className: statusClass,
  } = STATUS_META[status]

  return (
    <>
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent className="max-h-svh gap-0 overflow-y-auto p-0 sm:max-w-xl">
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
                  className={cn(
                    "rounded-md font-medium",
                    DIFFICULTY_STYLES[problem.difficulty]
                  )}
                >
                  {DIFFICULTY_LABELS[problem.difficulty]}
                </Badge>
                <Badge variant="secondary" className="rounded-md font-normal">
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

            {view.kind === "overview" ? (
              <ProblemTimer
                key={timerKey}
                problem={problem}
                onStopAndLog={(durationMinutes, audioUrl) => {
                  setLogDurationMinutes(durationMinutes)
                  setPendingAudioUrl(audioUrl)
                }}
                onSessionInProgressChange={setSessionInProgress}
              />
            ) : null}

            {selectedAttempt && view.kind === "report" ? (
              <AttemptReport
                attempt={selectedAttempt}
                previous={previousAttempt}
                onBack={() => setView({ kind: "overview" })}
                onEdit={() =>
                  setView({ kind: "edit", attemptId: selectedAttempt.id })
                }
              />
            ) : null}

            {selectedAttempt && view.kind === "edit" ? (
              <div className="-mx-5 -mb-1 flex flex-col border-y border-border">
                <div className="flex items-baseline justify-between gap-3 px-6 pt-4">
                  <span className="text-sm font-medium">Edit attempt</span>
                </div>
                <AttemptForm
                  problemId={problem.id}
                  elapsedMinutes={selectedAttempt.durationMinutes}
                  attempt={selectedAttempt}
                  submitLabel="Save changes"
                  onSave={(draft: AttemptDraft) => {
                    updateAttempt(selectedAttempt.id, draft)
                    setView({ kind: "report", attemptId: selectedAttempt.id })
                  }}
                  onCancel={() =>
                    setView({ kind: "report", attemptId: selectedAttempt.id })
                  }
                />
              </div>
            ) : null}
          </DialogHeader>

          {view.kind === "overview" && !sessionInProgress ? (
            <>
              <Separator />
              <div className="flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Attempt history</h3>
                  <span className="text-xs text-muted-foreground">
                    {problemAttempts.length}{" "}
                    {problemAttempts.length === 1 ? "attempt" : "attempts"}
                  </span>
                </div>
                <AttemptHistory
                  attempts={problemAttempts}
                  onOpenReport={(attempt: Attempt) =>
                    setView({ kind: "report", attemptId: attempt.id })
                  }
                />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={logDurationMinutes !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLogDurationMinutes(null)
            discardPendingAudio()
          }
        }}
      >
        <DialogContent className="max-h-svh gap-0 overflow-y-auto p-0 sm:max-w-xl">
          <DialogHeader className="gap-1.5 p-5 pb-4">
            <DialogTitle>Log this attempt</DialogTitle>
            <DialogDescription>
              Record how the problem went while the details are fresh.
            </DialogDescription>
          </DialogHeader>
          <AttemptForm
            problemId={problem.id}
            elapsedMinutes={logDurationMinutes ?? 1}
            audioUrl={pendingAudioUrl}
            onSave={(draft: AttemptDraft) => {
              logAttempt({ ...draft, audioUrl: pendingAudioUrl })
              setLogDurationMinutes(null)
              setPendingAudioUrl(undefined)
              setSessionInProgress(false)
              setTimerKey((current) => current + 1)
            }}
            onCancel={() => {
              setLogDurationMinutes(null)
              discardPendingAudio()
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
