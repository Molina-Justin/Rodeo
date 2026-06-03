import * as React from "react"
import { TriangleAlertIcon } from "lucide-react"

import {
  DEFAULT_VISIBLE_COLUMNS,
  PROBLEM_COLUMNS,
} from "@/components/problems/problems-columns"
import { ProblemsTable } from "@/components/problems/problems-table"
import { ProblemsToolbar } from "@/components/problems/problems-toolbar"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { useProblems } from "@/hooks/use-problems"
import { filterProblems, sortProblems } from "@/lib/problems"
import { useAppStore } from "@/store/use-app-store"
import type { ProblemColumnId, ProblemFilters, ProblemSort } from "@/types"

const PAGE_SIZE = 25

const defaultFilters: ProblemFilters = {
  search: "",
  difficulty: "all",
  status: "all",
  access: "all",
}

export function ProblemsPage() {
  const { problems, status } = useProblems()
  const lastAttemptByProblem = useAppStore((state) => state.lastAttemptByProblem)
  const [filters, setFilters] = React.useState<ProblemFilters>(defaultFilters)
  const [sort, setSort] = React.useState<ProblemSort>("id-asc")
  const [page, setPage] = React.useState(0)
  const [visibleColumns, setVisibleColumns] = React.useState<ProblemColumnId[]>(
    DEFAULT_VISIBLE_COLUMNS
  )

  const visibleProblems = React.useMemo(
    () =>
      sortProblems(
        filterProblems(problems, filters, lastAttemptByProblem),
        sort
      ),
    [problems, filters, sort, lastAttemptByProblem]
  )

  const pageProblems = React.useMemo(
    () => visibleProblems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [visibleProblems, page]
  )

  const activeFilterCount = [
    filters.search !== "",
    filters.difficulty !== "all",
    filters.status !== "all",
    filters.access !== "all",
  ].filter(Boolean).length

  const updateFilters = (next: Partial<ProblemFilters>) => {
    setFilters((current) => ({ ...current, ...next }))
    setPage(0)
  }

  const updateSort = (next: ProblemSort) => {
    setSort(next)
    setPage(0)
  }

  const toggleColumn = (column: ProblemColumnId, visible: boolean) => {
    setVisibleColumns((current) => {
      if (!visible) {
        return current.filter((id) => id !== column)
      }

      const next = [...current, column]
      return PROBLEM_COLUMNS.filter((definition) =>
        next.includes(definition.id)
      ).map((definition) => definition.id)
    })
  }

  const resetFilters = () => {
    setFilters(defaultFilters)
    setPage(0)
  }

  return (
    <div className="flex flex-col gap-6">
      {status === "error" ? (
        <Empty className="min-h-64 border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TriangleAlertIcon />
            </EmptyMedia>
            <EmptyTitle>Catalog unavailable</EmptyTitle>
            <EmptyDescription>
              The local problem catalog could not be read. Run
              {" "}
              <code>node scripts/fetch-problems.mjs</code> to rebuild it.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {status === "loading" ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      ) : null}

      {status === "ready" ? (
        <>
          <ProblemsToolbar
            filters={filters}
            sort={sort}
            activeFilterCount={activeFilterCount}
            visibleColumns={visibleColumns}
            onFiltersChange={updateFilters}
            onSortChange={updateSort}
            onColumnToggle={toggleColumn}
            onReset={resetFilters}
          />
          <ProblemsTable
            problems={pageProblems}
            visibleColumns={visibleColumns}
            page={page}
            pageSize={PAGE_SIZE}
            total={visibleProblems.length}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </div>
  )
}
