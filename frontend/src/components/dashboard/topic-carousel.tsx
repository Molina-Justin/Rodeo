import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

import {
  DIFFICULTY_BAR,
  INVERTED_DIFFICULTY,
} from "@/components/dashboard/dashboard-meta"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { usePromptTemplates } from "@/hooks/use-prompt-templates"
import { BLOCKER_LABELS } from "@/lib/attempts"
import {
  TARGET_SCORE,
  type TopicDifficulty,
  type TopicFocus,
} from "@/lib/dashboard"
import {
  DEFAULT_SESSION_OPTIONS,
  buildSessionPayload,
  toJson,
  type SessionContext,
} from "@/lib/session-prompt"
import { cn } from "@/lib/utils"

const MICRO = "font-mono text-xs tracking-widest text-background/60 uppercase"
const COPIED_RESET_MS = 2000

/**
 * The card inverts the theme (`bg-foreground`), so the switch cannot keep its
 * own tokens — `bg-input` and the dark unchecked thumb both resolve to the
 * card's own surface and vanish. Pin the track and the thumb to the inverted
 * pair, which flips with the theme the same way the card does.
 */
const INVERTED_SWITCH =
  "cursor-pointer data-checked:bg-emerald-400 data-unchecked:bg-background/25 dark:data-unchecked:bg-background/25 dark:data-unchecked:[&_[data-slot=switch-thumb]]:bg-background"

interface TopicCarouselProps {
  focuses: TopicFocus[]
  context: SessionContext
}

function SlideStat({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className={MICRO}>{label}</span>
      {children}
    </div>
  )
}

/**
 * Three inline bars, scaled to the busiest difficulty in the topic rather than
 * to the catalog — a topic holds thousands of problems, so a catalog share
 * would flatten every bar to nothing. The solid run is solved, the faded run is
 * attempted but not yet solved.
 */
function DifficultyBars({ entries }: { entries: TopicDifficulty[] }) {
  const scale = Math.max(...entries.map((entry) => entry.attempted), 1)

  return (
    <div className="flex w-48 flex-col gap-1.5">
      {entries.map((entry) => (
        <div key={entry.difficulty} className="flex items-center gap-2.5">
          <span className="w-11 font-mono text-2xs tracking-wider text-background/60 uppercase">
            {entry.difficulty}
          </span>
          <span className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-background/15">
            <span
              className={cn("h-full", DIFFICULTY_BAR[entry.difficulty])}
              style={{ width: `${(entry.solved / scale) * 100}%` }}
            />
            <span
              className={cn(
                "h-full opacity-35",
                DIFFICULTY_BAR[entry.difficulty]
              )}
              style={{
                width: `${((entry.attempted - entry.solved) / scale) * 100}%`,
              }}
            />
          </span>
          <span className="w-6 text-right font-mono text-xs font-medium text-background tabular-nums">
            {entry.solved}
          </span>
        </div>
      ))}
    </div>
  )
}

function TopicSlide({
  focus,
  context,
  includeNotes,
  onIncludeNotesChange,
}: {
  focus: TopicFocus
  context: SessionContext
  includeNotes: boolean
  onIncludeNotesChange: (next: boolean) => void
}) {
  const untouched = focus.attempted === 0

  return (
    <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="flex items-center gap-2.5">
          <span className={MICRO}>Studying</span>
          <span className="size-1 rounded-full bg-background/50" />
          <span className="font-mono text-xs tracking-wide text-background/60">
            {untouched
              ? "no history yet · open ground"
              : focus.dueCount > 0
                ? `${focus.dueCount} ${focus.dueCount === 1 ? "review" : "reviews"} due`
                : "no reviews due"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {focus.topic}
          </h2>
          <Badge
            className={cn(
              "h-6 rounded-md px-2.5 font-mono text-xs font-medium",
              focus.score >= TARGET_SCORE
                ? INVERTED_DIFFICULTY.easy
                : focus.score > 0
                  ? INVERTED_DIFFICULTY.medium
                  : INVERTED_DIFFICULTY.hard
            )}
          >
            {focus.score}% MASTERY
          </Badge>
        </div>

        <div className="flex flex-wrap items-start gap-x-8 gap-y-5 border-t border-background/15 pt-5">
          <SlideStat label="Completed">
            <DifficultyBars entries={focus.difficulty} />
          </SlideStat>
          <SlideStat label="Pace">
            <span className="text-sm font-medium text-background tabular-nums">
              {focus.averageMinutes > 0 ? `${focus.averageMinutes}m avg` : "—"}
            </span>
          </SlideStat>
          <SlideStat label="Recurring blocker" className="min-w-0 flex-1">
            <span className="text-sm font-medium leading-snug text-background">
              {focus.topBlocker
                ? `${BLOCKER_LABELS[focus.topBlocker.blocker]} · ${focus.topBlocker.count} of ${focus.topBlocker.total}`
                : "Nothing recurring"}
            </span>
          </SlideStat>
        </div>
      </div>

      <CopyAction
        focus={focus}
        context={context}
        includeNotes={includeNotes}
        onIncludeNotesChange={onIncludeNotesChange}
      />
    </div>
  )
}

function CopyAction({
  focus,
  context,
  includeNotes,
  onIncludeNotesChange,
}: {
  focus: TopicFocus
  context: SessionContext
  includeNotes: boolean
  onIncludeNotesChange: (next: boolean) => void
}) {
  const { data: promptTemplates } = usePromptTemplates()
  const [copied, setCopied] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  // Reset the confirmation when the slide changes under a reused component.
  React.useEffect(() => {
    setCopied(false)
    setFailed(false)
  }, [focus.topic])

  React.useEffect(() => {
    if (!copied) {
      return
    }

    const timer = window.setTimeout(() => setCopied(false), COPIED_RESET_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  const handleCopy = async () => {
    const payload = buildSessionPayload(focus, context, {
      ...DEFAULT_SESSION_OPTIONS,
      includeNotes,
    })

    try {
      await navigator.clipboard.writeText(
        toJson(payload, promptTemplates?.session_template)
      )
      setFailed(false)
      setCopied(true)
    } catch {
      setFailed(true)
    }
  }

  const { problemCount, minutes } = DEFAULT_SESSION_OPTIONS
  const notesId = React.useId()

  return (
    <div className="flex shrink-0 flex-col gap-2.5">
      <Button
        onClick={handleCopy}
        className="h-11 cursor-pointer rounded-xl bg-background px-7 font-semibold text-foreground hover:bg-background/90"
      >
        {copied ? (
          <CheckIcon className="size-3.5" />
        ) : (
          <CopyIcon className="size-3.5" />
        )}
        {copied ? "Copied to clipboard" : "Copy session prompt"}
      </Button>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-background/20 px-4 py-2.5">
        <Label
          htmlFor={notesId}
          className="cursor-pointer font-mono text-xs font-normal text-background/70"
        >
          Include my notes
        </Label>
        <Switch
          id={notesId}
          checked={includeNotes}
          onCheckedChange={onIncludeNotesChange}
          className={INVERTED_SWITCH}
        />
      </div>

      <span className="text-center font-mono text-2xs text-background/50">
        {failed
          ? "Clipboard unavailable in this browser"
          : `${problemCount} problems · ${minutes} min · ${focus.attemptedProblems.length} completed rows`}
      </span>
    </div>
  )
}

export function TopicCarousel({ focuses, context }: TopicCarouselProps) {
  const [api, setApi] = React.useState<CarouselApi>()
  const [current, setCurrent] = React.useState(0)
  // One preference for the whole deck — each slide renders its own controls.
  const [includeNotes, setIncludeNotes] = React.useState(
    DEFAULT_SESSION_OPTIONS.includeNotes
  )

  React.useEffect(() => {
    if (!api) {
      return
    }

    const sync = () => setCurrent(api.selectedScrollSnap())

    sync()
    api.on("select", sync)
    api.on("reInit", sync)

    // Embla drives its viewport by transform, so a native scroll — which the
    // browser fires whenever focus lands on a control inside an off-screen
    // slide — silently desyncs the two. Pin it back to zero.
    const viewport = api.rootNode()
    const pin = () => {
      if (viewport.scrollLeft !== 0) {
        viewport.scrollLeft = 0
      }
    }

    viewport.addEventListener("scroll", pin)

    return () => {
      api.off("select", sync)
      api.off("reInit", sync)
      viewport.removeEventListener("scroll", pin)
    }
  }, [api])

  if (focuses.length === 0) {
    return null
  }

  return (
    <Card className="rounded-3xl bg-foreground p-7 text-background shadow-lg ring-0 sm:p-8">
      <Carousel setApi={setApi} opts={{ align: "start" }} className="w-full">
        <CarouselContent>
          {focuses.map((focus, index) => (
            <CarouselItem
              key={focus.topic}
              // Only the visible slide is reachable; the rest stay out of the
              // tab order and the accessibility tree.
              inert={index !== current}
              aria-hidden={index !== current}
            >
              <TopicSlide
                focus={focus}
                context={context}
                includeNotes={includeNotes}
                onIncludeNotesChange={setIncludeNotes}
              />
            </CarouselItem>
          ))}
        </CarouselContent>

        <div className="mt-6 flex items-center justify-end border-t border-background/15 pt-4">
          <div className="flex items-center gap-3">
            <CarouselPrevious className="static size-9 translate-y-0 cursor-pointer border-background/20 bg-transparent text-background hover:bg-background/10 hover:text-background" />
            <span className="w-14 text-center font-mono text-xs tabular-nums text-background/60">
              {current + 1} / {focuses.length}
            </span>
            <CarouselNext className="static size-9 translate-y-0 cursor-pointer border-background/20 bg-transparent text-background hover:bg-background/10 hover:text-background" />
          </div>
        </div>
      </Carousel>
    </Card>
  )
}
