import * as React from "react"

/**
 * Renders the small markdown subset the notes editor exposes: headings, bold,
 * italic, inline code, fenced code, bullet and numbered lists, quotes, links.
 * Output is React nodes rather than HTML, so note content is never injected.
 */

const INLINE_PATTERN =
  /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const segments = text.split(INLINE_PATTERN).filter(Boolean)

  return segments.map((segment, index) => {
    const key = `${keyPrefix}-${index}`

    if (
      (segment.startsWith("**") && segment.endsWith("**")) ||
      (segment.startsWith("__") && segment.endsWith("__"))
    ) {
      return <strong key={key}>{segment.slice(2, -2)}</strong>
    }

    if (
      (segment.startsWith("*") && segment.endsWith("*")) ||
      (segment.startsWith("_") && segment.endsWith("_"))
    ) {
      return <em key={key}>{segment.slice(1, -1)}</em>
    }

    if (segment.startsWith("`") && segment.endsWith("`")) {
      return (
        <code
          key={key}
          className="rounded-sm bg-muted px-1 py-0.5 font-mono text-xs"
        >
          {segment.slice(1, -1)}
        </code>
      )
    }

    const link = segment.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
    if (link) {
      return (
        <a
          key={key}
          href={link[2]}
          target="_blank"
          rel="noreferrer"
          className="text-sky-600 underline underline-offset-2 dark:text-sky-400"
        >
          {link[1]}
        </a>
      )
    }

    return <React.Fragment key={key}>{segment}</React.Fragment>
  })
}

export function renderMarkdown(source: string): React.ReactNode[] {
  const lines = source.split("\n")
  const blocks: React.ReactNode[] = []

  let paragraph: string[] = []
  let bullets: string[] = []
  let numbers: string[] = []
  let code: string[] | null = null

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return
    }

    const key = `p-${blocks.length}`
    blocks.push(<p key={key}>{renderInline(paragraph.join(" "), key)}</p>)
    paragraph = []
  }

  const flushBullets = () => {
    if (bullets.length === 0) {
      return
    }

    const key = `ul-${blocks.length}`
    blocks.push(
      <ul key={key} className="list-disc pl-5">
        {bullets.map((item, index) => (
          <li key={`${key}-${index}`}>{renderInline(item, `${key}-${index}`)}</li>
        ))}
      </ul>
    )
    bullets = []
  }

  const flushNumbers = () => {
    if (numbers.length === 0) {
      return
    }

    const key = `ol-${blocks.length}`
    blocks.push(
      <ol key={key} className="list-decimal pl-5">
        {numbers.map((item, index) => (
          <li key={`${key}-${index}`}>{renderInline(item, `${key}-${index}`)}</li>
        ))}
      </ol>
    )
    numbers = []
  }

  const flushAll = () => {
    flushParagraph()
    flushBullets()
    flushNumbers()
  }

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (code === null) {
        flushAll()
        code = []
        continue
      }

      const key = `pre-${blocks.length}`
      blocks.push(
        <pre
          key={key}
          className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs"
        >
          <code>{code.join("\n")}</code>
        </pre>
      )
      code = null
      continue
    }

    if (code !== null) {
      code.push(line)
      continue
    }

    if (line.trim() === "") {
      flushAll()
      continue
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      flushAll()
      const key = `h-${blocks.length}`
      const level = heading[1].length
      const sizes = ["text-base", "text-sm", "text-sm"]
      blocks.push(
        <p key={key} className={`font-semibold ${sizes[level - 1]}`}>
          {renderInline(heading[2], key)}
        </p>
      )
      continue
    }

    const quote = line.match(/^>\s?(.*)$/)
    if (quote) {
      flushAll()
      const key = `q-${blocks.length}`
      blocks.push(
        <blockquote
          key={key}
          className="border-l-2 border-border pl-3 text-muted-foreground"
        >
          {renderInline(quote[1], key)}
        </blockquote>
      )
      continue
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    if (bullet) {
      flushParagraph()
      flushNumbers()
      bullets.push(bullet[1])
      continue
    }

    const numbered = line.match(/^\s*\d+\.\s+(.*)$/)
    if (numbered) {
      flushParagraph()
      flushBullets()
      numbers.push(numbered[1])
      continue
    }

    flushBullets()
    flushNumbers()
    paragraph.push(line)
  }

  if (code !== null) {
    const key = `pre-${blocks.length}`
    blocks.push(
      <pre
        key={key}
        className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs"
      >
        <code>{code.join("\n")}</code>
      </pre>
    )
  }

  flushAll()

  return blocks
}
