import {
  CHART_TOOLTIP_CLASS,
  DASHBOARD_CHART_HEADER,
  HEATMAP_LEVELS,
  META_TEXT,
} from "@/components/dashboard/dashboard-meta"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ConsistencySummary } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

interface ConsistencyCardProps {
  consistency: ConsistencySummary
  rangeDays: number
  className?: string
}

export function ConsistencyCard({
  consistency,
  rangeDays,
  className,
}: ConsistencyCardProps) {
  const dateStartLabel =
    rangeDays >= 365
      ? "1 year ago"
      : rangeDays >= 60
        ? `${Math.round(rangeDays / 30)} months ago`
        : `${rangeDays} days ago`

  return (
    <Card
      className={cn(
        "rounded-2xl border border-border/70 p-4 shadow-sm sm:p-5",
        className
      )}
    >
      <CardHeader
        className={cn(
          DASHBOARD_CHART_HEADER,
          "flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between"
        )}
      >
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base font-bold tracking-tight">
            Consistency
          </CardTitle>
          <CardDescription className={META_TEXT}>
            Past {rangeDays} days · practice activity heatmap
          </CardDescription>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <span>Less</span>
          <span className="size-2.5 rounded-xs bg-black/10 dark:bg-white/15" />
          <span className="size-2.5 rounded-xs bg-emerald-200 dark:bg-emerald-950/80" />
          <span className="size-2.5 rounded-xs bg-emerald-300 dark:bg-emerald-800/80" />
          <span className="size-2.5 rounded-xs bg-emerald-400 dark:bg-emerald-600" />
          <span className="size-2.5 rounded-xs bg-emerald-500" />
          <span>More</span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col p-0">
        <TooltipProvider delay={50}>
          <div className="flex flex-col gap-2">
            <div
              data-testid="consistency-heatmap-scroll"
              className="no-scrollbar w-full overflow-x-auto overscroll-x-contain pb-1"
            >
              <div className="flex w-max min-w-full justify-end gap-1 sm:gap-1.5">
                {consistency.weeks.map((week) => (
                  <div
                    key={week.key}
                    className="flex shrink-0 flex-col gap-1 sm:gap-1.5"
                  >
                    {week.days.map((day, index) =>
                      day ? (
                        <Tooltip key={day.key}>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                aria-label={`${day.label}: ${day.problemCount} logged`}
                                className={cn(
                                  "size-3 shrink-0 cursor-pointer rounded-xs transition-transform hover:scale-125 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:size-3.5",
                                  HEATMAP_LEVELS[day.level]
                                )}
                              />
                            }
                          />
                          <TooltipContent
                            side="top"
                            className={cn(
                              CHART_TOOLTIP_CLASS,
                              "gap-0.5 py-1.5"
                            )}
                          >
                            <span className="font-semibold">{day.label}</span>
                            <span className="font-mono text-2xs text-muted-foreground">
                              {day.problemCount > 0
                                ? `${day.problemCount} ${day.problemCount === 1 ? "problem" : "problems"} solved · ${day.minutes}m`
                                : "No problems logged"}
                            </span>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span
                          key={`blank-${index}`}
                          className="pointer-events-none size-3 shrink-0 opacity-0 sm:size-3.5"
                        />
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div
              className={cn(
                META_TEXT,
                "flex items-center justify-between px-0.5 text-2xs"
              )}
            >
              <span>{dateStartLabel}</span>
              <span>Today</span>
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
