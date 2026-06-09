import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  CHART_COLORS,
  CHART_TOOLTIP_CLASS,
  DASHBOARD_CHART_CARD,
  DASHBOARD_CHART_HEADER,
  DASHBOARD_CHART_HEIGHT,
  META_TEXT,
} from "@/components/dashboard/dashboard-meta"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import type { ReadinessSummary } from "@/lib/dashboard"

interface InterviewReadinessCardProps {
  readiness: ReadinessSummary
}

export function InterviewReadinessCard({
  readiness,
}: InterviewReadinessCardProps) {
  return (
    <Card className={DASHBOARD_CHART_CARD}>
      <CardHeader className={DASHBOARD_CHART_HEADER}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base font-bold tracking-tight">
              Interview readiness
            </CardTitle>
            <CardDescription className={META_TEXT}>
              Coverage, mastery, consistency, and pace
            </CardDescription>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-2xl font-bold tracking-tight tabular-nums leading-none">
              {readiness.score}%
            </span>
            <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              Current
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-0">
        <ChartContainer
          config={{
            readiness: { label: "Readiness", color: CHART_COLORS.violet },
          }}
          className={DASHBOARD_CHART_HEIGHT}
        >
          <AreaChart
            data={readiness.history}
            margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
          >
            <defs>
              <linearGradient id="fillReadiness" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-readiness)"
                  stopOpacity={0.4}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-readiness)"
                  stopOpacity={0.0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              opacity={0.5}
            />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              domain={[0, 100]}
              tickCount={5}
            />
            <ChartTooltip
              cursor={{ strokeDasharray: "3 3", stroke: CHART_COLORS.grid }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null
                const point = payload[0].payload
                return (
                  <div className={CHART_TOOLTIP_CLASS}>
                    <span className="font-bold">{point.name}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: CHART_COLORS.violet }}
                      />
                      <span className="text-muted-foreground">Score</span>
                      <span className="font-mono font-medium">
                        {point.score}%
                      </span>
                    </div>
                  </div>
                )
              }}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="var(--color-readiness)"
              strokeWidth={2}
              fill="url(#fillReadiness)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
