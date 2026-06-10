import * as React from "react"
import { TriangleAlertIcon } from "lucide-react"

import {
  DEFAULT_VISIBLE_COLUMNS,
  PROBLEM_COLUMNS,
} from "@/components/problems/problems-columns"
import { ProblemDialog } from "@/components/problems/problem-dialog"
import { ProblemsTable } from "@/components/problems/problems-table"
import { ProblemsToolbar } from "@/components/problems/problems-toolbar"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { useProblems } from "@/hooks/use-problems"
import type {
  Problem,
  ProblemColumnId,
  ProblemFilters,
  ProblemSort,
} from "@/types"

const PAGE_SIZE = 25

const defaultFilters: ProblemFilters = {
  search: "",
  difficulty: "all",
  status: "all",
  access: "all",
}

export function ProblemsPage() {
  const [filters, setFilters] = React.useState<ProblemFilters>(defaultFilters)
  const [sort, setSort] = React.useState<ProblemSort>("id-asc")
  const [page, setPage] = React.useState(0)
  const { problems, status, total } = useProblems({
    filters,
    page,
    pageSize: PAGE_SIZE,
    sort,
  })
  const [visibleColumns, setVisibleColumns] = React.useState<ProblemColumnId[]>(
    DEFAULT_VISIBLE_COLUMNS
  )
  const [selectedProblem, setSelectedProblem] = React.useState<Problem | null>(
    null
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
              The local problem catalog could not be read from the Rodeo API.
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
            problems={problems}
            visibleColumns={visibleColumns}
            onSelect={setSelectedProblem}
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
          <ProblemDialog
            problem={selectedProblem}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedProblem(null)
              }
            }}
          />
        </>
      ) : null}
    </div>
  )
}
