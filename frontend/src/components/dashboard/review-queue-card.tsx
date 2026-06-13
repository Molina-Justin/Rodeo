import { CheckCheckIcon } from "lucide-react"

import {
  TONE_TAG,
  TONE_TEXT,
  META_TEXT,
} from "@/components/dashboard/dashboard-meta"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { queueTone, type ReviewItem } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

interface ReviewQueueCardProps {
  items: ReviewItem[]
  dueCount: number
  onSelect: (problemId: number) => void
  onRunReview?: () => void
}

export function ReviewQueueCard({
  items,
  dueCount,
  onSelect,
  onRunReview,
}: ReviewQueueCardProps) {
  const handleRunReview = () => {
    if (onRunReview) {
      onRunReview()
    } else if (items.length > 0) {
      onSelect(items[0].problemId)
    }
  }

  return (
    <Card className="overflow-hidden rounded-3xl border border-border/70 p-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 p-5 pb-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base font-bold tracking-tight">
            Review queue
          </CardTitle>
          <CardDescription className={META_TEXT}>
            Spaced repetition, {dueCount} due
          </CardDescription>
        </div>
        <span className="rounded-lg border border-border/50 bg-muted/60 px-2.5 py-1 font-mono text-xs font-medium text-muted-foreground">
          Today
        </span>
      </CardHeader>

      {items.length === 0 ? (
        <Empty className="gap-2 border-t border-border/60 py-10">
          <EmptyHeader>
            <EmptyTitle className="text-sm font-semibold">
              Queue is clear
            </EmptyTitle>
            <EmptyDescription className="text-xs text-muted-foreground">
              Reviews are scheduled from the attempts you log.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col">
          {items.map((item) => {
            const tone = queueTone(item.status)

            return (
              <button
                key={item.problemId}
                type="button"
                onClick={() => onSelect(item.problemId)}
                className="flex cursor-pointer items-center gap-3 border-t border-border/60 px-5 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <span
                  className={cn(
                    "flex size-8.5 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-semibold",
                    TONE_TAG[tone]
                  )}
                >
                  {item.tag}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-xs font-semibold tracking-tight text-foreground sm:text-sm">
                    {item.title}
                  </span>
                  <span className="font-mono text-2xs text-muted-foreground">
                    interval {item.intervalDays}d, {item.lapses}{" "}
                    {item.lapses === 1 ? "lapse" : "lapses"}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 font-mono text-xs font-medium",
                    item.dueInDays <= 0
                      ? TONE_TEXT[tone]
                      : "text-muted-foreground"
                  )}
                >
                  {item.when}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="border-t border-border/60 p-4">
        <Button
          variant="outline"
          disabled={items.length === 0}
          onClick={handleRunReview}
          className="h-10 w-full cursor-pointer rounded-xl border border-border/80 bg-muted/40 font-semibold text-foreground hover:bg-muted"
        >
          <CheckCheckIcon className="size-4" />
          Run review, {dueCount}
        </Button>
      </div>
    </Card>
  )
}
