import * as React from "react"
import { CalendarIcon, CheckIcon } from "lucide-react"

import { AudioTranscriptPanel } from "@/components/problems/audio-transcript-panel"
import { NotesEditor } from "@/components/problems/notes-editor"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { BLOCKER_LABELS } from "@/lib/attempts"
import { cn } from "@/lib/utils"
import type {
  Attempt,
  AttemptBlocker,
  AttemptDraft,
  AttemptEffort,
  AttemptOutcome,
} from "@/types"

const outcomeChoices: {
  value: AttemptOutcome
  label: string
}[] = [
  {
    value: "optimal",
    label: "Independent",
  },
  {
    value: "hint",
    label: "Used a hint",
  },
  {
    value: "solution",
    label: "Reviewed solution",
  },
  {
    value: "failed",
    label: "Didn't finish",
  },
]

const effortChoices: { value: AttemptEffort; label: string }[] = [
  { value: "light", label: "Easy" },
  { value: "moderate", label: "Manageable" },
  { value: "heavy", label: "Challenging" },
  { value: "brutal", label: "Very hard" },
]

const blockerChoices: AttemptBlocker[] = [
  "none",
  "pattern",
  "edge-cases",
  "complexity",
  "implementation",
  "debugging",
  "time",
]

const segmentClass =
  "h-9 flex-1 px-2 text-[13px] font-normal text-muted-foreground data-pressed:bg-muted data-pressed:font-medium data-pressed:text-foreground"

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium">{label}</span>
        {hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

interface AttemptFormProps {
  problemId: number
  elapsedMinutes: number
  /** Present when editing an existing attempt. */
  attempt?: Attempt
  /** Newly captured recording, available before the attempt has been saved. */
  audioUrl?: string
  submitLabel?: string
  durationHint?: string
  onSave: (draft: AttemptDraft) => void
  onCancel: () => void
}

export function AttemptForm({
  problemId,
  elapsedMinutes,
  attempt,
  audioUrl,
  submitLabel = "Log attempt",
  durationHint = "from timer",
  onSave,
  onCancel,
}: AttemptFormProps) {
  const [duration, setDuration] = React.useState(
    String(attempt?.durationMinutes ?? elapsedMinutes)
  )
  const [date, setDate] = React.useState<Date>(
    attempt ? new Date(attempt.completedAt) : new Date()
  )
  const [outcome, setOutcome] = React.useState<AttemptOutcome | undefined>(
    attempt?.outcome
  )
  const [effort, setEffort] = React.useState<AttemptEffort | undefined>(
    attempt?.effort
  )
  const [blocker, setBlocker] = React.useState<AttemptBlocker>(
    attempt?.blocker ?? "none"
  )
  const [notes, setNotes] = React.useState(attempt?.notes ?? "")
  const playableAudioUrl = audioUrl ?? attempt?.audioUrl

  const submit = (event: React.FormEvent) => {
    event.preventDefault()

    if (!outcome || !effort) {
      return
    }

    onSave({
      problemId,
      completedAt: date.toISOString(),
      durationMinutes: Math.max(1, Number(duration) || elapsedMinutes),
      outcome,
      effort,
      blocker,
      notes: notes.trim(),
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col">
      <div className="flex flex-col gap-5 px-6 py-5">
        <div className="grid grid-cols-2 gap-4">
          <Row label="Time spent" hint={attempt ? undefined : durationHint}>
            <InputGroup className="h-9 rounded-lg">
              <InputGroupInput
                value={duration}
                inputMode="numeric"
                onChange={(event) => setDuration(event.target.value)}
                aria-label="Minutes spent"
                className="tabular-nums"
              />
              <InputGroupAddon
                align="inline-end"
                className="pr-3 text-xs text-muted-foreground"
              >
                min
              </InputGroupAddon>
            </InputGroup>
          </Row>

          <Row label="Date">
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-full justify-between rounded-lg font-normal"
                  />
                }
              >
                {formatDate(date)}
                <CalendarIcon className="text-muted-foreground" />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(next) => next && setDate(next)}
                  autoFocus
                />
              </PopoverContent>
            </Popover>
          </Row>
        </div>

        <Row label="Highest level of help used">
          <ToggleGroup
            spacing={0}
            variant="outline"
            value={outcome ? [outcome] : []}
            onValueChange={(values) => {
              const next = values[0] as AttemptOutcome | undefined
              if (next) {
                setOutcome(next)
              }
            }}
            className="w-full"
          >
            {outcomeChoices.map((choice) => (
              <ToggleGroupItem
                key={choice.value}
                value={choice.value}
                className={segmentClass}
              >
                {choice.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Row>

        <Row label="How difficult did this feel?">
          <ToggleGroup
            spacing={0}
            variant="outline"
            value={effort ? [effort] : []}
            onValueChange={(values) => {
              const next = values[0] as AttemptEffort | undefined
              if (next) {
                setEffort(next)
              }
            }}
            className="w-full"
          >
            {effortChoices.map((choice) => (
              <ToggleGroupItem
                key={choice.value}
                value={choice.value}
                className={cn(
                  segmentClass,
                  "data-pressed:border-emerald-500/45 data-pressed:bg-emerald-500/10 data-pressed:text-emerald-700 dark:data-pressed:text-emerald-400"
                )}
              >
                {effort === choice.value ? (
                  <CheckIcon className="size-3.5" />
                ) : null}
                {choice.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Row>

        <Row label="What was the main blocker?" hint="Optional">
          <Select
            value={blocker}
            onValueChange={(value) => setBlocker(value as AttemptBlocker)}
          >
            <SelectTrigger className="h-9 w-full rounded-lg font-normal">
              <SelectValue>
                {(value: AttemptBlocker) =>
                  value === "none" ? "Select a blocker" : BLOCKER_LABELS[value]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {blockerChoices.map((choice) => (
                <SelectItem key={choice} value={choice}>
                  {BLOCKER_LABELS[choice]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row label="Notes" hint="Markdown · optional">
          <NotesEditor
            value={notes}
            onChange={setNotes}
            placeholder={
              "Pattern / key insight:\nWhat blocked me:\nOne rule for next time:"
            }
          />
        </Row>

        {playableAudioUrl ? (
          <Row label="Audio recording">
            {attempt ? (
              <AudioTranscriptPanel
                attemptId={attempt.id}
                audioUrl={playableAudioUrl}
              />
            ) : (
              <div className="flex flex-col gap-1.5">
                <audio
                  controls
                  preload="metadata"
                  className="w-full"
                  src={playableAudioUrl}
                >
                  Your browser does not support audio playback.
                </audio>
                <span className="text-xs text-muted-foreground">
                  The transcript will appear here once this attempt is logged.
                </span>
              </div>
            )}
          </Row>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/40 px-5 py-4">
        <span className="text-xs text-muted-foreground">
          {!outcome || !effort
            ? "Pick an outcome and difficulty to log."
            : null}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="rounded-lg"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="rounded-lg"
            disabled={!outcome || !effort}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}
