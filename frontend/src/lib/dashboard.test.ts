import { describe, expect, it } from "vitest"

import parityFixture from "../../../backend/tests/fixtures/dashboard-parity.json"
import {
  TARGET_SCORE,
  TOPIC_MASTERY_SAMPLE_TARGET,
  buildConsistency,
  buildDashboard,
  buildDifficultyMix,
  buildReadiness,
  buildReviewStates,
  buildTopicFocuses,
  buildTopicMastery,
  dueReviewCount,
  masteryScore,
  masteryTier,
  rankByMasteryGap,
  topicTag,
} from "@/lib/dashboard"
import {
  CATALOG,
  HISTORY,
  NOW,
  makeAttempt,
  makeProblem,
} from "@/test/fixtures"
import type { Attempt, Problem } from "@/types"


const FIXTURE_NOW = new Date(parityFixture.now)
const FIXTURE_PROBLEMS = parityFixture.problems as Problem[]

describe("timezone contract", () => {
  it("runs in the zone the parity fixture was recorded in", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
      parityFixture.timezone
    )
  })
})

describe("parity fixture", () => {
  const cases = Object.entries(parityFixture.cases)

  it.each(cases)(
    "reproduces the recorded mastery for %s",
    (_name, testCase) => {
      expect(masteryScore(testCase.attempts as Attempt[])).toBe(
        testCase.expected.masteryScore
      )
    }
  )

  it.each(cases)(
    "reproduces the recorded due count for %s",
    (_name, testCase) => {
      expect(dueReviewCount(testCase.attempts as Attempt[], FIXTURE_NOW)).toBe(
        testCase.expected.dueReviewCount
      )
    }
  )

  it.each(cases)(
    "reproduces the recorded review states for %s",
    (_name, testCase) => {
      const states = buildReviewStates(
        testCase.attempts as Attempt[],
        FIXTURE_NOW
      )
      const recorded = testCase.expected.reviewStates

      expect(states).toHaveLength(recorded.length)

      states.forEach((state, index) => {
        const expected = recorded[index]
        expect(state.problemId).toBe(expected.problemId)
        expect(state.status).toBe(expected.status)
        expect(state.attemptCount).toBe(expected.attemptCount)
        expect(state.intervalDays).toBe(expected.intervalDays)
        expect(state.lapses).toBe(expected.lapses)
        expect(state.confidence).toBe(expected.confidence)
        expect(state.dueInDays).toBe(expected.dueInDays)
        expect(state.nextDueOn).toBe(expected.nextDueOn)
        expect(state.cleanQuickStreak).toBe(expected.cleanQuickStreak)
        expect(state.lastAttempt.id).toBe(expected.lastAttempt.id)
      })
    }
  )

  it.each(cases)(
    "reproduces the recorded dashboard for %s",
    (_name, testCase) => {
      const built = buildDashboard(
        FIXTURE_PROBLEMS,
        testCase.attempts as Attempt[],
        FIXTURE_NOW,
        parityFixture.rangeDays
      )

      expect(JSON.parse(JSON.stringify(built))).toEqual(
        testCase.expected.dashboard
      )
    }
  )
})

describe("buildReviewStates", () => {
  it("replays a history chronologically regardless of input order", () => {
    const shuffled = [HISTORY[2], HISTORY[0], HISTORY[1]]
    const inOrder = [HISTORY[0], HISTORY[1], HISTORY[2]]

    expect(buildReviewStates(shuffled, NOW)).toEqual(
      buildReviewStates(inOrder, NOW)
    )
  })

  it("resets the interval and counts a lapse on a failure", () => {
    const recovered = buildReviewStates(
      [
        makeAttempt({ problemId: 1, completedAt: "2026-03-01T15:00:00.000Z" }),
        makeAttempt({ problemId: 1, completedAt: "2026-03-03T15:00:00.000Z" }),
        makeAttempt({
          problemId: 1,
          completedAt: "2026-03-05T15:00:00.000Z",
          outcome: "failed",
        }),
      ],
      NOW
    )

    expect(recovered[0].intervalDays).toBe(1)
    expect(recovered[0].lapses).toBe(1)
    expect(recovered[0].status).toBe("struggling")
  })

  it("orders the queue by how soon each problem is due", () => {
    const states = buildReviewStates(HISTORY, NOW)
    const due = states.flatMap((state) =>
      state.dueInDays === null ? [] : [state.dueInDays]
    )

    expect(due).toEqual([...due].sort((a, b) => a - b))
  })

  it("returns nothing for an empty history", () => {
    expect(buildReviewStates([], NOW)).toEqual([])
    expect(dueReviewCount([], NOW)).toBe(0)
  })

  it("does not let early successful practice manufacture a longer interval", () => {
    const [state] = buildReviewStates(
      [
        makeAttempt({ completedAt: "2026-01-01T15:00:00.000Z" }),
        makeAttempt({ completedAt: "2026-01-02T15:00:00.000Z" }),
      ],
      new Date("2026-01-02T16:00:00.000Z")
    )

    expect(state.intervalDays).toBe(3)
    expect(state.nextDueOn).toBe("2026-01-04")
  })

  it("graduates four well-spaced clean and quick reviews", () => {
    const [state] = buildReviewStates(
      [
        makeAttempt({ completedAt: "2026-01-01T15:00:00.000Z" }),
        makeAttempt({ completedAt: "2026-01-04T15:00:00.000Z" }),
        makeAttempt({ completedAt: "2026-01-12T15:00:00.000Z" }),
        makeAttempt({ completedAt: "2026-02-01T15:00:00.000Z" }),
      ],
      new Date("2026-02-02T16:00:00.000Z")
    )

    expect(state.cleanQuickStreak).toBe(4)
    expect(state.nextDueOn).toBeNull()
    expect(state.dueInDays).toBeNull()
    expect(state.graduatedAt).toBe("2026-02-01T15:00:00.000Z")
  })
})

describe("masteryScore", () => {
  it("weights the catalog, not just what has been attempted", () => {
    const attempts = [makeAttempt({ problemId: 1, outcome: "optimal" })]

    expect(masteryScore(attempts)).toBe(100)
    expect(masteryScore(attempts, 4)).toBe(25)
  })

  it("scores only the latest attempt for each problem", () => {
    const score = masteryScore([
      makeAttempt({
        problemId: 1,
        outcome: "failed",
        completedAt: "2026-03-01T15:00:00.000Z",
      }),
      makeAttempt({
        problemId: 1,
        outcome: "optimal",
        completedAt: "2026-03-05T15:00:00.000Z",
      }),
    ])

    expect(score).toBe(100)
  })

  it("is zero with no history", () => {
    expect(masteryScore([])).toBe(0)
    expect(masteryScore([], 10)).toBe(0)
  })
})

describe("buildConsistency", () => {
  it("emits one dense day per day in the range, oldest first", () => {
    const consistency = buildConsistency(HISTORY, 30, NOW)

    expect(consistency.days).toHaveLength(30)
    const keys = consistency.days.map((day) => day.key)
    expect(keys).toEqual([...keys].sort())
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("totals only the minutes inside the window", () => {
    const wide = buildConsistency(HISTORY, 90, NOW)
    const narrow = buildConsistency(HISTORY, 3, NOW)

    expect(wide.totalMinutes).toBeGreaterThan(narrow.totalMinutes)
    expect(narrow.totalMinutes).toBe(58 + 35)
  })

  it("counts a streak in days at the desk, not minutes logged", () => {
    const consecutive = [
      makeAttempt({ problemId: 1, completedAt: NOW.toISOString() }),
      makeAttempt({
        problemId: 2,
        completedAt: new Date(NOW.getTime() - 86_400_000).toISOString(),
      }),
      makeAttempt({
        problemId: 4,
        completedAt: new Date(NOW.getTime() - 2 * 86_400_000).toISOString(),
      }),
    ]

    expect(buildConsistency(consecutive, 30, NOW).streak).toBe(3)
  })

  it("keeps yesterday's streak alive before today is logged", () => {
    const yesterdayOnly = [
      makeAttempt({
        problemId: 1,
        completedAt: new Date(NOW.getTime() - 86_400_000).toISOString(),
      }),
    ]

    expect(buildConsistency(yesterdayOnly, 30, NOW).streak).toBe(1)
  })

  it("is empty but well-formed with no attempts", () => {
    const consistency = buildConsistency([], 30, NOW)

    expect(consistency.days).toHaveLength(30)
    expect(consistency.totalMinutes).toBe(0)
    expect(consistency.streak).toBe(0)
    expect(consistency.days.every((day) => day.level === 0)).toBe(true)
  })
})

describe("topic aggregation", () => {
  it("scores every catalog topic, including untouched ones", () => {
    const focuses = buildTopicFocuses(CATALOG, HISTORY, NOW)
    const topics = focuses.map((focus) => focus.topic)

    expect(topics).toEqual(
      expect.arrayContaining(["Array", "Hash Table", "Math"])
    )
    for (const focus of focuses) {
      expect(focus.score).toBeGreaterThanOrEqual(0)
      expect(focus.score).toBeLessThanOrEqual(100)
      expect(focus.attempted).toBeLessThanOrEqual(focus.problemCount)
    }
  })

  it("does not credit a topic for a problem outside it", () => {
    const focuses = buildTopicFocuses(
      [
        makeProblem({ id: 1, topics: ["Graph"] }),
        makeProblem({ id: 2, topics: ["Tree"] }),
      ],
      [makeAttempt({ problemId: 1, outcome: "optimal" })],
      NOW
    )
    const tree = focuses.find((focus) => focus.topic === "Tree")

    expect(tree?.attempted).toBe(0)
    expect(tree?.score).toBe(0)
  })

  it("requires realistic breadth before a large topic reaches mastery", () => {
    const catalog = Array.from({ length: 100 }, (_, index) =>
      makeProblem({ id: index + 1, topics: ["Array"] })
    )
    const cleanSolves = Array.from({ length: 38 }, (_, index) =>
      makeAttempt({ problemId: index + 1, outcome: "optimal" })
    )

    expect(TOPIC_MASTERY_SAMPLE_TARGET).toBe(50)
    expect(buildTopicMastery(catalog, cleanSolves.slice(0, 2))[0].score).toBe(4)
    expect(buildTopicMastery(catalog, cleanSolves.slice(0, 25))[0].score).toBe(
      50
    )
    expect(buildTopicMastery(catalog, cleanSolves)[0].score).toBe(76)
  })

  it("uses only the latest result for each distinct problem", () => {
    const catalog = Array.from({ length: 100 }, (_, index) =>
      makeProblem({ id: index + 1, topics: ["Array"] })
    )
    const repeated = Array.from({ length: 20 }, (_, index) =>
      makeAttempt({
        id: `repeat-${index}`,
        problemId: 1,
        completedAt: new Date(NOW.getTime() + index * 1_000).toISOString(),
        outcome: "optimal",
      })
    )

    expect(buildTopicMastery(catalog, repeated)[0]).toMatchObject({
      attempted: 1,
      score: 2,
    })
  })

  it("ranks topics under target first, weakest of those leading", () => {
    const ranked = rankByMasteryGap(buildTopicFocuses(CATALOG, HISTORY, NOW))
    const tiers = ranked.map((focus) => masteryTier(focus))
    const rank = { under: 0, at: 1, open: 2 } as const

    expect(tiers.map((tier) => rank[tier])).toEqual(
      [...tiers].map((tier) => rank[tier]).sort((a, b) => a - b)
    )

    const under = ranked
      .filter((focus) => masteryTier(focus) === "under")
      .map((focus) => focus.score)
    expect(under).toEqual([...under].sort((a, b) => a - b))
  })

  it("classifies a topic against the target", () => {
    const focuses = buildTopicFocuses(CATALOG, HISTORY, NOW)

    for (const focus of focuses) {
      const tier = masteryTier(focus)
      if (focus.attempted === 0) {
        expect(tier).toBe("open")
      } else {
        expect(tier).toBe(focus.score >= TARGET_SCORE ? "at" : "under")
      }
    }
  })

  it("builds one radar axis per scored topic", () => {
    const mastery = buildTopicMastery(CATALOG, HISTORY)

    expect(mastery.length).toBeGreaterThan(0)
    for (const axis of mastery) {
      expect(axis.topic).toBeTruthy()
      expect(axis.score).toBeGreaterThanOrEqual(0)
      expect(axis.score).toBeLessThanOrEqual(100)
    }
  })

  it("shortens a topic into a tag", () => {
    expect(topicTag("Dynamic Programming")).toBeTruthy()
    expect(topicTag(undefined)).toBeTruthy()
  })
})

describe("buildDifficultyMix", () => {
  it("splits solved work across all three difficulties", () => {
    const mix = buildDifficultyMix(CATALOG, HISTORY)
    const labels = mix.map((slice) => slice.difficulty)

    expect(labels).toEqual(expect.arrayContaining(["easy", "medium", "hard"]))
    for (const slice of mix) {
      expect(slice.solved).toBeLessThanOrEqual(slice.total)
    }
  })

  it("reports zero solved with no history", () => {
    const mix = buildDifficultyMix(CATALOG, [])

    expect(mix.every((slice) => slice.solved === 0)).toBe(true)
    expect(mix.reduce((sum, slice) => sum + slice.total, 0)).toBe(
      CATALOG.length
    )
  })
})

describe("buildReadiness", () => {
  it("stays inside 0-100 and plots a trend", () => {
    const readiness = buildReadiness(CATALOG, HISTORY, NOW, 90)

    expect(readiness.score).toBeGreaterThanOrEqual(0)
    expect(readiness.score).toBeLessThanOrEqual(100)
    expect(readiness.history.length).toBeGreaterThan(0)
    for (const point of readiness.history) {
      expect(point.score).toBeGreaterThanOrEqual(0)
      expect(point.score).toBeLessThanOrEqual(100)
    }
  })

  it("is zero with no history", () => {
    expect(buildReadiness(CATALOG, [], NOW, 90).score).toBe(0)
  })

  it("rates a clean fast history above a failing one", () => {
    const strong = CATALOG.map((problem) =>
      makeAttempt({
        problemId: problem.id,
        outcome: "optimal",
        durationMinutes: 12,
        completedAt: NOW.toISOString(),
      })
    )
    const weak = CATALOG.map((problem) =>
      makeAttempt({
        problemId: problem.id,
        outcome: "failed",
        durationMinutes: 90,
        completedAt: NOW.toISOString(),
      })
    )

    expect(buildReadiness(CATALOG, strong, NOW, 90).score).toBeGreaterThan(
      buildReadiness(CATALOG, weak, NOW, 90).score
    )
  })
})

describe("buildDashboard", () => {
  it("assembles every section the overview renders", () => {
    const dashboard = buildDashboard(CATALOG, HISTORY, NOW, 90)

    expect(dashboard.consistency.days).toHaveLength(90)
    expect(dashboard.focuses.length).toBeGreaterThan(0)
    expect(dashboard.mastery.length).toBeGreaterThan(0)
    expect(dashboard.mix.length).toBeGreaterThan(0)
    expect(dashboard.summary.length).toBeGreaterThan(0)
    expect(dashboard.readiness.score).toBeGreaterThanOrEqual(0)
  })

  it("renders a coherent empty state rather than throwing", () => {
    const dashboard = buildDashboard(CATALOG, [], NOW, 90)

    expect(dashboard.readiness.score).toBe(0)
    expect(dashboard.consistency.streak).toBe(0)
    expect(dashboard.queue).toEqual([])
  })

  it("ignores attempts for problems that left the catalog", () => {
    const withGhost = [
      ...HISTORY,
      makeAttempt({ problemId: 999_999, outcome: "failed" }),
    ]
    const dashboard = buildDashboard(CATALOG, withGhost, NOW, 90)

    expect(dashboard.queue.some((item) => item.problemId === 999_999)).toBe(
      false
    )
  })
})
