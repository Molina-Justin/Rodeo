import { TONE_SURFACE } from "@/components/dashboard/dashboard-meta"
import type { SummaryStat } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

export function CycleStats({
  stats,
  className,
}: {
  stats: SummaryStat[]
  className?: string
}) {
  return (
    <div className={cn("grid gap-3.5 sm:grid-cols-2", className)}>
      {stats.map((stat) => (
        <div
          key={stat.id}
          className={cn(
            "flex h-full flex-col justify-between gap-3 rounded-2xl p-4 transition-shadow hover:shadow-xs sm:p-4.5",
            TONE_SURFACE[stat.tone]
          )}
        >
          <span className="text-xs font-semibold tracking-tight">
            {stat.label}
          </span>

          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-xl font-bold tracking-tight tabular-nums">
              {stat.value}
            </span>
            <span className="font-mono text-xs font-medium opacity-75">
              {stat.delta}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
