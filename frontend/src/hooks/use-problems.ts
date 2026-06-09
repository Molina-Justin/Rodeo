import * as React from "react"

import type { Problem } from "@/types"
import type { ProblemFilters, ProblemSort } from "@/types"

type ProblemsStatus = "loading" | "ready" | "error"

interface ProblemsState {
  problems: Problem[]
  status: ProblemsStatus
  total: number
}

interface ProblemPageResponse {
  items: Problem[]
  page: number
  page_count: number
  total: number
}

interface UseProblemsArgs {
  filters: ProblemFilters
  page: number
  pageSize: number
  sort: ProblemSort
}

export function useProblems({ filters, page, pageSize, sort }: UseProblemsArgs): ProblemsState {
  const [state, setState] = React.useState<ProblemsState>({
    problems: [],
    status: "loading",
    total: 0,
  })

  React.useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      try {
        const params = new URLSearchParams({
          page: String(page + 1),
          page_size: String(pageSize),
          sort,
          access: filters.access,
        })
        if (filters.search) params.set("search", filters.search)
        if (filters.difficulty !== "all") params.set("difficulty", filters.difficulty)
        if (filters.status !== "all") params.set("status", filters.status)
        const response = await fetch(`/api/v1/problems?${params}`, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Catalog request failed with ${response.status}`)
        }

        const result = (await response.json()) as ProblemPageResponse
        setState({ problems: result.items, total: result.total, status: "ready" })
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        console.error(error)
        setState({ problems: [], total: 0, status: "error" })
      }
    }

    load()

    return () => {
      controller.abort()
    }
  }, [filters.access, filters.difficulty, filters.search, filters.status, page, pageSize, sort])

  return state
}
