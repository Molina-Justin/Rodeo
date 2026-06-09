import {
  ArrowDownUpIcon,
  CheckCheckIcon,
  ChevronRightIcon,
  FilterIcon,
  SearchIcon,
} from "lucide-react"

import {
  DIFFICULTY_BADGE,
  DIFFICULTY_LABELS,
  DUE_TONES,
  QUEUE_RANGES,
  dueLabel,
  dueTone,
  type DueTone,
} from "@/components/review-queue/review-queue-meta"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { OUTCOME_LABELS } from "@/lib/attempts"
import { formatDuration } from "@/lib/attempts"
import type { ReviewState } from "@/lib/dashboard"
import { cn } from "@/lib/utils"
import type { Problem } from "@/types"

interface QueueItem extends ReviewState {
  problem: Problem
}

interface QueueGroup {
  tone: DueTone
  label: string
  items: QueueItem[]
}

interface ReviewQueueListProps {
  items: QueueItem[]
  selectedId: number | null
  range: string
  search: string
  topicLabel: string
  topicFiltered: boolean
  sortLabel: string
  dueCount: number
  onSelect: (problemId: number) => void
  onRangeChange: (value: string) => void
  onSearchChange: (value: string) => void
  onCycleTopic: () => void
  onToggleSort: () => void
  onStartReview: () => void
}

function groupItems(items: QueueItem[]): QueueGroup[] {
  const buckets: Record<DueTone, QueueItem[]> = {
    overdue: [],
    today: [],
    upcoming: [],
  }

  for (const item of items) {
    buckets[dueTone(item.dueInDays)].push(item)
  }

  const groups: QueueGroup[] = []

  for (const tone of ["overdue", "today", "upcoming"] as DueTone[]) {
    if (buckets[tone].length > 0) {
      groups.push({
        tone,
        label: DUE_TONES[tone].label,
        items: buckets[tone],
      })
    }
  }

  return groups
}

export function ReviewQueueList({
  items,
  selectedId,
  range,
  search,
  topicLabel,
  topicFiltered,
  sortLabel,
  dueCount,
  onSelect,
  onRangeChange,
  onSearchChange,
  onCycleTopic,
  onToggleSort,
  onStartReview,
}: ReviewQueueListProps) {
  const groups = groupItems(items)
  const lateCount = items.filter((item) => item.dueInDays < 0).length

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3.5">
        <h3 className="text-base font-bold tracking-tight">The queue</h3>
        <span className="h-px flex-1 bg-border/60" />
        <ToggleGroup
          value={[range]}
          onValueChange={(value) => {
            const [next] = value
            if (next) onRangeChange(next)
          }}
          className="h-8.5 rounded-xl border border-border/50 bg-muted/60 p-0.5"
        >
          {QUEUE_RANGES.map((option) => (
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-full min-w-56 max-w-96 flex-1 items-center gap-2 rounded-lg border border-input bg-transparent px-3">
          <SearchIcon className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search the queue by title or number"
            aria-label="Search the review queue"
            className="h-full w-full min-w-0 border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <Button
          variant="outline"
          onClick={onCycleTopic}
          className="h-10 cursor-pointer gap-2 rounded-lg"
        >
          <FilterIcon className="size-4 text-indigo-500" />
          {topicLabel}
          {topicFiltered ? (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-foreground text-xs tabular-nums text-background">
              1
            </span>
          ) : null}
        </Button>

        <Button
          variant="outline"
          onClick={onToggleSort}
          className="h-10 cursor-pointer gap-2 rounded-lg"
        >
          <ArrowDownUpIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
          {sortLabel}
        </Button>

        <span className="ml-auto font-mono text-xs tracking-tight text-muted-foreground tabular-nums">
          {items.length} of {items.length} tracked
        </span>
      </div>

      {groups.map((group) => {
        const tone = DUE_TONES[group.tone]

        return (
          <div key={group.tone} className="flex flex-col gap-2.5 pt-1.5">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  tone.dot
                )}
              />
              <span
                className={cn(
                  "font-mono text-2xs font-semibold tracking-widest uppercase",
                  tone.text
                )}
              >
                {group.label}
              </span>
              <span className="font-mono text-2xs tracking-wider text-muted-foreground tabular-nums">
                {group.items.length}
              </span>
              <span className="h-px flex-1 bg-border/60" />
            </div>

            <div className="flex flex-col overflow-hidden rounded-xl border border-border">
              {group.items.map((item, index) => {
                const selected = selectedId === item.problemId
                const itemTone = dueTone(item.dueInDays)
                const itemColors = DUE_TONES[itemTone]
                const difficulty = item.problem.difficulty
                const topic = item.problem.topics[0] ?? "General"

                return (
                  <button
                    key={item.problemId}
                    type="button"
                    onClick={() => onSelect(item.problemId)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3.5 px-5 py-3 text-left transition-colors hover:bg-muted/55",
                      index > 0 && "border-t border-border/60",
                      selected
                        ? "bg-muted/70 shadow-[inset_2px_0_0_0_var(--foreground)]"
                        : "bg-card"
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                          {item.problem.title}
                        </span>
                        <Badge
                          className={cn(
                            "rounded-md font-medium",
                            DIFFICULTY_BADGE[difficulty]
                          )}
                        >
                          {DIFFICULTY_LABELS[difficulty]}
                        </Badge>
                      </span>
                      <span className="font-mono text-2xs text-muted-foreground tabular-nums">
                        #{item.problemId} · {topic} · interval{" "}
                        {item.intervalDays}d · {item.lapses}{" "}
                        {item.lapses === 1 ? "lapse" : "lapses"}
                      </span>
                    </span>

                    <span className="w-33 shrink-0 text-right font-mono text-2xs text-muted-foreground tabular-nums">
                      {formatDuration(item.lastAttempt.durationMinutes)} ·{" "}
                      {OUTCOME_LABELS[item.lastAttempt.outcome]}
                    </span>

                    <span
                      className={cn(
                        "w-20 shrink-0 text-right font-mono text-xs font-medium tabular-nums",
                        item.dueInDays <= 0 ? itemColors.text : "text-muted-foreground"
                      )}
                    >
                      {dueLabel(item.dueInDays)}
                    </span>

                    <ChevronRightIcon className="size-4 shrink-0 text-border" />
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {items.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-border text-sm text-muted-foreground">
          No reviews match these filters.
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4 pt-1">
        <p className="text-sm text-muted-foreground">
          {dueCount} due now · {lateCount} of them late
        </p>
        <Button
          variant="outline"
          onClick={onStartReview}
          className="h-10 cursor-pointer rounded-xl border-border/80 bg-muted/40 font-semibold text-foreground hover:bg-muted"
        >
          <CheckCheckIcon className="size-4" />
          Run review · {dueCount}
        </Button>
      </div>
    </section>
  )
}

export type { QueueItem }
