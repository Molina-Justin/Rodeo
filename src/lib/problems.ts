import { deriveStatus } from "@/lib/attempts"
import type { Attempt, Problem, ProblemFilters, ProblemSort } from "@/types"

const DIFFICULTY_RANK: Record<Problem["difficulty"], number> = {
  easy: 0,
  medium: 1,
  hard: 2,
}

export const ALL_TOPICS = "all"

export function collectTopics(problems: Problem[]): string[] {
  const topics = new Set<string>()

  for (const problem of problems) {
    for (const topic of problem.topics) {
      topics.add(topic)
    }
  }

  return [...topics].sort((a, b) => a.localeCompare(b))
}

function matchesSearch(problem: Problem, search: string) {
  if (!search) {
    return true
  }

  const term = search.trim().toLowerCase()
  if (!term) {
    return true
  }

  return (
    String(problem.id) === term ||
    problem.title.toLowerCase().includes(term) ||
    problem.slug.includes(term.replace(/\s+/g, "-"))
  )
}

export function filterProblems(
  problems: Problem[],
  filters: ProblemFilters,
  lastAttemptByProblem: Record<number, Attempt>
): Problem[] {
  return problems.filter((problem) => {
    if (!matchesSearch(problem, filters.search)) {
      return false
    }

    if (filters.difficulty !== "all" && problem.difficulty !== filters.difficulty) {
      return false
    }

    if (filters.topic !== ALL_TOPICS && !problem.topics.includes(filters.topic)) {
      return false
    }

    if (
      filters.status !== "all" &&
      deriveStatus(lastAttemptByProblem[problem.id]) !== filters.status
    ) {
      return false
    }

    if (filters.access === "free" && problem.premium) {
      return false
    }

    if (filters.access === "premium" && !problem.premium) {
      return false
    }

    return true
  })
}

export function sortProblems(problems: Problem[], sort: ProblemSort): Problem[] {
  const sorted = [...problems]

  switch (sort) {
    case "id-asc":
      return sorted.sort((a, b) => a.id - b.id)
    case "id-desc":
      return sorted.sort((a, b) => b.id - a.id)
    case "title-asc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title))
    case "title-desc":
      return sorted.sort((a, b) => b.title.localeCompare(a.title))
    case "difficulty-asc":
      return sorted.sort(
        (a, b) =>
          DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] ||
          a.id - b.id
      )
    case "difficulty-desc":
      return sorted.sort(
        (a, b) =>
          DIFFICULTY_RANK[b.difficulty] - DIFFICULTY_RANK[a.difficulty] ||
          a.id - b.id
      )
    case "acceptance-asc":
      return sorted.sort((a, b) => a.acceptance - b.acceptance)
    case "acceptance-desc":
      return sorted.sort((a, b) => b.acceptance - a.acceptance)
  }
}

export function problemUrl(problem: Problem): string {
  return `https://leetcode.com/problems/${problem.slug}/`
}
