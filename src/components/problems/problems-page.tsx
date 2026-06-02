import * as React from "react"
import { TriangleAlertIcon } from "lucide-react"

import { ProblemsTable } from "@/components/problems/problems-table"
import { ProblemsToolbar } from "@/components/problems/problems-toolbar"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { useProblems } from "@/hooks/use-problems"
import {
  ALL_TOPICS,
  collectTopics,
  filterProblems,
  sortProblems,
} from "@/lib/problems"
import type { ProblemFilters, ProblemSort } from "@/types"

const PAGE_SIZE = 25

const defaultFilters: ProblemFilters = {
  search: "",
  difficulty: "all",
  topic: ALL_TOPICS,
  access: "all",
}

export function ProblemsPage() {
  const { problems, status } = useProblems()
  const [filters, setFilters] = React.useState<ProblemFilters>(defaultFilters)
  const [sort, setSort] = React.useState<ProblemSort>("id-asc")
  const [page, setPage] = React.useState(0)

  const topics = React.useMemo(() => collectTopics(problems), [problems])

  const visibleProblems = React.useMemo(
    () => sortProblems(filterProblems(problems, filters), sort),
    [problems, filters, sort]
  )

  const pageProblems = React.useMemo(
    () => visibleProblems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [visibleProblems, page]
  )

  const isFiltered =
    filters.search !== "" ||
    filters.difficulty !== "all" ||
    filters.topic !== ALL_TOPICS ||
    filters.access !== "all"

  const updateFilters = (next: Partial<ProblemFilters>) => {
    setFilters((current) => ({ ...current, ...next }))
    setPage(0)
  }

  const updateSort = (next: ProblemSort) => {
    setSort(next)
    setPage(0)
  }

  const resetFilters = () => {
    setFilters(defaultFilters)
    setPage(0)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">Problems</h1>
        <p className="text-sm text-muted-foreground">
          The full LeetCode catalog. Filter it down, then log an attempt against
          anything you work on.
        </p>
      </div>

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
            topics={topics}
            isFiltered={isFiltered}
            onFiltersChange={updateFilters}
            onSortChange={updateSort}
            onReset={resetFilters}
          />
          <ProblemsTable
            problems={pageProblems}
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
