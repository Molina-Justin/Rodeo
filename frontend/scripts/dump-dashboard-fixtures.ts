import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  buildDashboard,
  buildReviewStates,
  dueReviewCount,
  masteryScore,
} from "../src/lib/dashboard"
import type {
  Attempt,
  AttemptBlocker,
  AttemptEffort,
  AttemptOutcome,
  Problem,
} from "../src/types"

const TIMEZONE = "America/New_York"
const NOW = new Date("2026-03-10T12:00:00-04:00")

if (Intl.DateTimeFormat().resolvedOptions().timeZone !== TIMEZONE) {
  throw new Error(`Run with TZ=${TIMEZONE}`)
}

const problems: Problem[] = [
  {
    id: 1,
    title: "Two Sum",
    slug: "two-sum",
    difficulty: "easy",
    premium: false,
    acceptance: 55.1,
    topics: ["Array", "Hash Table"],
  },
  {
    id: 2,
    title: "Add Two Numbers",
    slug: "add-two-numbers",
    difficulty: "medium",
    premium: false,
    acceptance: 46.2,
    topics: ["Linked List", "Math"],
  },
  {
    id: 4,
    title: "Median of Two Sorted Arrays",
    slug: "median-of-two-sorted-arrays",
    difficulty: "hard",
    premium: false,
    acceptance: 44.9,
    topics: ["Array", "Binary Search"],
  },
]

const difficultyByProblem = new Map(
  problems.map((problem) => [problem.id, problem.difficulty])
)
const targetMinutes = { easy: 20, medium: 30, hard: 45 } as const

function attempt(
  id: string,
  problemId: number,
  completedAt: string,
  outcome: AttemptOutcome,
  durationMinutes: number,
  effort: AttemptEffort = "moderate",
  blocker: AttemptBlocker = "none"
): Attempt {
  const difficultyAtAttempt = difficultyByProblem.get(problemId) ?? "medium"
  return {
    id,
    problemId,
    completedAt,
    durationMinutes,
    durationSeconds: durationMinutes * 60,
    difficultyAtAttempt,
    targetMinutesAtAttempt: targetMinutes[difficultyAtAttempt],
    outcome,
    effort,
    blocker,
    notes: "",
  }
}

const cases: Record<string, Attempt[]> = {
  empty_history: [],
  all_failed: [
    attempt("failed-1", 1, "2026-03-01T15:00:00.000Z", "failed", 55),
    attempt("failed-2", 1, "2026-03-04T15:00:00.000Z", "failed", 48),
    attempt("failed-3", 2, "2026-03-08T16:00:00.000Z", "failed", 61),
  ],
  same_day: [
    attempt("same-1", 1, "2026-03-09T14:00:00.000Z", "hint", 28),
    attempt("same-2", 1, "2026-03-09T20:00:00.000Z", "optimal", 21),
    attempt("same-3", 2, "2026-03-09T22:00:00.000Z", "solution", 44),
  ],
  dst_boundary: [
    attempt("dst-1", 1, "2026-03-07T06:30:00.000Z", "optimal", 24),
    attempt("dst-2", 1, "2026-03-08T06:30:00.000Z", "hint", 26),
    attempt("dst-3", 2, "2026-03-09T05:30:00.000Z", "optimal", 32),
  ],
  pace_boundary: [
    {
      ...attempt("pace-1", 1, "2026-03-09T14:00:00.000Z", "optimal", 20),
      durationSeconds: 20 * 60 + 1,
    },
  ],
  unknown_problem: [
    attempt("known", 1, "2026-03-02T15:00:00.000Z", "optimal", 20),
    attempt("unknown", 999999, "2026-03-03T15:00:00.000Z", "failed", 90),
  ],
  mixed_history: [
    attempt("mixed-1", 1, "2026-02-25T15:00:00.000Z", "failed", 47),
    attempt("mixed-2", 1, "2026-03-01T15:00:00.000Z", "hint", 31),
    attempt("mixed-3", 1, "2026-03-06T15:00:00.000Z", "optimal", 19),
    attempt("mixed-4", 2, "2026-02-27T16:00:00.000Z", "solution", 52),
    attempt("mixed-5", 2, "2026-03-08T16:00:00.000Z", "optimal", 35),
    attempt("mixed-6", 4, "2026-03-09T17:00:00.000Z", "optimal", 58),
  ],
}

const fixture = {
  schemaVersion: 2,
  timezone: TIMEZONE,
  locale: "en-US",
  now: NOW.toISOString(),
  rangeDays: 90,
  problems,
  cases: Object.fromEntries(
    Object.entries(cases).map(([name, attempts]) => [
      name,
      {
        attempts,
        expected: {
          reviewStates: buildReviewStates(attempts, NOW),
          dueReviewCount: dueReviewCount(attempts, NOW),
          masteryScore: masteryScore(attempts),
          dashboard: buildDashboard(problems, attempts, NOW, 90),
        },
      },
    ])
  ),
}

const outputDirectory = path.resolve(process.cwd(), "../backend/tests/fixtures")
await mkdir(outputDirectory, { recursive: true })
await writeFile(
  path.join(outputDirectory, "dashboard-parity.json"),
  `${JSON.stringify(fixture, null, 2)}\n`
)
