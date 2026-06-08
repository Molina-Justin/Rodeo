import * as React from "react"
import {
  CalendarIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDotIcon,
  CircleXIcon,
  ClockIcon,
  FileTextIcon,
  GaugeIcon,
  OctagonAlertIcon,
} from "lucide-react"

import { NotesEditor } from "@/components/problems/notes-editor"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldLabel } from "@/components/ui/field"
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
  className: string
}[] = [
  {
    value: "optimal",
    icon: CircleCheckIcon,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  {
    value: "hint",
    icon: CircleDotIcon,
    className: "text-amber-600 dark:text-amber-400",
  },
  {
    value: "solution",
    icon: CircleAlertIcon,
    className: "text-sky-600 dark:text-sky-400",
  },
  {
    value: "failed",
    icon: CircleXIcon,
    className: "text-destructive",
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

const fieldLabelClass =
  "flex items-center gap-2 text-xs font-medium text-muted-foreground"

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
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel className={fieldLabelClass}>
            <ClockIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            How long did it take?
          </FieldLabel>
          <InputGroup className="h-10 rounded-lg">
            <InputGroupInput
              value={duration}
              inputMode="numeric"
              onChange={(event) => setDuration(event.target.value)}
              aria-label="Minutes spent"
              className="tabular-nums"
            />
            <InputGroupAddon align="inline-end" className="pr-3 text-xs">
              min
            </InputGroupAddon>
          </InputGroup>
        </Field>

        <Field>
          <FieldLabel className={fieldLabelClass}>
            <CalendarIcon className="size-3.5 text-sky-600 dark:text-sky-400" />
            When
          </FieldLabel>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 justify-start rounded-lg font-normal"
                />
              }
            >
              <CalendarIcon className="text-muted-foreground" />
              {formatDate(date)}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(next) => next && setDate(next)}
                autoFocus
              />
            </PopoverContent>
          </Popover>
        </Field>
      </div>

      <Field>
        <FieldLabel className={fieldLabelClass}>
          <CircleCheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          How much help did you need?
        </FieldLabel>
        <ToggleGroup
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
              className="h-10 flex-1 rounded-lg"
            >
              <choice.icon
                className={cn(
                  outcome === choice.value ? choice.className : undefined
                )}
              />
              {OUTCOME_LABELS[choice.value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <Field>
        <FieldLabel className={fieldLabelClass}>
          <GaugeIcon className="size-3.5 text-amber-600 dark:text-amber-400" />
          How hard did it feel?
        </FieldLabel>
        <ToggleGroup
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
              className="h-10 flex-1 rounded-lg"
            >
              {EFFORT_LABELS[choice]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <Field>
        <FieldLabel className={fieldLabelClass}>
          <OctagonAlertIcon className="size-3.5 text-destructive" />
          What slowed you down?
        </FieldLabel>
        <Select
          value={blocker}
          onValueChange={(value) => setBlocker(value as AttemptBlocker)}
        >
          <SelectTrigger className="h-10 w-full rounded-lg">
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
      </Field>

      <Field>
        <FieldLabel className={fieldLabelClass}>
          <FileTextIcon className="size-3.5 text-violet-600 dark:text-violet-400" />
          Notes
        </FieldLabel>
        <NotesEditor value={notes} onChange={setNotes} />
      </Field>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          className="rounded-lg text-muted-foreground"
          onClick={onCancel}
        >
          Discard
        </Button>
        <Button
          type="submit"
          className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-600/90"
        >
          Log attempt
        </Button>
      </div>
    </form>
  )
}
