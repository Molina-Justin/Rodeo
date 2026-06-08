import * as React from "react"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDotIcon,
  CircleXIcon,
  MicIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  SquareIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { problemUrl } from "@/lib/problems"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/use-app-store"
import type { AttemptOutcome, Problem } from "@/types"

const outcomeChoices: {
  outcome: AttemptOutcome
  label: string
  icon: typeof CircleCheckIcon
  className: string
}[] = [
  {
    outcome: "optimal",
    label: "Optimal",
    icon: CircleCheckIcon,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  {
    outcome: "hint",
    label: "Hint",
    icon: CircleDotIcon,
    className: "text-amber-600 dark:text-amber-400",
  },
  {
    outcome: "solution",
    label: "Solution",
    icon: CircleAlertIcon,
    className: "text-sky-600 dark:text-sky-400",
  },
  {
    outcome: "failed",
    label: "Failed",
    icon: CircleXIcon,
    className: "text-destructive",
  },
]

function format(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds]
    .map((unit) => String(unit).padStart(2, "0"))
    .join(":")
}

export function ProblemTimer({ problem }: { problem: Problem }) {
  const logAttempt = useAppStore((state) => state.logAttempt)
  const [elapsed, setElapsed] = React.useState(0)
  const [running, setRunning] = React.useState(false)
  const [awaitingOutcome, setAwaitingOutcome] = React.useState(false)

  React.useEffect(() => {
    if (!running) {
      return
    }

    const startedAt = Date.now() - elapsed
    const interval = window.setInterval(() => {
      setElapsed(Date.now() - startedAt)
    }, 250)

    return () => {
      window.clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const idle = elapsed === 0 && !running

  const start = (openProblem: boolean) => {
    if (openProblem) {
      window.open(problemUrl(problem), "_blank", "noreferrer")
    }

    setRunning(true)
  }

  const reset = () => {
    setRunning(false)
    setAwaitingOutcome(false)
    setElapsed(0)
  }

  const save = (outcome: AttemptOutcome) => {
    logAttempt({
      problemId: problem.id,
      completedAt: new Date().toISOString(),
      durationMinutes: Math.max(1, Math.round(elapsed / 60000)),
      outcome,
    })

    reset()
  }

  return (
    <div className="flex flex-col items-center gap-5 rounded-xl border border-dashed border-border px-6 py-8">
      <span
        className={cn(
          "font-mono text-3xl tracking-tight tabular-nums",
          idle ? "text-muted-foreground/20" : "text-foreground"
        )}
      >
        {format(elapsed)}
      </span>

      {awaitingOutcome ? (
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm text-muted-foreground">How did it go?</span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {outcomeChoices.map((choice) => (
              <Button
                key={choice.outcome}
                variant="outline"
                className="rounded-lg"
                onClick={() => save(choice.outcome)}
              >
                <choice.icon className={choice.className} />
                {choice.label}
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            className="rounded-lg text-muted-foreground"
            onClick={reset}
          >
            Discard
          </Button>
        </div>
      ) : running ? (
        <div className="flex items-center gap-3">
          <Button
            className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-600/90"
            onClick={() => {
              setRunning(false)
              setAwaitingOutcome(true)
            }}
          >
            <SquareIcon />
            Stop & log
          </Button>
          <Button
            variant="outline"
            className="rounded-lg"
            onClick={() => setRunning(false)}
          >
            <PauseIcon />
            Pause
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Button
            className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-600/90"
            onClick={() => start(idle)}
          >
            <PlayIcon />
            {idle ? "Start timer & record" : "Resume"}
          </Button>
          {idle ? (
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => start(false)}
            >
              <MicIcon />
              Timer only
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="rounded-lg"
                onClick={() => setAwaitingOutcome(true)}
              >
                <SquareIcon />
                Stop & log
              </Button>
              <Button
                variant="ghost"
                className="rounded-lg text-muted-foreground"
                onClick={reset}
              >
                <RotateCcwIcon />
                Reset
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
