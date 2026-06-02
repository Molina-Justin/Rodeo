import { ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon, LockIcon } from "lucide-react"

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
import { problemUrl } from "@/lib/problems"
import { cn } from "@/lib/utils"
import type { Difficulty, Problem } from "@/types"

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

interface ProblemsTableProps {
  problems: Problem[]
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function ProblemsTable({
  problems,
  page,
  pageSize,
  total,
  onPageChange,
}: ProblemsTableProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const firstRow = total === 0 ? 0 : page * pageSize + 1
  const lastRow = Math.min(total, (page + 1) * pageSize)

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="h-11 w-20 pl-6">#</TableHead>
              <TableHead className="h-11">Title</TableHead>
              <TableHead className="h-11 w-32">Difficulty</TableHead>
              <TableHead className="h-11">Topics</TableHead>
              <TableHead className="h-11 w-32 pr-6 text-right">
                Acceptance
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {problems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-32 text-center text-muted-foreground"
                >
                  No problems match these filters.
                </TableCell>
              </TableRow>
            ) : (
              problems.map((problem) => (
                <TableRow key={problem.id} className="h-14">
                  <TableCell className="pl-6 font-mono text-xs text-muted-foreground">
                    {problem.id}
                  </TableCell>
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
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {problem.topics.slice(0, 2).map((topic) => (
                        <Badge
                          key={topic}
                          variant="outline"
                          className="rounded-md font-normal text-muted-foreground"
                        >
                          {topic}
                        </Badge>
                      ))}
                      {problem.topics.length > 2 ? (
                        <span className="text-xs text-muted-foreground">
                          +{problem.topics.length - 2}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="pr-6 text-right tabular-nums text-muted-foreground">
                    {problem.acceptance.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))
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
