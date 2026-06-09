import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
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
import { TARGET_SCORE, type TopicMastery } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

/** Display-only shortening, so long topic names do not crowd the axis labels. */
const ABBREVIATIONS: Record<string, string> = {
  "Binary Indexed Tree": "BIT",
  "Binary Search Tree": "BST",
  "Binary Search": "Bin Search",
  "Binary Tree": "Bin Tree",
  "Bit Manipulation": "Bit Manip",
  "Breadth-First Search": "BFS",
  "Depth-First Search": "DFS",
  "Divide and Conquer": "Divide",
  "Dynamic Programming": "DP",
  "Hash Table": "Hash",
  "Linked List": "Linked",
  "Monotonic Stack": "Mono Stack",
  "Sliding Window": "Sliding",
  "Two Pointers": "2 Pointers",
  "Union Find": "Union",
  Backtracking: "Backtrack",
}

const MAX_LABEL_CHARS = 11

/** Keeps every axis label inside the chart's margin, abbreviated or clipped. */
function axisLabel(topic: string): string {
  const short = ABBREVIATIONS[topic] ?? topic

  return short.length > MAX_LABEL_CHARS
    ? `${short.slice(0, MAX_LABEL_CHARS - 1)}…`
    : short
}

const CHART_CONFIG = {
  score: { label: "Mastery", color: CHART_COLORS.indigo },
  target: { label: "Target" },
} satisfies ChartConfig

interface TopicMasteryCardProps {
  mastery: TopicMastery[]
}

interface AxisDatum extends TopicMastery {
  label: string
  target: number
}

export function TopicMasteryCard({ mastery }: TopicMasteryCardProps) {
  const axes: AxisDatum[] = mastery.map((axis) => ({
    ...axis,
    label: `${axisLabel(axis.topic)} ${axis.score}%`,
    target: TARGET_SCORE,
  }))

  return (
    <Card className={DASHBOARD_CHART_CARD}>
      <CardHeader className={DASHBOARD_CHART_HEADER}>
        <CardTitle className="text-base font-bold tracking-tight">
          Topic mastery
        </CardTitle>
        <CardDescription className={META_TEXT}>
          {axes.length} axes · target {TARGET_SCORE}%
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        {axes.length === 0 ? (
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyTitle className="text-sm font-semibold">
                No topics scored
              </EmptyTitle>
              <EmptyDescription className="text-xs text-muted-foreground">
                Mastery per topic appears once attempts are logged.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ChartContainer config={CHART_CONFIG} className={DASHBOARD_CHART_HEIGHT}>
            <RadarChart
              data={axes}
              outerRadius="75%"
              margin={{ top: 8, right: 28, bottom: 8, left: 28 }}
            >
              <PolarGrid className="stroke-border/70" />
              <PolarAngleAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              />
              <PolarRadiusAxis
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) {
                    return null
                  }

                  const axis = payload[0].payload as AxisDatum

                  return (
                    <div className={CHART_TOOLTIP_CLASS}>
                      <span className="font-bold">{axis.topic}</span>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between gap-4 font-mono text-2xs text-muted-foreground">
                          <span>Mastery:</span>
                          <span className="font-medium text-foreground">
                            {axis.score}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 font-mono text-2xs text-muted-foreground">
                          <span>Attempted:</span>
                          <span className="font-medium text-foreground">
                            {axis.attempted}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                }}
              />
              <Radar
                dataKey="target"
                fill="none"
                stroke="var(--color-muted-foreground)"
                strokeWidth={1.2}
                strokeDasharray="3 3"
                dot={false}
                isAnimationActive={false}
              />
              <Radar
                dataKey="score"
                fill="var(--color-score)"
                fillOpacity={0.15}
                stroke="var(--color-score)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--color-score)", strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </RadarChart>
          </ChartContainer>
        )}
      </CardContent>

      <div className="mt-auto flex items-center gap-4 border-t border-border/60 p-0 pt-4">
        <span className={cn(META_TEXT, "flex items-center gap-1.5")}>
          <span
            className="h-0.75 w-3 rounded-full"
            style={{ backgroundColor: CHART_COLORS.indigo }}
          />
          Mastery
        </span>
        <span className={cn(META_TEXT, "flex items-center gap-1.5")}>
          <span className="h-0 w-3 border-t border-dashed border-muted-foreground" />
          Target
        </span>
      </div>
    </Card>
  )
}
