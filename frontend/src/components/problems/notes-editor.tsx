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
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { renderMarkdown } from "@/lib/markdown"

type Wrap = { kind: "wrap"; before: string; after: string }
type Prefix = { kind: "prefix"; value: string; numbered?: boolean }
type Action = Wrap | Prefix

const actionGroups: {
  label: string
  icon: typeof BoldIcon
  action: Action
}[][] = [
  [
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
  ],
  [
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
  ],
  [
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
  ],
]

function applyAction(
  value: string,
  start: number,
  end: number,
  action: Action
) {
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
  const lineEnd =
    value.indexOf("\n", end) === -1 ? value.length : value.indexOf("\n", end)
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
  const [mode, setMode] = React.useState<"write" | "preview">("write")

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
    <div className="overflow-hidden rounded-lg border border-input focus-within:border-ring">
      <div className="flex items-center justify-between gap-2 border-b border-input bg-muted/40 px-2 py-1.5">
        <div className="flex items-center gap-1">
          {actionGroups.map((group, index) => (
            <React.Fragment key={group[0].label}>
              {index > 0 ? (
                <Separator
                  orientation="vertical"
                  className="mx-1 h-4 data-vertical:self-auto"
                />
              ) : null}
              {group.map(({ label, icon: Icon, action }) => (
                <Button
                  key={label}
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={mode === "preview"}
                  className="size-7 rounded-md text-muted-foreground hover:text-foreground"
                  aria-label={label}
                  title={label}
                  onClick={() => run(action)}
                >
                  <Icon className="size-3.5" />
                </Button>
              ))}
            </React.Fragment>
          ))}
        </div>

        <ToggleGroup
          spacing={0}
          variant="outline"
          size="sm"
          value={[mode]}
          onValueChange={(values) => {
            const next = values[0] as "write" | "preview" | undefined
            if (next) {
              setMode(next)
            }
          }}
        >
          <ToggleGroupItem
            value="write"
            className="px-2.5 text-xs font-medium text-muted-foreground transition-[background-color,color,box-shadow] hover:text-foreground aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:shadow-sm data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:shadow-sm"
          >
            Write
          </ToggleGroupItem>
          <ToggleGroupItem
            value="preview"
            className="px-2.5 text-xs font-medium text-muted-foreground transition-[background-color,color,box-shadow] hover:text-foreground aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:shadow-sm data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:shadow-sm"
          >
            Preview
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {mode === "write" ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="What tripped you up? What would you do differently next time?"
          className="min-h-28 w-full resize-none bg-transparent px-3 py-2.5 font-mono text-xs outline-none placeholder:text-muted-foreground"
        />
      ) : (
        <div className="flex min-h-28 flex-col gap-2 px-3 py-2.5 text-sm">
          {value.trim() === "" ? (
            <span className="text-muted-foreground">Nothing to preview.</span>
          ) : (
            renderMarkdown(value)
          )}
        </div>
      )}
    </div>
  )
}
