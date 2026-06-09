import * as React from "react"
import {
  CartesianGrid,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts"

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
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import type { Attempt, Problem, Difficulty } from "@/types"
import { cn } from "@/lib/utils"

interface TimePerDifficultyCardProps {
  attempts: Attempt[]
  problems: Problem[]
}

const BANDS: { difficulty: Difficulty; y: number }[] = [
  { difficulty: "easy", y: 3 },
  { difficulty: "medium", y: 2 },
  { difficulty: "hard", y: 1 },
]

const BAND_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
}

const CHART_CONFIG = { duration: { label: "Time" } } satisfies ChartConfig
const BAND_JITTER = 0.22
const AVERAGE_MARKER_HALF_HEIGHT = 0.28

interface BandRow {
  count: number
  avg: number
}

/**
 * Produces a stable position within a difficulty band. FNV-1a avoids the
 * prefix clustering of a simple string hash, so sequential IDs still spread
 * across the full height of the band on every render.
 */
function verticalJitter(id: string): number {
  let hash = 2166136261

  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0) / 0xffffffff - 0.5
}

/** Recharts clones this with its own `x`/`y`/`payload`; `rows` comes from us. */
function PaceYTick({
  x,
  y,
  payload,
  rows,
}: {
  x?: number
  y?: number
  payload?: { value: number }
  rows?: Map<Difficulty, BandRow>
}) {
  const band = BANDS.find((b) => b.y === payload?.value)

  if (!band) {
    return null
  }

  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text
        x={0}
        y={-6}
        textAnchor="end"
        className="fill-foreground text-xs font-semibold"
      >
        {BAND_LABELS[band.difficulty]}
      </text>
      <text
        x={0}
        y={8}
        textAnchor="end"
        className="fill-muted-foreground text-2xs"
      >
        {rows?.get(band.difficulty)?.count ?? 0} solved
      </text>
    </g>
  )
}

export function TimePerDifficultyCard({
  attempts,
  problems,
}: TimePerDifficultyCardProps) {
  const { averageData, points, rows, xDomain } = React.useMemo(() => {
    const catalog = new Map(problems.map((p) => [p.id, p]))

    const stats = {
      easy: { sum: 0, count: 0, y: 3 },
      medium: { sum: 0, count: 0, y: 2 },
      hard: { sum: 0, count: 0, y: 1 },
    }

    const scatterItems = attempts
      .map((attempt) => {
        const p = catalog.get(attempt.problemId)
        if (!p) return null

        stats[p.difficulty].sum += attempt.durationMinutes
        stats[p.difficulty].count += 1

        const yBase = stats[p.difficulty].y

        return {
          id: attempt.id,
          title: p.title,
          difficulty: p.difficulty,
          x: attempt.durationMinutes,
          y: yBase + verticalJitter(attempt.id) * BAND_JITTER * 2,
          duration: attempt.durationMinutes,
        }
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)

    const rowsMap = new Map(
      (["easy", "medium", "hard"] as const).map((d) => [
        d,
        {
          count: stats[d].count,
          avg: stats[d].count
            ? Math.round(stats[d].sum / stats[d].count)
            : 0,
        },
      ])
    )

    const averageItems = BANDS.map((b) => ({
      y: b.y,
      x: rowsMap.get(b.difficulty)?.avg ?? 0,
      difficulty: b.difficulty,
    }))

    const durations = scatterItems.map((point) => point.duration)
    const xDomain = (() => {
      if (durations.length === 0) {
        return [1, 5] as const
      }

      const minimum = Math.min(...durations)
      const maximum = Math.max(...durations)
      const lowerBound = Math.max(1, Math.floor(minimum / 5) * 5)
      const upperBound = Math.max(
        lowerBound + 5,
        Math.ceil(maximum / 5) * 5
      )

      return [lowerBound, upperBound] as const
    })()

    return {
      averageData: averageItems,
      points: scatterItems,
      rows: rowsMap,
      xDomain,
    }
  }, [attempts, problems])

  return (
    <Card className={DASHBOARD_CHART_CARD}>
      <CardHeader className={DASHBOARD_CHART_HEADER}>
        <CardTitle className="text-base font-bold tracking-tight">
          Completion Time
        </CardTitle>
        <CardDescription className={META_TEXT}>
          Duration of attempts by difficulty
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {points.length === 0 ? (
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyTitle className="text-sm font-semibold">No data</EmptyTitle>
              <EmptyDescription className="text-xs text-muted-foreground">
                Log an attempt to see times here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ChartContainer
            config={CHART_CONFIG}
            className={DASHBOARD_CHART_HEIGHT}
          >
            <ScatterChart margin={{ top: 8, right: 14, bottom: 4, left: 6 }}>
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                dataKey="x"
                domain={xDomain}
                tickFormatter={(v) => `${v}m`}
                tickLine={false}
                axisLine={false}
                tickMargin={6}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[0.4, 3.6]}
                ticks={[1, 2, 3]}
                tick={<PaceYTick rows={rows} />}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <ZAxis range={[20, 20]} />
              <ChartTooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const point = payload[0].payload

                  return (
                    <div className={CHART_TOOLTIP_CLASS}>
                      <span className="font-bold">{point.title}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: CHART_COLORS.violet }}
                        />
                        <span className="text-muted-foreground capitalize">
                          {point.difficulty}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-mono font-medium">
                          {point.duration} min
                        </span>
                      </div>
                    </div>
                  )
                }}
              />
              {BANDS.map((b) => {
                const row = rows.get(b.difficulty)
                if (!row || row.count === 0) return null
                return (
                  <ReferenceLine
                    key={b.difficulty}
                    segment={[
                      { x: row.avg, y: b.y - AVERAGE_MARKER_HALF_HEIGHT },
                      { x: row.avg, y: b.y + AVERAGE_MARKER_HALF_HEIGHT },
                    ]}
                    stroke={CHART_COLORS.violet}
                    strokeWidth={2.5}
                  />
                )
              })}
              <Scatter
                data={points}
                fill={CHART_COLORS.violet}
                fillOpacity={0.42}
              />
            </ScatterChart>
          </ChartContainer>
        )}
      </CardContent>
      {points.length > 0 && (
        <div className="flex items-center justify-between border-t border-border/60 p-0 pt-4 mt-auto">
          <div className="flex w-full items-center justify-between sm:justify-start sm:gap-8">
            {averageData.map((avg) => (
              <div
                key={avg.difficulty}
                className={cn(META_TEXT, "flex items-baseline gap-1.5")}
              >
                <span className="font-medium capitalize">{avg.difficulty}</span>
                <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                  {avg.x > 0 ? `${avg.x}m` : "--"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
