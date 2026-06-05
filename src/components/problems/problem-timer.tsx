import * as React from "react"
import { MicIcon, PauseIcon, PlayIcon, RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { problemUrl } from "@/lib/problems"
import { cn } from "@/lib/utils"
import type { Problem } from "@/types"

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
  const [elapsed, setElapsed] = React.useState(0)
  const [running, setRunning] = React.useState(false)

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

  return (
    <div className="flex flex-col items-center gap-6 rounded-xl border border-dashed border-border px-6 py-10">
      <span
        className={cn(
          "font-mono text-6xl tracking-tight tabular-nums",
          idle ? "text-muted-foreground/20" : "text-foreground"
        )}
      >
        {format(elapsed)}
      </span>

      {running ? (
        <div className="flex items-center gap-3">
          <Button
            size="lg"
            className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-600/90"
            onClick={() => setRunning(false)}
          >
            <PauseIcon />
            Pause
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-lg"
            onClick={() => {
              setRunning(false)
              setElapsed(0)
            }}
          >
            <RotateCcwIcon />
            Reset
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Button
            size="lg"
            className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-600/90"
            onClick={() => start(true)}
          >
            <PlayIcon />
            {idle ? "Start timer & record" : "Resume"}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-lg"
            onClick={() => start(false)}
          >
            <MicIcon />
            Timer only
          </Button>
        </div>
      )}
    </div>
  )
}
