import { describe, expect, it } from "vitest"

import {
  BLOCKER_LABELS,
  EFFORT_LABELS,
  OUTCOME_LABELS,
  bestDuration,
  daysSince,
  deriveStatus,
  durationDelta,
  formatDuration,
  formatElapsed,
  formatLastAttempt,
  indexAttemptArtifacts,
  indexAttempts,
} from "@/lib/attempts"
import { NOW, isoDaysAgo, makeAttempt } from "@/test/fixtures"

describe("indexAttempts", () => {
  it("keeps the most recent attempt per problem", () => {
    const index = indexAttempts([
      makeAttempt({ id: "old", problemId: 1, completedAt: isoDaysAgo(9) }),
      makeAttempt({ id: "new", problemId: 1, completedAt: isoDaysAgo(1) }),
      makeAttempt({ id: "other", problemId: 2, completedAt: isoDaysAgo(4) }),
    ])

    expect(index[1].id).toBe("new")
    expect(index[2].id).toBe("other")
  })

  it("keeps the first of two attempts that tie on timestamp", () => {
    const sameMoment = isoDaysAgo(2)
    const index = indexAttempts([
      makeAttempt({ id: "first", problemId: 1, completedAt: sameMoment }),
      makeAttempt({ id: "second", problemId: 1, completedAt: sameMoment }),
    ])

    expect(index[1].id).toBe("first")
  })

  it("is empty for no attempts", () => {
    expect(indexAttempts([])).toEqual({})
  })
})

describe("indexAttemptArtifacts", () => {
  it("reports audio and notes across the whole history, not just the latest", () => {
    const artifacts = indexAttemptArtifacts([
      makeAttempt({ problemId: 1, notes: "Wrote this down", completedAt: isoDaysAgo(9) }),
      makeAttempt({ problemId: 1, audioUrl: "/api/v1/recordings/r-1/content" }),
      makeAttempt({ problemId: 2, notes: "   " }),
    ])

    expect(artifacts[1]).toEqual({ hasAudio: true, hasNotes: true })
    expect(artifacts[2]).toEqual({ hasAudio: false, hasNotes: false })
  })
})

describe("deriveStatus", () => {
  it.each([
    ["optimal", "solved"],
    ["hint", "review"],
    ["solution", "struggling"],
    ["failed", "struggling"],
  ] as const)("maps %s to %s", (outcome, status) => {
    expect(deriveStatus(makeAttempt({ outcome }))).toBe(status)
  })

  it("is not-started with no attempt", () => {
    expect(deriveStatus(undefined)).toBe("not-started")
  })
})

describe("elapsed formatting", () => {
  it("never reports a negative age for a future timestamp", () => {
    expect(daysSince(isoDaysAgo(-5), NOW)).toBe(0)
  })

  it.each([
    [0, "Today"],
    [3, "3d ago"],
    [10, "1w ago"],
    [45, "1mo ago"],
  ])("renders %s days as %s", (days, label) => {
    expect(formatElapsed(isoDaysAgo(days), NOW)).toBe(label)
  })
})

describe("formatDuration", () => {
  it.each([
    [45, "45m"],
    [60, "1h"],
    [95, "1h 35m"],
    [0, "0m"],
  ])("renders %s minutes as %s", (minutes, label) => {
    expect(formatDuration(minutes)).toBe(label)
  })
})

describe("completion time comparisons", () => {
  it("finds the fastest attempt in a history", () => {
    expect(
      bestDuration([
        makeAttempt({ durationMinutes: 44 }),
        makeAttempt({ durationMinutes: 19 }),
        makeAttempt({ durationMinutes: 31 }),
      ])
    ).toBe(19)
  })

  it("has no best time without attempts", () => {
    expect(bestDuration([])).toBeUndefined()
  })

  it("reports time saved as a negative delta", () => {
    const previous = makeAttempt({ durationMinutes: 40 })
    const current = makeAttempt({ durationMinutes: 25 })

    expect(durationDelta(current, previous)).toBe(-15)
    expect(durationDelta(current, undefined)).toBeUndefined()
  })
})

describe("formatLastAttempt", () => {
  it("reads as elapsed, duration, outcome", () => {
    const attempt = makeAttempt({
      completedAt: isoDaysAgo(3),
      durationMinutes: 28,
      outcome: "optimal",
    })

    expect(formatLastAttempt(attempt, NOW)).toEqual(["3d ago", "28m", "Independent"])
  })
})

describe("label maps", () => {
  it("covers every enum value the API can return", () => {
    expect(Object.keys(OUTCOME_LABELS)).toEqual([
      "optimal",
      "hint",
      "solution",
      "failed",
    ])
    expect(Object.keys(EFFORT_LABELS)).toEqual([
      "light",
      "moderate",
      "heavy",
      "brutal",
    ])
    expect(Object.keys(BLOCKER_LABELS)).toEqual([
      "none",
      "pattern",
      "edge-cases",
      "complexity",
      "implementation",
      "debugging",
      "time",
    ])
  })
})
