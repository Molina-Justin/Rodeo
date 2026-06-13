import { ArrowRightIcon } from "lucide-react"

import {
  DIFFICULTY_BAR,
  META_TEXT,
} from "@/components/dashboard/dashboard-meta"
import { DIFFICULTY_LABELS } from "@/components/problems/problem-meta"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { DifficultyMix } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

interface DifficultyMixCardProps {
  mix: DifficultyMix[]
  onBuildSet: () => void
}

function weakestBand(mix: DifficultyMix[]): DifficultyMix | undefined {
  const attempted = mix.filter((band) => band.attempted > 0)

  if (attempted.length === 0) {
    return mix.find((b) => b.difficulty === "hard") ?? mix[mix.length - 1]
  }

  return attempted.reduce((weakest, band) =>
    band.percent < weakest.percent ? band : weakest
  )
}

export function DifficultyMixCard({ mix, onBuildSet }: DifficultyMixCardProps) {
  const weakest = weakestBand(mix)

  return (
    <Card className="rounded-3xl border border-border/70 p-5 shadow-sm sm:p-6">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-base font-bold tracking-tight">
          Difficulty mix
        </CardTitle>
        <CardDescription className={META_TEXT}>
          Solved vs. available
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 p-0">
        {mix.map((band) => {
          const denominator = band.total > 0 ? band.total : band.attempted

          return (
            <div key={band.difficulty} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold tracking-tight text-foreground sm:text-sm">
                  {DIFFICULTY_LABELS[band.difficulty]}
                </span>
                <span className={cn(META_TEXT, "text-xs")}>
                  {band.solved} / {denominator}
                </span>
              </div>
              <div className="h-1.75 overflow-hidden rounded-full border border-border/50 bg-muted/60">
                <div
                  style={{ width: `${Math.min(100, band.percent)}%` }}
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    DIFFICULTY_BAR[band.difficulty]
                  )}
                />
              </div>
            </div>
          )
        })}
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t border-border/60 p-0 pt-4">
        <span className="text-xs font-medium text-muted-foreground">
          {weakest
            ? `${DIFFICULTY_LABELS[weakest.difficulty]} is your gap`
            : "Hard is your gap"}
        </span>
        <button
          type="button"
          onClick={onBuildSet}
          className="flex cursor-pointer items-center gap-1 text-xs font-semibold tracking-tight text-foreground transition-opacity hover:opacity-80"
        >
          <span>Build a set</span>
          <ArrowRightIcon className="size-3.5" />
        </button>
      </CardFooter>
    </Card>
  )
}
