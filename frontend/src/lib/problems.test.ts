import { describe, expect, it } from "vitest"

import { filterProblems, problemUrl, sortProblems } from "@/lib/problems"
import { CATALOG, makeAttempt, makeProblem } from "@/test/fixtures"
import type { ProblemFilters } from "@/types"

const ALL: ProblemFilters = {
  search: "",
  difficulty: "all",
  status: "all",
  access: "all",
}

describe("filterProblems", () => {
  it("returns everything with the default filters", () => {
    expect(filterProblems(CATALOG, ALL, {})).toHaveLength(CATALOG.length)
  })

  it("matches a search against id, title, and slug", () => {
    expect(filterProblems(CATALOG, { ...ALL, search: "2" }, {})).toEqual([
      CATALOG[1],
    ])
    expect(
      filterProblems(CATALOG, { ...ALL, search: "two sum" }, {})
    ).toEqual([CATALOG[0]])
    expect(
      filterProblems(CATALOG, { ...ALL, search: "median of two" }, {})
    ).toEqual([CATALOG[2]])
  })

  it("ignores surrounding whitespace in a search", () => {
    expect(filterProblems(CATALOG, { ...ALL, search: "   " }, {})).toHaveLength(
      CATALOG.length
    )
  })

  it("filters by difficulty and by access", () => {
    expect(
      filterProblems(CATALOG, { ...ALL, difficulty: "hard" }, {})
    ).toEqual([CATALOG[2]])
    expect(filterProblems(CATALOG, { ...ALL, access: "free" }, {})).toHaveLength(2)
    expect(filterProblems(CATALOG, { ...ALL, access: "premium" }, {})).toEqual([
      CATALOG[2],
    ])
  })

  it("filters by the status derived from the latest attempt", () => {
    const latest = {
      1: makeAttempt({ problemId: 1, outcome: "optimal" }),
      2: makeAttempt({ problemId: 2, outcome: "failed" }),
    }

    expect(
      filterProblems(CATALOG, { ...ALL, status: "solved" }, latest)
    ).toEqual([CATALOG[0]])
    expect(
      filterProblems(CATALOG, { ...ALL, status: "struggling" }, latest)
    ).toEqual([CATALOG[1]])
    // The untouched problem is the only one left as not-started.
    expect(
      filterProblems(CATALOG, { ...ALL, status: "not-started" }, latest)
    ).toEqual([CATALOG[2]])
  })

  it("combines filters conjunctively", () => {
    expect(
      filterProblems(CATALOG, { ...ALL, difficulty: "hard", access: "free" }, {})
    ).toEqual([])
  })
})

describe("sortProblems", () => {
  const unsorted = [
    makeProblem({ id: 3, title: "Charlie", difficulty: "hard", acceptance: 30 }),
    makeProblem({ id: 1, title: "Alpha", difficulty: "medium", acceptance: 70 }),
    makeProblem({ id: 2, title: "Bravo", difficulty: "easy", acceptance: 50 }),
  ]

  it.each([
    ["id-asc", [1, 2, 3]],
    ["id-desc", [3, 2, 1]],
    ["title-asc", [1, 2, 3]],
    ["title-desc", [3, 2, 1]],
    ["difficulty-asc", [2, 1, 3]],
    ["difficulty-desc", [3, 1, 2]],
    ["acceptance-asc", [3, 2, 1]],
    ["acceptance-desc", [1, 2, 3]],
  ] as const)("orders by %s", (sort, expected) => {
    expect(sortProblems(unsorted, sort).map((problem) => problem.id)).toEqual(
      expected
    )
  })

  it("does not mutate the input", () => {
    const original = [...unsorted]
    sortProblems(unsorted, "id-asc")

    expect(unsorted).toEqual(original)
  })
})

describe("problemUrl", () => {
  it("points at the LeetCode page for the slug", () => {
    expect(problemUrl(CATALOG[0])).toBe("https://leetcode.com/problems/two-sum/")
  })
})
