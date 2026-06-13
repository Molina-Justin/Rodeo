import {
  CalendarIcon,
  CheckIcon,
  CircleHelpIcon,
  CopyIcon,
  DownloadIcon,
  HardDriveIcon,
  Loader2Icon,
  MessageSquareQuoteIcon,
  RotateCcwIcon,
  SaveIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  SparklesIcon,
  TargetIcon,
  Trash2Icon,
  VaultIcon,
} from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import {
  useInterviewGoals,
  useSaveInterviewGoals,
} from "@/hooks/use-interview-goals"
import {
  usePromptTemplates,
  useResetPromptTemplate,
  useSavePromptTemplate,
} from "@/hooks/use-prompt-templates"
import {
  useBackupFiles,
  useBackupNow,
  useBackupStatus,
  useDeleteBackup,
  useClearWorkspace,
  useExportWorkspace,
  useRestoreBackup,
} from "@/hooks/use-system"
import { cn } from "@/lib/utils"

type PromptTemplateKey = "session" | "review"

const TEMPLATE_DETAILS: Record<
  PromptTemplateKey,
  {
    title: string
    description: string
    variables: string[]
    icon: typeof SparklesIcon
  }
> = {
  session: {
    title: "Session prompt",
    description:
      "Used by Copy session prompt on the dashboard, with the topic context block.",
    variables: [
      "{{topic}}",
      "{{minutes}}",
      "{{problem_count}}",
      "{{blocker}}",
      "{{readiness}}",
      "{{target_role}}",
      "{{target_date}}",
      "{{years_experience}}",
    ],
    icon: SparklesIcon,
  },
  review: {
    title: "Attempt review prompt",
    description: "Used when copying an AI review prompt for a single attempt.",
    variables: [
      "{{problem_title}}",
      "{{difficulty}}",
      "{{outcome}}",
      "{{notes}}",
      "{{transcript}}",
      "{{target_role}}",
      "{{target_date}}",
      "{{years_experience}}",
    ],
    icon: MessageSquareQuoteIcon,
  },
}

function countWords(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function dateToStorageValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function storageValueToDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return undefined
  }
  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

function formatTargetDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

function formatBackupTime(value: string | null | undefined): string {
  if (!value) return "Not yet"
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return "not yet"
  const differenceMs = new Date(value).getTime() - Date.now()
  const absoluteSeconds = Math.abs(differenceMs) / 1000
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })

  if (absoluteSeconds < 60) {
    return differenceMs < 0 ? "just now" : "in less than a minute"
  }
  if (absoluteSeconds < 60 * 60) {
    return formatter.format(Math.round(differenceMs / 60_000), "minute")
  }
  if (absoluteSeconds < 24 * 60 * 60) {
    return formatter.format(Math.round(differenceMs / 3_600_000), "hour")
  }
  return formatter.format(Math.round(differenceMs / 86_400_000), "day")
}

function formatBackupDateLabel(value: string): string {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const isSameDay = (candidate: Date, comparison: Date) =>
    candidate.getFullYear() === comparison.getFullYear() &&
    candidate.getMonth() === comparison.getMonth() &&
    candidate.getDate() === comparison.getDate()
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })

  if (isSameDay(date, today)) return `Today, ${time}`
  if (isSameDay(date, yesterday)) return `Yesterday, ${time}`
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function SectionHeading({
  children,
  detail,
}: {
  children: React.ReactNode
  detail: string
}) {
  return (
    <div className="flex items-center gap-3.5">
      <h2 className="text-base font-bold tracking-tight">{children}</h2>
      <div className="h-px flex-1 bg-border/60" />
      <span className="font-mono text-xs text-muted-foreground">{detail}</span>
    </div>
  )
}

export function SettingsPage() {
  const [clearText, setClearText] = React.useState("")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [justExported, setJustExported] = React.useState(false)
  const [recentlySaved, setRecentlySaved] =
    React.useState<PromptTemplateKey | null>(null)
  const [drafts, setDrafts] = React.useState<Record<PromptTemplateKey, string>>(
    {
      session: "",
      review: "",
    }
  )
  const textareaRefs = React.useRef<
    Record<PromptTemplateKey, HTMLTextAreaElement | null>
  >({ session: null, review: null })
  const promptTemplates = usePromptTemplates()
  const savePromptTemplate = useSavePromptTemplate()
  const resetPromptTemplate = useResetPromptTemplate()
  const exportWorkspace = useExportWorkspace()
  const clearWorkspace = useClearWorkspace()
  const backupStatus = useBackupStatus()
  const backupNow = useBackupNow()
  const [backupListOpen, setBackupListOpen] = React.useState(false)
  const backupFiles = useBackupFiles(true)
  const restoreBackup = useRestoreBackup()
  const deleteBackup = useDeleteBackup()
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null)
  const [pendingRestore, setPendingRestore] = React.useState<string | null>(
    null
  )
  const [restarting, setRestarting] = React.useState(false)
  const interviewGoals = useInterviewGoals()
  const saveInterviewGoals = useSaveInterviewGoals()
  const [goalsDraft, setGoalsDraft] = React.useState({
    targetRole: "",
    targetDate: "",
    yearsExperience: "",
  })
  const [targetDateOpen, setTargetDateOpen] = React.useState(false)
  const [goalsJustSaved, setGoalsJustSaved] = React.useState(false)

  React.useEffect(() => {
    if (!promptTemplates.data) {
      return
    }
    setDrafts({
      session: promptTemplates.data.session_template,
      review: promptTemplates.data.review_template,
    })
  }, [promptTemplates.data])

  React.useEffect(() => {
    if (!interviewGoals.data) {
      return
    }
    setGoalsDraft({
      targetRole: interviewGoals.data.target_role,
      targetDate: interviewGoals.data.target_date,
      yearsExperience:
        interviewGoals.data.years_experience === null
          ? ""
          : String(interviewGoals.data.years_experience),
    })
  }, [interviewGoals.data])

  const goalsAreDirty =
    interviewGoals.data !== undefined &&
    (goalsDraft.targetRole !== interviewGoals.data.target_role ||
      goalsDraft.targetDate !== interviewGoals.data.target_date ||
      goalsDraft.yearsExperience !==
        (interviewGoals.data.years_experience === null
          ? ""
          : String(interviewGoals.data.years_experience)))

  const handleSaveGoals = () => {
    const yearsExperience =
      goalsDraft.yearsExperience.trim() === ""
        ? null
        : Number(goalsDraft.yearsExperience)
    if (yearsExperience !== null && !Number.isInteger(yearsExperience)) {
      toast.error("Years of experience must be a whole number.")
      return
    }
    saveInterviewGoals.mutate(
      {
        targetRole: goalsDraft.targetRole.trim(),
        targetDate: goalsDraft.targetDate,
        yearsExperience,
      },
      {
        onSuccess: () => {
          setGoalsJustSaved(true)
          toast.success("Interview goals saved.")
          window.setTimeout(() => setGoalsJustSaved(false), 2200)
        },
        onError: () => toast.error("Interview goals could not be saved."),
      }
    )
  }

  const handleExport = () => {
    exportWorkspace.mutate(undefined, {
      onSuccess: () => {
        setJustExported(true)
        toast.success("Workspace exported and downloaded.")
        window.setTimeout(() => setJustExported(false), 2500)
      },
      onError: () => toast.error("Export failed. Try again."),
    })
  }

  const handleClear = () => {
    clearWorkspace.mutate(undefined, {
      onSuccess: (result) => {
        setClearText("")
        setDialogOpen(false)
        toast.success(
          `Workspace cleared. Removed ${result.attempts_deleted} attempt${result.attempts_deleted === 1 ? "" : "s"}.`
        )
      },
      onError: () => toast.error("The workspace could not be cleared."),
    })
  }

  const handleRestore = (filename: string) => {
    restoreBackup.mutate(filename, {
      onSuccess: (result) => {
        setPendingRestore(null)
        if (!result.will_restart) {
          toast.success("Restore staged. Restart Rodeo to apply it.")
          return
        }
        setRestarting(true)
        waitForRodeo()
      },
      onError: () => {
        setPendingRestore(null)
        toast.error("That backup could not be restored.")
      },
    })
  }

  const waitForRodeo = () => {
    const FIRST_CHECK_MS = 5000
    const INTERVAL_MS = 1500
    let healthy = 0

    const attempt = (remaining: number, delay: number) => {
      window.setTimeout(async () => {
        try {
          const response = await fetch("/api/v1/health/ready", {
            cache: "no-store",
          })
          healthy = response.ok ? healthy + 1 : 0
        } catch {
          healthy = 0
        }
        if (healthy >= 2) {
          window.location.reload()
          return
        }
        if (remaining > 0) {
          attempt(remaining - 1, INTERVAL_MS)
          return
        }
        setRestarting(false)
        toast.error("Rodeo is taking a while to restart. Reload the page.")
      }, delay)
    }
    attempt(40, FIRST_CHECK_MS)
  }

  const handleDelete = (filename: string) => {
    deleteBackup.mutate(filename, {
      onSuccess: () => {
        setPendingDelete(null)
        toast.success("Backup deleted.")
      },
      onError: () => {
        setPendingDelete(null)
        toast.error("That backup could not be deleted.")
      },
    })
  }

  const handleBackupNow = () => {
    backupNow.mutate(undefined, {
      onSuccess: () => toast.success("Backup created."),
      onError: () =>
        toast.error("Backup failed. Rodeo will try again in 10 minutes."),
    })
  }

  const handleCopyBackupPath = async () => {
    const location = backupFiles.data?.location ?? backupStatus.data?.location
    if (!location) return
    try {
      await navigator.clipboard.writeText(location)
      toast.success("Backup location copied.")
    } catch {
      toast.error("The backup location could not be copied.")
    }
  }

  const updateDraft = (templateKey: PromptTemplateKey, value: string) => {
    setDrafts((current) => ({ ...current, [templateKey]: value }))
  }

  const insertVariable = (templateKey: PromptTemplateKey, token: string) => {
    const textarea = textareaRefs.current[templateKey]
    const value = drafts[templateKey]
    const start = textarea?.selectionStart ?? value.length
    const end = textarea?.selectionEnd ?? value.length
    const nextValue = `${value.slice(0, start)}${token}${value.slice(end)}`
    updateDraft(templateKey, nextValue)

    window.requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const markSaved = (templateKey: PromptTemplateKey) => {
    setRecentlySaved(templateKey)
    window.setTimeout(() => {
      setRecentlySaved((current) => (current === templateKey ? null : current))
    }, 2200)
  }

  const saveTemplate = (templateKey: PromptTemplateKey) => {
    const template = drafts[templateKey].trim()
    if (!template) {
      toast.error("A prompt template cannot be empty.")
      return
    }
    savePromptTemplate.mutate(
      { templateKey, template },
      {
        onSuccess: (data) => {
          setDrafts({
            session: data.session_template,
            review: data.review_template,
          })
          markSaved(templateKey)
          toast.success(`${TEMPLATE_DETAILS[templateKey].title} saved.`)
        },
        onError: () => toast.error("Prompt template could not be saved."),
      }
    )
  }

  const resetTemplate = (templateKey: PromptTemplateKey) => {
    resetPromptTemplate.mutate(templateKey, {
      onSuccess: (data) => {
        setDrafts({
          session: data.session_template,
          review: data.review_template,
        })
        toast.success(`${TEMPLATE_DETAILS[templateKey].title} reset.`)
      },
      onError: () => toast.error("Prompt template could not be reset."),
    })
  }

  const savedDetail = recentlySaved ? "saved just now" : "2 templates"
  const targetDate = storageValueToDate(goalsDraft.targetDate)
  const backupFileList = backupFiles.data?.files ?? []
  const visibleBackupFiles = backupListOpen
    ? backupFileList
    : backupFileList.slice(0, 3)
  const olderBackupCount = Math.max(backupFileList.length - 3, 0)
  const totalBackupSize = backupFileList.reduce(
    (total, file) => total + file.size_bytes,
    0
  )
  const oldestBackup = backupFileList.at(-1)
  const selectedRestore = backupFileList.find(
    (file) => file.filename === pendingRestore
  )

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3.5">
        <SectionHeading
          detail={goalsJustSaved ? "saved just now" : "used as AI context"}
        >
          Interview goals
        </SectionHeading>

        <Card className="gap-4 py-4 shadow-sm">
          <CardHeader className="px-4">
            <CardTitle className="flex items-center gap-2">
              <TargetIcon className="size-4" />
              Your target interview
            </CardTitle>
            <CardDescription>
              Optional context folded into the dashboard and review prompts so
              feedback can weigh your timeline. Keep it free of identifying
              details &mdash; no names, employers, or contact information.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 px-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goals-target-role">Target role</Label>
              <Input
                id="goals-target-role"
                value={goalsDraft.targetRole}
                onChange={(event) =>
                  setGoalsDraft((current) => ({
                    ...current,
                    targetRole: event.target.value,
                  }))
                }
                placeholder="Backend engineer"
                disabled={interviewGoals.isLoading}
                maxLength={200}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goals-target-date">Target interview date</Label>
              <Popover open={targetDateOpen} onOpenChange={setTargetDateOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      id="goals-target-date"
                      type="button"
                      variant="outline"
                      disabled={interviewGoals.isLoading}
                      className="h-9 w-full justify-between rounded-lg font-normal"
                    />
                  }
                >
                  {targetDate ? (
                    formatTargetDate(targetDate)
                  ) : (
                    <span className="text-muted-foreground">Pick a date</span>
                  )}
                  <CalendarIcon className="size-4 text-muted-foreground" />
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={targetDate}
                    onSelect={(next) => {
                      setGoalsDraft((current) => ({
                        ...current,
                        targetDate: next ? dateToStorageValue(next) : "",
                      }))
                      if (next) setTargetDateOpen(false)
                    }}
                    disabled={{ before: new Date() }}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goals-years-experience">
                Years of experience
              </Label>
              <Input
                id="goals-years-experience"
                type="number"
                inputMode="numeric"
                min={0}
                max={60}
                step={1}
                value={goalsDraft.yearsExperience}
                onChange={(event) =>
                  setGoalsDraft((current) => ({
                    ...current,
                    yearsExperience: event.target.value,
                  }))
                }
                placeholder="4"
                disabled={interviewGoals.isLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end px-4 py-4">
            <Button
              type="button"
              size="sm"
              disabled={
                saveInterviewGoals.isPending ||
                interviewGoals.isLoading ||
                !goalsAreDirty
              }
              onClick={handleSaveGoals}
              className={cn(
                "gap-1.5",
                goalsJustSaved &&
                  "bg-emerald-600 text-white hover:bg-emerald-700"
              )}
            >
              {saveInterviewGoals.isPending ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : goalsJustSaved ? (
                <CheckIcon className="size-3.5" />
              ) : (
                <SaveIcon className="size-3.5" />
              )}
              {goalsJustSaved ? "Saved" : "Save goals"}
            </Button>
          </CardFooter>
        </Card>
      </section>

      <section className="flex flex-col gap-3.5">
        <SectionHeading
          detail={
            backupStatus.data
              ? `${backupStatus.data.snapshot_count} snapshot${backupStatus.data.snapshot_count === 1 ? "" : "s"}${backupFiles.data ? `, ${formatFileSize(totalBackupSize)}` : ""}`
              : "local recovery"
          }
        >
          Backups
        </SectionHeading>

        <Card className="gap-4 py-4 shadow-sm">
          <CardHeader className="px-4">
            <CardTitle className="flex items-center gap-2">
              <VaultIcon className="size-4 text-emerald-600" />
              Automatic local backups
              <Badge
                variant="secondary"
                className={cn(
                  "ml-1 gap-1.5",
                  backupStatus.data?.enabled
                    ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    backupStatus.data?.enabled
                      ? "bg-emerald-600"
                      : "bg-muted-foreground"
                  )}
                />
                {backupStatus.data?.enabled ? "On" : "Off"}
              </Badge>
            </CardTitle>
            <CardDescription>
              Once a day Rodeo saves a copy of everything in your workspace to
              this computer, so you can roll back to an earlier day if something
              gets deleted or goes wrong.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-4">
            <div className="flex flex-col justify-between gap-3 rounded-lg border bg-muted/30 p-3.5 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {backupStatus.isLoading ? (
                    "Loading backup status…"
                  ) : backupStatus.data?.last_backup_at ? (
                    <>
                      Last backup{" "}
                      {formatRelativeTime(backupStatus.data.last_backup_at)}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                       , {formatBackupTime(backupStatus.data.last_backup_at)}
                      </span>
                    </>
                  ) : (
                    "No backup yet"
                  )}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {backupStatus.data?.enabled
                    ? backupStatus.data.next_backup_at
                      ? `Next automatic backup ${formatRelativeTime(backupStatus.data.next_backup_at)}`
                      : "Next automatic backup is being scheduled"
                    : "Automatic backups are turned off"}
                  {backupStatus.data
                    ? `, ${backupStatus.data.snapshot_count} snapshot${backupStatus.data.snapshot_count === 1 ? "" : "s"} kept`
                    : ""}
                  {oldestBackup
                    ? `, oldest ${formatBackupDateLabel(oldestBackup.created_at)}`
                    : ""}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="self-start sm:self-auto"
                onClick={handleBackupNow}
                disabled={
                  backupNow.isPending ||
                  backupStatus.isLoading ||
                  backupStatus.data?.enabled === false
                }
              >
                {backupNow.isPending ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <SaveIcon className="size-3.5" />
                )}
                Back up now
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-3.5">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  What a backup contains
                </p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {[
                    "Every attempt, outcome, and timing",
                    "Notes, transcripts, and review queue",
                    "Interview goals and prompt templates",
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                      {item}
                    </li>
                  ))}
                  <li className="flex gap-2">
                    {backupStatus.data?.recordings_included ? (
                      <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                    ) : (
                      <CircleHelpIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    {backupStatus.data?.recordings_included
                      ? "One copy of each audio recording"
                      : "Audio recordings are not included"}
                  </li>
                </ul>
              </div>

              <div className="rounded-lg border p-3.5">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Where it is kept
                </p>
                <div className="mt-2 flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5">
                  <code className="min-w-0 flex-1 truncate text-xs">
                    {backupFiles.data?.location ??
                      backupStatus.data?.location ??
                      "Loading…"}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={handleCopyBackupPath}
                    disabled={!backupStatus.data?.location}
                  >
                    <CopyIcon className="size-3" />
                    Copy path
                  </Button>
                </div>
                <p className="mt-2 flex gap-2 text-xs leading-relaxed text-muted-foreground">
                  <CircleHelpIcon className="mt-0.5 size-3.5 shrink-0" />
                  Stored on this computer. Nothing is uploaded. Add this folder
                  to Time Machine or File History to protect it from disk loss.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <div className="flex flex-col justify-between gap-1 border-b bg-muted/30 px-3 py-2.5 sm:flex-row sm:items-center">
                <p className="text-sm font-semibold">Restore a backup</p>
                <p className="text-xs text-muted-foreground">
                  Pick a day to roll back to
                </p>
              </div>
              <div>
                {backupFiles.isLoading ? (
                  <p className="p-3 text-xs text-muted-foreground">
                    Loading backups…
                  </p>
                ) : backupFiles.isError ? (
                  <p className="p-3 text-xs text-destructive">
                    Backups could not be loaded.
                  </p>
                ) : visibleBackupFiles.length ? (
                  <ul className="divide-y">
                    {visibleBackupFiles.map((file, index) => (
                      <li
                        key={file.filename}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 font-medium">
                            {formatBackupDateLabel(file.created_at)}
                            {index === 0 ? (
                              <span className="text-2xs font-medium text-emerald-700 dark:text-emerald-400">
                                Latest
                              </span>
                            ) : null}
                          </div>
                          <div className="text-muted-foreground">
                            {file.attempt_count === null ||
                            file.attempt_count === undefined
                              ? `Contents unreadable, ${formatFileSize(file.size_bytes)}`
                              : `${file.attempt_count} attempt${file.attempt_count === 1 ? "" : "s"}, ${file.solved_count} solved, ${formatFileSize(file.size_bytes)}`}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={restoreBackup.isPending || restarting}
                            onClick={() => setPendingRestore(file.filename)}
                          >
                            <RotateCcwIcon className="size-3.5" />
                            Restore…
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Delete backup from ${formatBackupTime(file.created_at)}`}
                            disabled={deleteBackup.isPending || restarting}
                            onClick={() => setPendingDelete(file.filename)}
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="p-3 text-xs text-muted-foreground">
                    No snapshots yet.
                  </p>
                )}
                {olderBackupCount > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full rounded-none border-t text-muted-foreground"
                    onClick={() => setBackupListOpen((open) => !open)}
                  >
                    {backupListOpen
                      ? "Show only recent backups"
                      : `Show ${olderBackupCount} older backup${olderBackupCount === 1 ? "" : "s"}`}
                    <ChevronDownIcon
                      className={cn(
                        "size-3.5 transition-transform",
                        backupListOpen && "rotate-180"
                      )}
                    />
                  </Button>
                ) : null}
              </div>
              <p className="border-t bg-muted/30 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                Restoring replaces everything you have now with that day&apos;s
                copy and restarts Rodeo. Your current data is saved first, so a
                restore can be undone.
              </p>
            </div>

            <div className="flex gap-2 rounded-lg border p-3 text-xs leading-relaxed text-muted-foreground">
              <DownloadIcon className="mt-0.5 size-3.5 shrink-0" />
              <p>
                <span className="font-semibold text-foreground">
                  Need a copy you can move to another computer?
                </span>{" "}
                Backups stay on this machine. Use{" "}
                <a
                  href="#workspace"
                  className="font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground"
                >
                  Export all data
                </a>{" "}
                under Workspace to download a single portable file.
              </p>
            </div>

            <AlertDialog
              open={pendingDelete !== null}
              onOpenChange={(open) => {
                if (!open) setPendingDelete(null)
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this backup?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The snapshot from{" "}
                    {formatBackupTime(
                      backupFiles.data?.files.find(
                        (file) => file.filename === pendingDelete
                      )?.created_at
                    )}{" "}
                    will be removed permanently. Your other backups and your
                    current data are not affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={deleteBackup.isPending}
                    onClick={() => {
                      if (pendingDelete) handleDelete(pendingDelete)
                    }}
                  >
                    Delete backup
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={restarting}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogMedia>
                    <Loader2Icon className="size-5 animate-spin" />
                  </AlertDialogMedia>
                  <AlertDialogTitle>Restoring your backup</AlertDialogTitle>
                  <AlertDialogDescription>
                    Rodeo is restarting. This usually takes 10 to 15 seconds.
                    The page will reload automatically.
                  </AlertDialogDescription>
                </AlertDialogHeader>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
              open={pendingRestore !== null}
              onOpenChange={(open) => {
                if (!open) setPendingRestore(null)
              }}
            >
              <AlertDialogContent className="sm:max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Restore the backup from{" "}
                    {selectedRestore
                      ? formatBackupDateLabel(selectedRestore.created_at)
                      : "this date"}
                    ?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Here is exactly what will happen:
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <ol className="space-y-2.5 text-sm leading-relaxed">
                  <li className="flex gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold">
                      1
                    </span>
                    <span>
                      Your current data is copied to the{" "}
                      <code className="rounded bg-muted px-1 py-0.5 text-xs">
                        pre-restore
                      </code>{" "}
                      folder, so this can be undone.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold">
                      2
                    </span>
                    <span>
                      Everything logged after this backup is replaced and will
                      no longer appear in Rodeo.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold">
                      3
                    </span>
                    <span>
                      Rodeo restarts and reloads the page, usually within 10 to
                      15 seconds.
                    </span>
                  </li>
                </ol>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={restoreBackup.isPending}
                    onClick={() => {
                      if (pendingRestore) handleRestore(pendingRestore)
                    }}
                  >
                    Restore and restart
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3.5">
        <SectionHeading detail={savedDetail}>
          AI prompt templates
        </SectionHeading>

        <div className="grid gap-6 xl:grid-cols-2">
          {(["session", "review"] as const).map((templateKey) => {
            const detail = TEMPLATE_DETAILS[templateKey]
            const Icon = detail.icon
            const value = drafts[templateKey]
            const savedValue =
              templateKey === "session"
                ? promptTemplates.data?.session_template
                : promptTemplates.data?.review_template
            const isSaved = recentlySaved === templateKey

            return (
              <Card key={templateKey} className="h-full gap-4 py-4 shadow-sm">
                <CardHeader className="px-4">
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="size-4" />
                    {detail.title}
                  </CardTitle>
                  <CardDescription>{detail.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-2.5 px-4">
                  <Label htmlFor={`${templateKey}-template`}>Template</Label>
                  <Textarea
                    ref={(element) => {
                      textareaRefs.current[templateKey] = element
                    }}
                    id={`${templateKey}-template`}
                    rows={10}
                    value={value}
                    onChange={(event) =>
                      updateDraft(templateKey, event.target.value)
                    }
                    disabled={promptTemplates.isLoading}
                    spellCheck={false}
                    className="max-h-96 min-h-50 resize-y overflow-y-auto font-mono text-xs leading-relaxed"
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 font-mono text-2xs tracking-widest text-muted-foreground uppercase">
                      Variables
                    </span>
                    {detail.variables.map((token) => (
                      <Button
                        key={token}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={promptTemplates.isLoading}
                        onClick={() => insertVariable(templateKey, token)}
                        className="h-6 rounded-md bg-muted px-2 font-mono text-2xs font-normal hover:bg-muted/70"
                      >
                        {token}
                      </Button>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="justify-between gap-3 px-4 py-4">
                  <span className="font-mono text-2xs text-muted-foreground">
                    {countWords(value)} words, {value.length} characters
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        resetPromptTemplate.isPending ||
                        promptTemplates.isLoading
                      }
                      onClick={() => resetTemplate(templateKey)}
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        savePromptTemplate.isPending ||
                        promptTemplates.isLoading ||
                        !value.trim() ||
                        value === savedValue
                      }
                      onClick={() => saveTemplate(templateKey)}
                      className={cn(
                        "gap-1.5",
                        isSaved &&
                          "bg-emerald-600 text-white hover:bg-emerald-700"
                      )}
                    >
                      {savePromptTemplate.isPending ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : isSaved ? (
                        <CheckIcon className="size-3.5" />
                      ) : (
                        <SaveIcon className="size-3.5" />
                      )}
                      {isSaved ? "Saved" : "Save template"}
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </section>

      <section id="workspace" className="flex scroll-mt-6 flex-col gap-3.5">
        <SectionHeading detail="stored on this device">
          Workspace
        </SectionHeading>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="h-full gap-4 py-4 shadow-sm">
            <CardHeader className="px-4">
              <CardTitle className="flex items-center gap-2">
                <HardDriveIcon className="size-4 text-emerald-600" />
                Your data
              </CardTitle>
              <CardDescription>
                Keep a portable copy of your attempts, notes, and progress.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3 px-4">
              <div className="rounded-lg border bg-muted/40 p-3.5">
                <p className="text-sm font-medium">Export your workspace</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Download a complete backup of your data as a single file.
                </p>
                <Button
                  size="sm"
                  className={cn(
                    "mt-3 gap-1.5",
                    justExported &&
                      "bg-emerald-600 text-white hover:bg-emerald-700"
                  )}
                  onClick={handleExport}
                  disabled={exportWorkspace.isPending || justExported}
                >
                  {exportWorkspace.isPending ? (
                    <>
                      <Loader2Icon className="size-3.5 animate-spin" />{" "}
                      Preparing export…
                    </>
                  ) : justExported ? (
                    <>
                      <CheckIcon className="size-3.5" /> Downloaded
                    </>
                  ) : (
                    <>
                      <DownloadIcon className="size-3.5" /> Export all data
                    </>
                  )}
                </Button>
              </div>
              <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                Exports stay on this device. Rodeo does not upload your data to
                a cloud service.
              </p>
            </CardContent>
          </Card>

          <Card className="h-full gap-4 border-destructive/25 py-4 shadow-sm">
            <CardHeader className="px-4">
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2Icon className="size-4" /> Danger zone
              </CardTitle>
              <CardDescription>
                Permanently remove your local workspace and start fresh.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3 px-4">
              <div className="rounded-lg border border-destructive/20 bg-destructive/4 p-3.5">
                <p className="text-sm font-medium">Clear your workspace</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Permanently delete every attempt, note, and setting stored
                  here.
                </p>
                <AlertDialog
                  open={dialogOpen}
                  onOpenChange={(open) => {
                    setDialogOpen(open)
                    if (!open) setClearText("")
                  }}
                >
                  <AlertDialogTrigger
                    render={
                      <Button
                        variant="destructive"
                        size="sm"
                        className="mt-3 gap-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20"
                      />
                    }
                  >
                    <Trash2Icon className="size-3.5" /> Clear all data
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogMedia className="bg-destructive/10 text-destructive">
                        <Trash2Icon className="size-5" />
                      </AlertDialogMedia>
                      <AlertDialogTitle>Clear your workspace?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently deletes attempts, notes, and settings
                        on this device. Export a backup first.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="grid gap-1.5 py-2">
                      <Label htmlFor="clear-workspace" className="font-normal">
                        To confirm, type{" "}
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground">
                          DELETE
                        </span>{" "}
                        below
                      </Label>
                      <Input
                        id="clear-workspace"
                        value={clearText}
                        onChange={(event) => setClearText(event.target.value)}
                        placeholder="DELETE"
                        className={cn(
                          clearText === "DELETE" &&
                            "border-emerald-600 focus-visible:ring-emerald-600"
                        )}
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setClearText("")}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        disabled={
                          clearText !== "DELETE" || clearWorkspace.isPending
                        }
                        onClick={handleClear}
                      >
                        {clearWorkspace.isPending ? (
                          <>
                            <Loader2Icon className="size-3.5 animate-spin" />{" "}
                            Clearing…
                          </>
                        ) : (
                          "Permanently clear data"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <CircleHelpIcon className="mt-0.5 size-3.5 shrink-0" />
                This deletes attempts, notes, and settings on this device.
                Export a backup first.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
