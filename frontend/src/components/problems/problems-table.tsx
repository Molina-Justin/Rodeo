import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ListIcon,
  LockIcon,
  MicIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_STYLES,
  STATUS_META,
} from "@/components/problems/problem-meta"
import { formatElapsed } from "@/lib/attempts"
import { cn } from "@/lib/utils"
import type { Attempt, Problem, ProblemColumnId } from "@/types"

function StatusCell({ status }: { status: Problem["status"] }) {
  const { label, icon: Icon, className } = STATUS_META[status]

  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <Icon className="size-4" />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </span>
  )
}

function LastAttemptCell({ attempt }: { attempt: Attempt | undefined }) {
  if (!attempt) {
    return <span className="text-sm text-muted-foreground">Never</span>
  }

  return (
    <span className="text-sm whitespace-nowrap">
      {formatElapsed(attempt.completedAt)}
    </span>
  )
}

interface ProblemsTableProps {
  problems: Problem[]
  onSelect: (problem: Problem) => void
  visibleColumns: ProblemColumnId[]
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function ProblemsTable({
  problems,
  onSelect,
  visibleColumns,
  page,
  pageSize,
  total,
  onPageChange,
}: ProblemsTableProps) {
  const shows = (column: ProblemColumnId) => visibleColumns.includes(column)
  const columnCount = visibleColumns.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const firstRow = total === 0 ? 0 : page * pageSize + 1
  const lastRow = Math.min(total, (page + 1) * pageSize)

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {shows("status") ? (
                <TableHead className="h-11 w-36 pl-6">Status</TableHead>
              ) : null}
              {shows("number") ? (
                <TableHead className="h-11 w-20">#</TableHead>
              ) : null}
              {shows("problem") ? (
                <TableHead className="h-11">Problem</TableHead>
              ) : null}
              {shows("topic") ? (
                <TableHead className="h-11 w-48">Topic</TableHead>
              ) : null}
              {shows("difficulty") ? (
                <TableHead className="h-11 w-32">Difficulty</TableHead>
              ) : null}
              {shows("lastAttempt") ? (
                <TableHead className="h-11 w-56">Last attempt</TableHead>
              ) : null}
              {shows("acceptance") ? (
                <TableHead className="h-11 w-32 pr-6 text-right">
                  Acceptance
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {problems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="h-32 text-center text-muted-foreground"
                >
                  No problems match these filters.
                </TableCell>
              </TableRow>
            ) : (
              problems.map((problem) => {
                const attempt = problem.lastAttempt

                return (
                  <TableRow
                    key={problem.id}
                    className="h-14 cursor-pointer"
                    onClick={() => onSelect(problem)}
                  >
                    {shows("status") ? (
                      <TableCell className="pl-6">
                        <StatusCell status={problem.status} />
                      </TableCell>
                    ) : null}
                    {shows("number") ? (
                      <TableCell className="font-mono text-xs text-sky-700/80 dark:text-sky-300/80">
                        {problem.id}
                      </TableCell>
                    ) : null}
                    {shows("problem") ? (
                      <TableCell>
                        <span className="inline-flex items-center gap-2 font-medium">
                          {problem.title}
                          {problem.hasNotes ? (
                            <span
                              className="text-emerald-600 dark:text-emerald-400"
                              title="Has notes"
                            >
                              <ListIcon className="size-4" />
                              <span className="sr-only">Has notes</span>
                            </span>
                          ) : null}
                          {problem.hasAudio ? (
                            <span
                              className="text-violet-600 dark:text-violet-400"
                              title="Has audio recording"
                            >
                              <MicIcon className="size-4" />
                              <span className="sr-only">
                                Has audio recording
                              </span>
                            </span>
                          ) : null}
                          {problem.premium ? (
                            <LockIcon className="size-3.5 text-amber-600 dark:text-amber-400" />
                          ) : null}
                        </span>
                      </TableCell>
                    ) : null}
                    {shows("topic") ? (
                      <TableCell title={problem.topics.join(", ")}>
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          {problem.topics.slice(0, 1).map((topic) => (
                            <Badge
                              key={topic}
                              variant="outline"
                              className="rounded-md border-violet-500/20 bg-violet-500/10 font-normal text-violet-700 dark:text-violet-300"
                            >
                              {topic}
                            </Badge>
                          ))}
                          {problem.topics.length === 0 ? (
                            <span className="text-sm text-muted-foreground">
                              —
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                    ) : null}
                    {shows("difficulty") ? (
                      <TableCell>
                        <Badge
                          className={cn(
                            "rounded-md font-medium",
                            DIFFICULTY_STYLES[problem.difficulty]
                          )}
                        >
                          {DIFFICULTY_LABELS[problem.difficulty]}
                        </Badge>
                      </TableCell>
                    ) : null}
                    {shows("lastAttempt") ? (
                      <TableCell>
                        <LastAttemptCell attempt={attempt} />
                      </TableCell>
                    ) : null}
                    {shows("acceptance") ? (
                      <TableCell className="pr-6 text-right text-muted-foreground tabular-nums">
                        {problem.acceptance.toFixed(1)}%
                      </TableCell>
                    ) : null}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {firstRow}–{lastRow} of {total.toLocaleString()} problems
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {pageCount.toLocaleString()}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-lg"
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-lg"
            disabled={page + 1 >= pageCount}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}
