import * as React from "react"
import {
  BoldIcon,
  CodeIcon,
  Heading2Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { renderMarkdown } from "@/lib/markdown"

type Wrap = { kind: "wrap"; before: string; after: string }
type Prefix = { kind: "prefix"; value: string; numbered?: boolean }
type Action = Wrap | Prefix

const actions: { label: string; icon: typeof BoldIcon; action: Action }[] = [
  {
    label: "Bold",
    icon: BoldIcon,
    action: { kind: "wrap", before: "**", after: "**" },
  },
  {
    label: "Italic",
    icon: ItalicIcon,
    action: { kind: "wrap", before: "_", after: "_" },
  },
  {
    label: "Code",
    icon: CodeIcon,
    action: { kind: "wrap", before: "`", after: "`" },
  },
  {
    label: "Heading",
    icon: Heading2Icon,
    action: { kind: "prefix", value: "## " },
  },
  {
    label: "Bullet list",
    icon: ListIcon,
    action: { kind: "prefix", value: "- " },
  },
  {
    label: "Numbered list",
    icon: ListOrderedIcon,
    action: { kind: "prefix", value: "1. ", numbered: true },
  },
  {
    label: "Quote",
    icon: QuoteIcon,
    action: { kind: "prefix", value: "> " },
  },
  {
    label: "Link",
    icon: LinkIcon,
    action: { kind: "wrap", before: "[", after: "](url)" },
  },
]

function applyAction(value: string, start: number, end: number, action: Action) {
  if (action.kind === "wrap") {
    const selected = value.slice(start, end) || "text"
    const next =
      value.slice(0, start) +
      action.before +
      selected +
      action.after +
      value.slice(end)

    return {
      next,
      selectionStart: start + action.before.length,
      selectionEnd: start + action.before.length + selected.length,
    }
  }

  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1
  const lineEnd = value.indexOf("\n", end) === -1 ? value.length : value.indexOf("\n", end)
  const lines = value.slice(lineStart, lineEnd).split("\n")

  const prefixed = lines
    .map((line, index) =>
      action.numbered ? `${index + 1}. ${line}` : `${action.value}${line}`
    )
    .join("\n")

  const next = value.slice(0, lineStart) + prefixed + value.slice(lineEnd)

  return {
    next,
    selectionStart: lineStart,
    selectionEnd: lineStart + prefixed.length,
  }
}

interface NotesEditorProps {
  value: string
  onChange: (value: string) => void
}

export function NotesEditor({ value, onChange }: NotesEditorProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const run = (action: Action) => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    const { next, selectionStart, selectionEnd } = applyAction(
      value,
      textarea.selectionStart,
      textarea.selectionEnd,
      action
    )

    onChange(next)

    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(selectionStart, selectionEnd)
    })
  }

  return (
    <Tabs defaultValue="write" className="gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-0.5">
          {actions.map(({ label, icon: Icon, action }) => (
            <Button
              key={label}
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-md text-muted-foreground hover:text-foreground"
              aria-label={label}
              title={label}
              onClick={() => run(action)}
            >
              <Icon />
            </Button>
          ))}
        </div>
        <TabsList variant="line" className="h-8">
          <TabsTrigger value="write" className="rounded-md px-2.5 text-xs">
            Write
          </TabsTrigger>
          <TabsTrigger value="preview" className="rounded-md px-2.5 text-xs">
            Preview
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="write">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="What tripped you up? What would you do differently next time?"
          className="min-h-32 rounded-lg font-mono text-xs"
        />
      </TabsContent>
      <TabsContent value="preview">
        <div className="flex min-h-32 flex-col gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          {value.trim() === "" ? (
            <span className="text-muted-foreground">Nothing to preview.</span>
          ) : (
            renderMarkdown(value)
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}
