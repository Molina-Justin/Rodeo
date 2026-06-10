import { PauseIcon, PlayIcon, SkipForwardIcon } from "lucide-react"

import {
  DIFFICULTY_LABELS,
  DUE_TONES,
  dueTone,
  rationale,
} from "@/components/review-queue/review-queue-meta"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { BLOCKER_LABELS } from "@/lib/attempts"
import { TARGET_MINUTES, type ReviewState } from "@/lib/dashboard"
import { cn } from "@/lib/utils"
import type { Problem } from "@/types"

const MICRO = "font-mono text-2xs tracking-widest text-background/50 uppercase"

interface ReviewLeadCardProps {
  state: ReviewState & { dueInDays: number }
  problem: Problem
  lateCount: number
  todayCount: number
  started: boolean
  dueCount: number
  onStartToggle: () => void
  onSkip: () => void
}

function StatTile({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-foreground px-4 py-3.5">
      <span className={MICRO}>{label}</span>
      {children}
    </div>
  )
}

function StatValue({
  value,
  caption,
  captionClassName,
}: {
  value: string
  caption: string
  captionClassName?: string
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-2xl font-bold tracking-tight tabular-nums">
        {value}
      </span>
      <span
        className={cn("font-mono text-xs text-background/55", captionClassName)}
      >
        {caption}
      </span>
    </span>
  )
}

export function ReviewLeadCard({
  state,
  problem,
  lateCount,
  todayCount,
  started,
  dueCount,
  onStartToggle,
  onSkip,
}: ReviewLeadCardProps) {
  const tone = dueTone(state.dueInDays)
  const colors = DUE_TONES[tone]
  const duration = state.lastAttempt.durationMinutes
  const overTarget = duration > TARGET_MINUTES
  const delta = Math.abs(duration - TARGET_MINUTES)
  const pacePercent = Math.min(100, Math.round((duration / 75) * 100))
  const daysSinceLastAttempt = state.intervalDays - state.dueInDays
  const blocker = state.lastAttempt.blocker
  const difficulty = problem.difficulty
  const topic = problem.topics[0] ?? "General"

  return (
    <Card className="gap-0 overflow-hidden rounded-2xl bg-foreground p-0 text-background shadow-lg ring-0">
      <div className="flex flex-wrap gap-8 p-7 sm:p-8">
        <div
          className="flex min-w-0 flex-1 flex-col gap-5"
          style={{ flexBasis: "430px" }}
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge
              className={cn(
                "h-5.5 rounded-md px-2.5 font-mono text-2xs font-bold tracking-widest uppercase",
                colors.badge,
                colors.badgeText
              )}
            >
              {colors.label}
            </Badge>
            <span className={MICRO}>
              {lateCount} late · {todayCount} due today · spaced repetition
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-3xl leading-none font-extrabold tracking-tighter text-balance sm:text-4xl">
              {problem.title}
            </h2>
            <p className="max-w-prose text-sm leading-relaxed text-pretty text-background/70 sm:text-base">
              {rationale(state.dueInDays, state.lapses, state.intervalDays)}
            </p>
          </div>

          <div className="grid gap-px overflow-hidden rounded-xl bg-background/15 sm:grid-cols-3">
            <StatTile label="Time to solve">
              <StatValue
                value={`${duration}m`}
                caption={`${delta}m ${overTarget ? "over" : "under"} target`}
                captionClassName={overTarget ? "text-orange-400" : undefined}
              />
              <span className="flex h-1 overflow-hidden rounded-full bg-background/15">
                <span
                  className={cn(
                    "h-full",
                    overTarget ? "bg-orange-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${pacePercent}%` }}
                />
              </span>
            </StatTile>

            <StatTile label="What tripped you up">
              <StatValue
                value={String(state.lapses)}
                caption={`${state.lapses === 1 ? "lapse" : "lapses"} in ${state.attemptCount} attempts`}
              />
              <span className="text-xs text-background/80">
                {blocker !== "none"
                  ? BLOCKER_LABELS[blocker]
                  : "No repeated sticking point"}
              </span>
            </StatTile>

            <StatTile label="Last seen">
              <StatValue
                value={`${daysSinceLastAttempt}d ago`}
                caption={state.lastAttempt.outcome}
              />
              <span className="text-xs text-background/80">
                {DIFFICULTY_LABELS[difficulty]} · {topic}
              </span>
            </StatTile>
          </div>
        </div>

        <div
          className="flex shrink-0 flex-col justify-center gap-2.5"
          style={{ flexBasis: "300px" }}
        >
          <div className="flex items-center gap-2.5">
            <Button
              onClick={onStartToggle}
              className="h-12 min-w-0 flex-1 cursor-pointer rounded-xl bg-background font-semibold text-foreground hover:bg-background/90"
            >
              {started ? (
                <PauseIcon className="size-4" />
              ) : (
                <PlayIcon className="size-4" />
              )}
              {started
                ? "Session running · 00:00"
                : `Start review · ${dueCount}`}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onSkip}
              title="Skip to next"
              aria-label="Skip to next"
              className="size-12 shrink-0 cursor-pointer rounded-xl border-background/20 bg-transparent text-background hover:bg-background/10 hover:text-background"
            >
              <SkipForwardIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
