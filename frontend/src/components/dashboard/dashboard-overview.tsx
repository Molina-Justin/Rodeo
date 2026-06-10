import * as React from "react"
import { TriangleAlertIcon } from "lucide-react"

import { ConsistencyCard } from "@/components/dashboard/consistency-card"
import { CycleStats } from "@/components/dashboard/cycle-stats"
import {
  RANGE_OPTIONS,
  type RangeOptionValue,
} from "@/components/dashboard/dashboard-meta"
import { InterviewReadinessCard } from "@/components/dashboard/interview-readiness-card"
import { StudyCard } from "@/components/dashboard/study-card"
import { TimePerDifficultyCard } from "@/components/dashboard/time-per-difficulty-card"
import { TopicMasteryCard } from "@/components/dashboard/topic-mastery-card"
import { ProblemDialog } from "@/components/problems/problem-dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAllProblems } from "@/hooks/use-problems"
import { useAttempts } from "@/hooks/use-attempts"
import { TARGET_MINUTES, TARGET_SCORE, buildDashboard } from "@/lib/dashboard"
import type { SessionContext } from "@/lib/session-prompt"
import type { Problem } from "@/types"

const DEFAULT_RANGE: RangeOptionValue = "90"

export function DashboardOverview() {
  const { problems, status } = useAllProblems()
  const attemptsQuery = useAttempts()
  const attempts = React.useMemo(
    () => attemptsQuery.data ?? [],
    [attemptsQuery.data]
  )

  const [rangeKey, setRangeKey] =
    React.useState<RangeOptionValue>(DEFAULT_RANGE)
  const [selectedProblem, setSelectedProblem] = React.useState<Problem | null>(
    null
  )

  const rangeDays =
    RANGE_OPTIONS.find((option) => option.value === rangeKey)?.days ?? 90

  // Every card reads from this one pass; nothing recomputes the same window twice.
  const dashboard = React.useMemo(
    () => buildDashboard(problems, attempts, new Date(), rangeDays),
    [problems, attempts, rangeDays]
  )

  const sessionContext: SessionContext = {
    readinessScore: dashboard.readiness.score,
    streak: dashboard.consistency.streak,
    targetScore: TARGET_SCORE,
    targetMinutes: TARGET_MINUTES,
  }

  if (status === "error" || attemptsQuery.isError) {
    return (
      <Empty className="min-h-64 border border-dashed border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon />
          </EmptyMedia>
          <EmptyTitle>Catalog unavailable</EmptyTitle>
          <EmptyDescription>
            The local dashboard data could not be read from the Rodeo API.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (status === "loading" || attemptsQuery.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex justify-end">
          <Skeleton className="h-8.5 w-44 rounded-xl" />
        </div>
        <Skeleton className="h-56 w-full rounded-3xl" />
        <div className="grid gap-3.5 xl:grid-cols-5">
          <Skeleton className="h-48 rounded-2xl xl:col-span-3" />
          <div className="grid gap-3.5 sm:grid-cols-2 xl:col-span-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-22 rounded-2xl" />
            ))}
          </div>
        </div>
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3.5">
        <div className="flex items-center gap-3.5">
          <h3 className="text-base font-bold tracking-tight">Study next</h3>
          <span className="h-px flex-1 bg-border/60" />
          <span className="font-mono text-xs tracking-tight text-muted-foreground">
            ranked by mastery gap
          </span>
        </div>

        <StudyCard focuses={dashboard.focuses} context={sessionContext} />
      </section>

      <section className="flex flex-col gap-3.5">
        <div className="flex items-center gap-3.5">
          <h3 className="text-base font-bold tracking-tight">This cycle</h3>
          <span className="h-px flex-1 bg-border/60" />
          <ToggleGroup
            value={[rangeKey]}
            onValueChange={(value) => {
              const [next] = value

              if (next) {
                setRangeKey(next as RangeOptionValue)
              }
            }}
            className="h-8.5 rounded-xl border border-border/50 bg-muted/60 p-0.5"
          >
            {RANGE_OPTIONS.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                className="h-7 cursor-pointer rounded-lg px-3 font-mono text-xs font-medium text-muted-foreground transition-[background-color,color,box-shadow] hover:bg-background/80 hover:text-foreground aria-pressed:bg-foreground aria-pressed:font-semibold aria-pressed:text-background aria-pressed:shadow-sm aria-pressed:ring-1 aria-pressed:ring-foreground/20"
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* The range control drives both halves, so they share one row. */}
        <div className="grid gap-3.5 xl:grid-cols-5">
          <ConsistencyCard
            consistency={dashboard.consistency}
            rangeDays={rangeDays}
            className="xl:col-span-3"
          />
          <CycleStats stats={dashboard.summary} className="xl:col-span-2" />
        </div>
      </section>

      <div className="grid items-stretch gap-6 xl:grid-cols-3">
        <TimePerDifficultyCard attempts={attempts} problems={problems} />
        <TopicMasteryCard mastery={dashboard.mastery} />
        <InterviewReadinessCard readiness={dashboard.readiness} />
      </div>

      <ProblemDialog
        problem={selectedProblem}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedProblem(null)
          }
        }}
      />
    </div>
  )
}
