import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleDotIcon,
  ExternalLinkIcon,
  LockIcon,
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
import { deriveStatus, formatLastAttempt } from "@/lib/attempts"
import { problemUrl } from "@/lib/problems"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/use-app-store"
import type {
  Attempt,
  Difficulty,
  Problem,
  ProblemColumnId,
  ProblemStatus,
} from "@/types"

const difficultyStyles: Record<Difficulty, string> = {
  easy: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  hard: "bg-destructive/10 text-destructive",
}

const difficultyLabels: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
}

const statusMeta: Record<
  ProblemStatus,
  { label: string; icon: typeof CircleDashedIcon; className: string }
> = {
  "not-started": {
    label: "Not started",
    icon: CircleDashedIcon,
    className: "text-muted-foreground",
  },
  solved: {
    label: "Solved",
    icon: CircleCheckIcon,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  review: {
    label: "Review",
    icon: CircleDotIcon,
    className: "text-amber-600 dark:text-amber-400",
  },
  struggling: {
    label: "Struggling",
    icon: CircleAlertIcon,
    className: "text-destructive",
  },
}

function StatusCell({ attempt }: { attempt: Attempt | undefined }) {
  const status = deriveStatus(attempt)
  const { label, icon: Icon, className } = statusMeta[status]

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

  const [elapsed, duration, outcome] = formatLastAttempt(attempt)

  return (
    <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
      <span>{elapsed}</span>
      <span className="text-muted-foreground">·</span>
      <span className="tabular-nums text-muted-foreground">{duration}</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">{outcome}</span>
    </span>
  )
}

interface ProblemsTableProps {
  problems: Problem[]
  visibleColumns: ProblemColumnId[]
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function ProblemsTable({
  problems,
  visibleColumns,
  page,
  pageSize,
  total,
  onPageChange,
}: ProblemsTableProps) {
  const lastAttemptByProblem = useAppStore((state) => state.lastAttemptByProblem)

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
                const attempt = lastAttemptByProblem[problem.id]

                return (
                  <TableRow key={problem.id} className="h-14">
                    {shows("status") ? (
                      <TableCell className="pl-6">
                        <StatusCell attempt={attempt} />
                      </TableCell>
                    ) : null}
                    {shows("number") ? (
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {problem.id}
                      </TableCell>
                    ) : null}
                    {shows("problem") ? (
                      <TableCell>
                        <a
                          href={problemUrl(problem)}
                          target="_blank"
                          rel="noreferrer"
                          className="group inline-flex items-center gap-2 font-medium"
                        >
                          {problem.title}
                          {problem.premium ? (
                            <LockIcon className="size-3.5 text-muted-foreground" />
                          ) : null}
                          <ExternalLinkIcon className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </a>
                      </TableCell>
                    ) : null}
                    {shows("topic") ? (
                      <TableCell title={problem.topics.join(", ")}>
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          {problem.topics.slice(0, 1).map((topic) => (
                            <Badge
                              key={topic}
                              variant="outline"
                              className="rounded-md font-normal text-muted-foreground"
                            >
                              {topic}
                            </Badge>
                          ))}
                          {problem.topics.length > 1 ? (
                            <span className="text-xs text-muted-foreground">
                              +{problem.topics.length - 1}
                            </span>
                          ) : null}
                          {problem.topics.length === 0 ? (
                            <span className="text-sm text-muted-foreground">—</span>
                          ) : null}
                        </div>
                      </TableCell>
                    ) : null}
                    {shows("difficulty") ? (
                      <TableCell>
                        <Badge
                          className={cn(
                            "rounded-md font-medium",
                            difficultyStyles[problem.difficulty]
                          )}
                        >
                          {difficultyLabels[problem.difficulty]}
                        </Badge>
                      </TableCell>
                    ) : null}
                    {shows("lastAttempt") ? (
                      <TableCell>
                        <LastAttemptCell attempt={attempt} />
                      </TableCell>
                    ) : null}
                    {shows("acceptance") ? (
                      <TableCell className="pr-6 text-right tabular-nums text-muted-foreground">
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
