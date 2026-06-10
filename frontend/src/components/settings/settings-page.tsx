import * as React from "react"
import {
  CheckIcon,
  CircleHelpIcon,
  DownloadIcon,
  HardDriveIcon,
  Loader2Icon,
  MessageSquareQuoteIcon,
  RotateCcwIcon,
  SaveIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react"
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  usePromptTemplates,
  useResetPromptTemplate,
  useSavePromptTemplate,
} from "@/hooks/use-prompt-templates"
import { useClearWorkspace, useExportWorkspace } from "@/hooks/use-system"
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
    ],
    icon: MessageSquareQuoteIcon,
  },
}

function countWords(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
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

  React.useEffect(() => {
    if (!promptTemplates.data) {
      return
    }
    setDrafts({
      session: promptTemplates.data.session_template,
      review: promptTemplates.data.review_template,
    })
  }, [promptTemplates.data])

  const handleExport = () => {
    exportWorkspace.mutate(undefined, {
      onSuccess: () => {
        setJustExported(true)
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
        toast.success("Prompt template reset to its default.")
      },
      onError: () => toast.error("Prompt template could not be reset."),
    })
  }

  const isTemplatePending =
    savePromptTemplate.isPending || resetPromptTemplate.isPending
  const savedDetail = recentlySaved ? "saved just now" : "2 templates"

  return (
    <div className="flex flex-col gap-8">
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
                    className="min-h-50 resize-y font-mono text-xs leading-relaxed"
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
                    {countWords(value)} words · {value.length} characters
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isTemplatePending || promptTemplates.isLoading}
                      onClick={() => resetTemplate(templateKey)}
                      className="gap-1.5"
                    >
                      <RotateCcwIcon className="size-3.5" /> Reset
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        isTemplatePending ||
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

      <section className="flex flex-col gap-3.5">
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
