import * as React from "react"
import { SearchIcon } from "lucide-react"

import {
  DIFFICULTY_LABELS,
  DIFFICULTY_STYLES,
} from "@/components/problems/problem-meta"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useProblems } from "@/hooks/use-problems"
import { cn } from "@/lib/utils"
import type { Problem } from "@/types"

const MAX_RESULTS = 50

interface LogSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectProblem: (problem: Problem) => void
}

function matchesProblem(problem: Problem, query: string): boolean {
  if (!query) {
    return true
  }

  return (
    String(problem.id) === query ||
    problem.title.toLowerCase().includes(query) ||
    problem.slug.includes(query.replace(/\s+/g, "-"))
  )
}

export function LogSessionDialog({
  open,
  onOpenChange,
  onSelectProblem,
}: LogSessionDialogProps) {
  const [search, setSearch] = React.useState("")
  const { problems, status } = useProblems({
    filters: { search, difficulty: "all", status: "all", access: "all" },
    page: 0,
    pageSize: MAX_RESULTS,
    sort: "id-asc",
  })

  const results = React.useMemo(() => {
    const query = search.trim().toLowerCase()

    return problems
      .filter((problem) => matchesProblem(problem, query))
      .slice(0, MAX_RESULTS)
  }, [problems, search])

  const close = () => {
    setSearch("")
    onOpenChange(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      close()
      return
    }

    onOpenChange(true)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-svh gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <DialogHeader className="gap-1.5 p-5 pb-4">
          <DialogTitle>Log problem</DialogTitle>
          <DialogDescription>
            Choose a problem to open its timer and session controls.
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 border-t border-border px-5 pt-4 pb-5">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title or number"
              aria-label="Search problems to log"
              className="h-10 pl-9"
            />
          </div>

          <div className="mt-3 h-80 overflow-y-auto rounded-lg border border-border p-1">
            {status === "loading" ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Loading problem catalog…
              </p>
            ) : null}

            {status === "error" ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                The problem catalog could not be loaded.
              </p>
            ) : null}

            {status === "ready" && results.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No problems match that search.
              </p>
            ) : null}

            {status === "ready"
              ? results.map((problem) => (
                  <button
                    key={problem.id}
                    type="button"
                    onClick={() => {
                      setSearch("")
                      onSelectProblem(problem)
                    }}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                  >
                    <span className="w-9 font-mono text-xs text-muted-foreground">
                      #{problem.id}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {problem.title}
                    </span>
                    <Badge
                      className={cn(
                        "rounded-md font-medium",
                        DIFFICULTY_STYLES[problem.difficulty]
                      )}
                    >
                      {DIFFICULTY_LABELS[problem.difficulty]}
                    </Badge>
                  </button>
                ))
              : null}
            </div>
          </div>
      </DialogContent>
    </Dialog>
  )
}
