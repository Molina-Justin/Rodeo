import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { api } from "@/api/client"
import { toProblem } from "@/api/models"
import type { ProblemFilters, ProblemSort } from "@/types"

interface UseProblemsArgs {
  filters: ProblemFilters
  page: number
  pageSize: number
  sort: ProblemSort
}

export function useProblems({
  filters,
  page,
  pageSize,
  sort,
}: UseProblemsArgs) {
  const query = useQuery({
    queryKey: ["problem-list", filters, page, pageSize, sort],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/problems", {
        params: {
          query: {
            page: page + 1,
            page_size: pageSize,
            sort,
            access: filters.access,
            search: filters.search || undefined,
            difficulty:
              filters.difficulty === "all" ? undefined : filters.difficulty,
            status: filters.status === "all" ? undefined : filters.status,
          },
        },
      })
      if (error || !data) {
        throw new Error("The problem catalog could not be loaded")
      }
      return {
        problems: data.items.map(toProblem),
        total: data.total,
      }
    },
    placeholderData: keepPreviousData,
  })

  return {
    problems: query.data?.problems ?? [],
    total: query.data?.total ?? 0,
    status: query.isPending
      ? ("loading" as const)
      : query.isError
        ? ("error" as const)
        : ("ready" as const),
  }
}

export function useAllProblems() {
  const query = useQuery({
    queryKey: ["problems", "all"],
    queryFn: async () => {
      const loadPage = async (page: number) => {
        const { data, error } = await api.GET("/api/v1/problems", {
          params: {
            query: { page, page_size: 200, sort: "id-asc", access: "all" },
          },
        })
        if (error || !data) {
          throw new Error("The problem catalog could not be loaded")
        }
        return data
      }
      const firstPage = await loadPage(1)
      const remainingPages = await Promise.all(
        Array.from({ length: firstPage.page_count - 1 }, (_, index) =>
          loadPage(index + 2)
        )
      )
      return [firstPage, ...remainingPages].flatMap((page) =>
        page.items.map(toProblem)
      )
    },
  })

  return {
    problems: query.data ?? [],
    status: query.isPending
      ? ("loading" as const)
      : query.isError
        ? ("error" as const)
        : ("ready" as const),
  }
}
