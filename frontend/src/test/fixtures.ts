import type {
  Attempt,
  AttemptBlocker,
  AttemptEffort,
  AttemptOutcome,
  Problem,
} from "@/types"

export const NOW = new Date("2026-03-10T12:00:00-05:00")

export function isoDaysAgo(days: number, hour = 12): string {
  const date = new Date(NOW)
  date.setDate(date.getDate() - days)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

let attemptCounter = 0

export function makeProblem(overrides: Partial<Problem> = {}): Problem {
  const id = overrides.id ?? 1
  return {
    id,
    title: `Problem ${id}`,
    slug: `problem-${id}`,
    difficulty: "medium",
    premium: false,
    acceptance: 50,
    topics: ["Array"],
    status: "not-started",
    attemptCount: 0,
    hasNotes: false,
    hasAudio: false,
    hasTranscript: false,
    ...overrides,
  }
}

export function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  attemptCounter += 1
  return {
    id: `attempt-${attemptCounter}`,
    problemId: 1,
    completedAt: isoDaysAgo(1),
    durationMinutes: 25,
    outcome: "optimal" as AttemptOutcome,
    effort: "moderate" as AttemptEffort,
    blocker: "none" as AttemptBlocker,
    notes: "",
    ...overrides,
  }
}

export const CATALOG: Problem[] = [
  makeProblem({
    id: 1,
    title: "Two Sum",
    slug: "two-sum",
    difficulty: "easy",
    acceptance: 55.1,
    topics: ["Array", "Hash Table"],
  }),
  makeProblem({
    id: 2,
    title: "Add Two Numbers",
    slug: "add-two-numbers",
    difficulty: "medium",
    acceptance: 46.2,
    topics: ["Linked List", "Math"],
  }),
  makeProblem({
    id: 4,
    title: "Median of Two Sorted Arrays",
    slug: "median-of-two-sorted-arrays",
    difficulty: "hard",
    acceptance: 44.9,
    premium: true,
    topics: ["Array", "Binary Search"],
  }),
]

export const HISTORY: Attempt[] = [
  makeAttempt({
    id: "h-1",
    problemId: 1,
    completedAt: isoDaysAgo(13),
    outcome: "failed",
    durationMinutes: 47,
    effort: "brutal",
    blocker: "pattern",
  }),
  makeAttempt({
    id: "h-2",
    problemId: 1,
    completedAt: isoDaysAgo(9),
    outcome: "hint",
    durationMinutes: 31,
    blocker: "edge-cases",
    notes: "Forgot the complement lookup.",
  }),
  makeAttempt({
    id: "h-3",
    problemId: 1,
    completedAt: isoDaysAgo(4),
    outcome: "optimal",
    durationMinutes: 19,
    effort: "light",
  }),
  makeAttempt({
    id: "h-4",
    problemId: 2,
    completedAt: isoDaysAgo(11),
    outcome: "solution",
    durationMinutes: 52,
    effort: "heavy",
    blocker: "implementation",
  }),
  makeAttempt({
    id: "h-5",
    problemId: 2,
    completedAt: isoDaysAgo(2),
    outcome: "optimal",
    durationMinutes: 35,
  }),
  makeAttempt({
    id: "h-6",
    problemId: 4,
    completedAt: isoDaysAgo(1),
    outcome: "optimal",
    durationMinutes: 58,
    effort: "heavy",
  }),
]
