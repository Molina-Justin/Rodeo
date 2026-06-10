import * as React from "react"
import { CheckCheckIcon, ListChecksIcon } from "lucide-react"

import { ReviewLeadCard } from "@/components/review-queue/review-lead-card"
import {
  ReviewQueueList,
  type QueueItem,
} from "@/components/review-queue/review-queue-list"
import { QUEUE_RANGES } from "@/components/review-queue/review-queue-meta"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { useAllProblems } from "@/hooks/use-problems"
import { useAttempts } from "@/hooks/use-attempts"
import { buildReviewStates } from "@/lib/dashboard"
import { useAppStore } from "@/store/use-app-store"

export function ReviewQueuePage() {
  const attemptsQuery = useAttempts()
  const attempts = React.useMemo(
    () => attemptsQuery.data ?? [],
    [attemptsQuery.data]
  )
  const setCurrentView = useAppStore((state) => state.setCurrentView)
  const { problems, status } = useAllProblems()

  const [range, setRange] = React.useState("30")
  const [search, setSearch] = React.useState("")
  const [topicIndex, setTopicIndex] = React.useState(0)
  const [sortDue, setSortDue] = React.useState(true)
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const [started, setStarted] = React.useState(false)

  const catalog = React.useMemo(
    () => new Map(problems.map((problem) => [problem.id, problem])),
    [problems]
  )

  const allStates = React.useMemo(() => buildReviewStates(attempts), [attempts])

  const topics = React.useMemo(() => {
    const set = new Set<string>()
    for (const state of allStates) {
      const problem = catalog.get(state.problemId)
      if (problem) {
        for (const topic of problem.topics) {
          set.add(topic)
        }
      }
    }
    return ["All topics", ...Array.from(set).sort()]
  }, [allStates, catalog])

  const currentTopic = topics[topicIndex] ?? "All topics"

  const visibleItems: QueueItem[] = React.useMemo(() => {
    const maxDays = QUEUE_RANGES.find((r) => r.value === range)?.days ?? 30
    const needle = search.trim().toLowerCase()

    const filtered = allStates.filter((state) => {
      const problem = catalog.get(state.problemId)
      if (!problem) return false
      if (state.dueInDays === null) return false
      if (state.dueInDays > maxDays) return false
      if (topicIndex > 0 && !problem.topics.includes(currentTopic)) {
        return false
      }
      if (
        needle &&
        !problem.title.toLowerCase().includes(needle) &&
        !String(state.problemId).includes(needle)
      ) {
        return false
      }
      return true
    })

    const items: QueueItem[] = filtered.flatMap((state) => {
      const problem = catalog.get(state.problemId)
      if (!problem || state.dueInDays === null) return []
      return [{ ...state, dueInDays: state.dueInDays, problem }]
    })

    return items.sort((a, b) =>
      sortDue
        ? a.dueInDays - b.dueInDays
        : b.lapses - a.lapses || a.dueInDays - b.dueInDays
    )
  }, [allStates, catalog, range, search, topicIndex, currentTopic, sortDue])

  const dueCount = allStates.filter(
    (state) => state.dueInDays !== null && state.dueInDays <= 0
  ).length
  const lateCount = allStates.filter(
    (state) => state.dueInDays !== null && state.dueInDays < 0
  ).length
  const todayCount = allStates.filter((state) => state.dueInDays === 0).length

  // Auto-select the first item when visible items change and nothing is selected
  const effectiveSelectedId =
    selectedId !== null &&
    visibleItems.some((item) => item.problemId === selectedId)
      ? selectedId
      : (visibleItems[0]?.problemId ?? null)

  const selectedState = visibleItems.find(
    (state) => state.problemId === effectiveSelectedId
  )
  const selectedProblem = selectedState?.problem

  const handleSelect = (problemId: number) => {
    setSelectedId(problemId)
    setStarted(false)
  }

  const handleSkip = () => {
    const currentIndex = visibleItems.findIndex(
      (item) => item.problemId === effectiveSelectedId
    )
    const next = visibleItems[(currentIndex + 1) % visibleItems.length]
    if (next) {
      setSelectedId(next.problemId)
      setStarted(false)
    }
  }

  const handleCycleTopic = () => {
    setTopicIndex((current) => (current + 1) % topics.length)
  }

  if (status === "loading" || attemptsQuery.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  const isEmpty = allStates.every((state) => state.dueInDays === null)

  if (isEmpty) {
    return (
      <section className="flex flex-col gap-3.5">
        <div className="flex items-center gap-3.5">
          <h3 className="text-base font-bold tracking-tight">Review queue</h3>
          <span className="h-px flex-1 bg-border/60" />
          <span className="font-mono text-xs tracking-tight text-muted-foreground">
            nothing due
          </span>
        </div>
        <Empty className="min-h-85 border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia>
              <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <CheckCheckIcon className="size-5" />
              </span>
            </EmptyMedia>
            <EmptyTitle className="text-sm font-semibold">
              Queue is clear
            </EmptyTitle>
            <EmptyDescription className="max-w-72 text-xs leading-relaxed">
              Reviews are scheduled from the attempts you log. Log a problem to
              see it appear here on its next review date.
            </EmptyDescription>
          </EmptyHeader>
          <Button
            variant="outline"
            onClick={() => setCurrentView("problems")}
            className="mt-3 h-10 cursor-pointer rounded-xl border-border/80 bg-muted/40 font-semibold text-foreground hover:bg-muted"
          >
            <ListChecksIcon className="size-4" />
            Browse problems
          </Button>
        </Empty>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {selectedState && selectedProblem ? (
        <section className="flex flex-col gap-3.5">
          <div className="flex items-center gap-3.5">
            <h3 className="text-base font-bold tracking-tight">Review next</h3>
            <span className="h-px flex-1 bg-border/60" />
            <span className="font-mono text-xs tracking-tight text-muted-foreground">
              ordered by due date
            </span>
          </div>

          <ReviewLeadCard
            state={selectedState}
            problem={selectedProblem}
            lateCount={lateCount}
            todayCount={todayCount}
            started={started}
            dueCount={dueCount}
            onStartToggle={() => setStarted((current) => !current)}
            onSkip={handleSkip}
          />

          <div className="flex flex-wrap gap-5 px-1 font-mono text-2xs tracking-wider text-muted-foreground uppercase">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-orange-500" />
              Overdue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-indigo-500" />
              Due today
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Upcoming
            </span>
          </div>
        </section>
      ) : null}

      <ReviewQueueList
        items={visibleItems}
        selectedId={effectiveSelectedId}
        range={range}
        search={search}
        topicLabel={topicIndex === 0 ? "Filter" : currentTopic}
        topicFiltered={topicIndex > 0}
        sortLabel={sortDue ? "Due date" : "Most lapses"}
        dueCount={dueCount}
        onSelect={handleSelect}
        onRangeChange={setRange}
        onSearchChange={setSearch}
        onCycleTopic={handleCycleTopic}
        onToggleSort={() => setSortDue((current) => !current)}
        onStartReview={() => setStarted((current) => !current)}
      />
    </div>
  )
}
