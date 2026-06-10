import * as React from "react"
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
} from "lucide-react"

import {
  DIFFICULTY_BAR,
  INVERTED_SWITCH,
} from "@/components/dashboard/dashboard-meta"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { usePromptTemplates } from "@/hooks/use-prompt-templates"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { BLOCKER_LABELS } from "@/lib/attempts"
import {
  TARGET_SCORE,
  masteryTier,
  rankByMasteryGap,
  type MasteryTier,
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

const MICRO = "font-mono text-2xs tracking-widest text-background/50 uppercase"
const COPIED_RESET_MS = 2000
const TOPIC_DIFFICULTIES: TopicDifficulty["difficulty"][] = [
  "easy",
  "medium",
  "hard",
]

const TIER_DOT: Record<MasteryTier, string> = {
  under: "bg-orange-500",
  at: "bg-emerald-500",
  open: "bg-background/40",
}

function StatTile({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-foreground px-4 py-3.5">
      <span className={MICRO}>{label}</span>
      {children}
    </div>
  )
}

function StatValue({
  value,
  caption,
  captionClassName,
}: {
  value: string
  caption: string
  captionClassName?: string
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-2xl font-bold tracking-tight tabular-nums">
        {value}
      </span>
      <span
        className={cn("font-mono text-xs text-background/55", captionClassName)}
      >
        {caption}
      </span>
    </span>
  )
}

/**
 * One bar per difficulty, each flexed by how much of the topic you have
 * attempted there, filled by how much of that you solved. Scaling by attempts
 * rather than by catalog size keeps a topic holding thousands of problems from
 * flattening every bar to nothing.
 */
function DifficultySplit({ entries }: { entries: TopicDifficulty[] }) {
  const difficultyEntries = TOPIC_DIFFICULTIES.map(
    (difficulty) =>
      entries.find((entry) => entry.difficulty === difficulty) ?? {
        difficulty,
        solved: 0,
        attempted: 0,
      }
  )

  return (
    <TooltipProvider delay={50}>
      <span className="flex h-1 gap-0.75">
        {difficultyEntries.map((entry) => {
          const difficulty =
            entry.difficulty.charAt(0).toUpperCase() + entry.difficulty.slice(1)
          const completed = `${entry.solved} ${
            entry.solved === 1 ? "problem" : "problems"
          } completed`

          return (
            <Tooltip key={entry.difficulty}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={`${difficulty}: ${completed}`}
                    style={{ flexGrow: Math.max(entry.attempted, 1) }}
                    className="flex min-w-2 cursor-pointer overflow-hidden rounded-full bg-background/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background"
                  >
                    <span
                      className={cn("h-full", DIFFICULTY_BAR[entry.difficulty])}
                      style={{
                        width:
                          entry.attempted > 0
                            ? `${(entry.solved / entry.attempted) * 100}%`
                            : "0%",
                      }}
                    />
                  </button>
                }
              />
              <TooltipContent>{`${difficulty}: ${completed}`}</TooltipContent>
            </Tooltip>
          )
        })}
      </span>
    </TooltipProvider>
  )
}

/** Why this topic leads, stated in the terms the ranking actually used. */
function Rationale({
  focus,
  rank,
  total,
}: {
  focus: TopicFocus
  rank: number
  total: number
}) {
  const tier = masteryTier(focus)

  if (tier === "open") {
    return (
      <>
        No attempts yet across{" "}
        <span className="font-semibold text-background">
          {focus.problemCount} catalog problems
        </span>{" "}
        — open ground, where a first pass tells you more than another rep on
        something you already know.
      </>
    )
  }

  if (tier === "at") {
    return (
      <>
        Holding at{" "}
        <span className="font-semibold text-background">
          {focus.score - TARGET_SCORE} points above your {TARGET_SCORE}% target
        </span>{" "}
        — worth a maintenance pass rather than a deep dive.
      </>
    )
  }

  const gap = TARGET_SCORE - focus.score

  return (
    <>
      {rank === 1 ? "Leads because mastery sits " : "Mastery sits "}
      <span className="font-semibold text-background">
        {gap} points under your {TARGET_SCORE}% target
      </span>
      {rank === 1
        ? " — the widest gap of any topic you have touched"
        : ` — ranked ${rank} of ${total} by mastery gap`}
      {focus.topBlocker
        ? ", and the one that keeps costing you the same mistake."
        : "."}
    </>
  )
}

function RailChip({
  focus,
  selected,
  onSelect,
}: {
  focus: TopicFocus
  selected: boolean
  onSelect: () => void
}) {
  const tier = masteryTier(focus)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={cn(
        "flex h-7 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 text-xs transition-colors",
        tier === "open"
          ? "border border-dashed border-background/25 text-background/55 hover:border-background/40"
          : selected
            ? "bg-background font-semibold text-foreground"
            : "bg-background/10 text-background/85 hover:bg-background/20"
      )}
    >
      {tier === "open" ? null : (
        <span className={cn("size-1.5 rounded-full", TIER_DOT[tier])} />
      )}
      {focus.topic}
    </button>
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
  const notesId = React.useId()

  // Reset the confirmation when the rail moves under a reused component.
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

  return (
    <div className="flex shrink-0 flex-col justify-center gap-2.5 lg:w-60">
      <Button
        onClick={handleCopy}
        className="h-12 cursor-pointer rounded-xl bg-background font-semibold text-foreground hover:bg-background/90"
      >
        {copied ? (
          <CheckIcon className="size-4" />
        ) : (
          <CopyIcon className="size-4" />
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

      {failed ? (
        <span className="text-center font-mono text-2xs text-background/50">
          Clipboard unavailable in this browser
        </span>
      ) : null}
    </div>
  )
}

interface StudyCardProps {
  focuses: TopicFocus[]
  context: SessionContext
}

export function StudyCard({ focuses, context }: StudyCardProps) {
  const ranked = React.useMemo(() => rankByMasteryGap(focuses), [focuses])
  const [selectedTopic, setSelectedTopic] = React.useState<string | null>(null)
  const [includeNotes, setIncludeNotes] = React.useState(
    DEFAULT_SESSION_OPTIONS.includeNotes
  )
  const railRef = React.useRef<HTMLDivElement>(null)

  const selectedIndex = Math.max(
    0,
    ranked.findIndex((focus) => focus.topic === selectedTopic)
  )

  React.useEffect(() => {
    const selectedChip = railRef.current?.querySelector<HTMLElement>(
      '[aria-current="true"]'
    )

    selectedChip?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    })
  }, [ranked, selectedIndex])

  if (ranked.length === 0) {
    return null
  }

  const focus = ranked[selectedIndex]
  const tier = masteryTier(focus)

  const step = (delta: number) => {
    const next = ranked[selectedIndex + delta]

    if (next) {
      setSelectedTopic(next.topic)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="h-[min(40rem,calc(100dvh-2rem))] gap-0 overflow-hidden rounded-2xl bg-foreground p-0 text-background shadow-lg ring-0 sm:h-[min(32rem,calc(100dvh-2rem))] lg:h-[28rem]">
        <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-5 sm:p-8 lg:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge
                className={cn(
                  "h-5.5 rounded-md px-2.5 font-mono text-2xs font-bold tracking-widest uppercase",
                  tier === "under"
                    ? "bg-orange-500 text-orange-950"
                    : tier === "at"
                      ? "bg-emerald-500 text-emerald-950"
                      : "bg-background/20 text-background"
                )}
              >
                {tier === "under"
                  ? "Widest gap"
                  : tier === "at"
                    ? "At target"
                    : "Open ground"}
              </Badge>
              <span className={MICRO}>
                Rank {selectedIndex + 1} of {ranked.length} · next session
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-3xl leading-none font-extrabold tracking-tighter text-balance sm:text-4xl">
                {focus.topic}
              </h2>
              <p className="max-w-prose text-sm leading-relaxed text-pretty text-background/70 sm:text-base">
                <Rationale
                  focus={focus}
                  rank={selectedIndex + 1}
                  total={ranked.length}
                />
              </p>
            </div>

            <div className="grid gap-px overflow-hidden rounded-xl bg-background/15 sm:grid-cols-3">
              <StatTile label="Mastery">
                <StatValue
                  value={`${focus.score}%`}
                  caption={
                    tier === "open"
                      ? "no attempts yet"
                      : tier === "at"
                        ? `+${focus.score - TARGET_SCORE} over target`
                        : `−${TARGET_SCORE - focus.score} to target`
                  }
                  captionClassName={
                    tier === "under" ? "text-orange-400" : undefined
                  }
                />
                <span className="flex h-1 overflow-hidden rounded-full bg-background/15">
                  <span
                    className="h-full bg-indigo-500"
                    style={{ width: `${focus.score}%` }}
                  />
                </span>
              </StatTile>

              <StatTile label="Solved by difficulty">
                <StatValue
                  value={String(focus.solved)}
                  caption={`of ${focus.attempted} attempted`}
                />
                <DifficultySplit entries={focus.difficulty} />
              </StatTile>

              <StatTile label="Recurring blocker">
                {focus.topBlocker ? (
                  <>
                    <StatValue
                      value={String(focus.topBlocker.count)}
                      caption={`of ${focus.topBlocker.total} attempts`}
                    />
                    <span className="text-xs text-background/80">
                      {BLOCKER_LABELS[focus.topBlocker.blocker]}
                      {focus.averageMinutes > 0
                        ? ` · ${focus.averageMinutes}m avg`
                        : null}
                    </span>
                  </>
                ) : (
                  <>
                    <StatValue value="—" caption="nothing recurring" />
                    <span className="text-xs text-background/80">
                      {focus.attempted === 0
                        ? "No attempts logged"
                        : "No repeated sticking point"}
                    </span>
                  </>
                )}
              </StatTile>
            </div>
          </div>

          <CopyAction
            focus={focus}
            context={context}
            includeNotes={includeNotes}
            onIncludeNotesChange={setIncludeNotes}
          />
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-background/15 px-5 py-3.5 sm:gap-4 sm:px-8">
          <span className={cn(MICRO, "shrink-0")}>Ranked</span>
          <div
            ref={railRef}
            className="flex min-w-0 flex-1 scrollbar-none items-center gap-1.5 overflow-x-auto"
          >
            {ranked.map((entry, index) => (
              <React.Fragment key={entry.topic}>
                {index > 0 &&
                masteryTier(entry) !== masteryTier(ranked[index - 1]) ? (
                  <span className="mx-1 h-4 w-px shrink-0 bg-background/20" />
                ) : null}
                <RailChip
                  focus={entry}
                  selected={index === selectedIndex}
                  onSelect={() => setSelectedTopic(entry.topic)}
                />
              </React.Fragment>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous topic"
              disabled={selectedIndex === 0}
              onClick={() => step(-1)}
              className="size-8 cursor-pointer rounded-lg border-background/20 bg-transparent text-background hover:bg-background/10 hover:text-background"
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next topic"
              disabled={selectedIndex === ranked.length - 1}
              onClick={() => step(1)}
              className="size-8 cursor-pointer rounded-lg border-background/20 bg-transparent text-background hover:bg-background/10 hover:text-background"
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-5 px-1 font-mono text-2xs tracking-wider text-muted-foreground uppercase">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-orange-500" />
          Under target
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          At target
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 border border-dashed border-muted-foreground" />
          Open ground
        </span>
      </div>
    </div>
  )
}
