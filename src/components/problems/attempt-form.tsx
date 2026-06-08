import * as React from "react"
import {
  CalendarIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDotIcon,
  CircleXIcon,
} from "lucide-react"

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
import { BLOCKER_LABELS, EFFORT_LABELS, OUTCOME_LABELS } from "@/lib/attempts"
import { cn } from "@/lib/utils"
import type {
  Attempt,
  AttemptBlocker,
  AttemptEffort,
  AttemptOutcome,
} from "@/types"

const outcomeChoices: {
  value: AttemptOutcome
  icon: typeof CircleCheckIcon
  selectedClass: string
}[] = [
  {
    value: "optimal",
    icon: CircleCheckIcon,
    selectedClass:
      "data-pressed:text-emerald-700 dark:data-pressed:text-emerald-400",
  },
  {
    value: "hint",
    icon: CircleDotIcon,
    selectedClass:
      "data-pressed:text-amber-700 dark:data-pressed:text-amber-400",
  },
  {
    value: "solution",
    icon: CircleAlertIcon,
    selectedClass: "data-pressed:text-sky-700 dark:data-pressed:text-sky-400",
  },
  {
    value: "failed",
    icon: CircleXIcon,
    selectedClass: "data-pressed:text-destructive",
  },
]

const effortChoices: AttemptEffort[] = ["light", "moderate", "heavy", "brutal"]

const blockerChoices: AttemptBlocker[] = [
  "none",
  "pattern",
  "edge-cases",
  "complexity",
  "implementation",
  "debugging",
  "time",
]

const segmentClass = "h-9 flex-1 text-sm font-normal data-pressed:font-medium"

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
  onSave: (attempt: Attempt) => void
  onCancel: () => void
}

export function AttemptForm({
  problemId,
  elapsedMinutes,
  onSave,
  onCancel,
}: AttemptFormProps) {
  const [duration, setDuration] = React.useState(String(elapsedMinutes))
  const [date, setDate] = React.useState<Date>(new Date())
  const [outcome, setOutcome] = React.useState<AttemptOutcome>("optimal")
  const [effort, setEffort] = React.useState<AttemptEffort>("moderate")
  const [blocker, setBlocker] = React.useState<AttemptBlocker>("none")
  const [notes, setNotes] = React.useState("")

  const submit = (event: React.FormEvent) => {
    event.preventDefault()

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
          <Row label="Time spent" hint="from timer">
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

        <Row label="Help needed">
          <ToggleGroup
            spacing={0}
            variant="outline"
            value={[outcome]}
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
                className={cn(segmentClass, choice.selectedClass)}
              >
                <choice.icon className="size-3.5" />
                {OUTCOME_LABELS[choice.value]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Row>

        <Row label="Effort">
          <ToggleGroup
            spacing={0}
            variant="outline"
            value={[effort]}
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
                key={choice}
                value={choice}
                className={segmentClass}
              >
                {EFFORT_LABELS[choice]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Row>

        <Row label="Sticking point">
          <Select
            value={blocker}
            onValueChange={(value) => setBlocker(value as AttemptBlocker)}
          >
            <SelectTrigger className="h-9 w-full rounded-lg font-normal">
              <SelectValue>
                {(value: AttemptBlocker) => BLOCKER_LABELS[value]}
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

        <Row label="Notes" hint="Markdown">
          <NotesEditor value={notes} onChange={setNotes} />
        </Row>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/40 px-6 py-4">
        <Button
          type="button"
          variant="ghost"
          className="rounded-lg"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" className="rounded-lg">
          Log attempt
        </Button>
      </div>
    </form>
  )
}
