import { bestDuration, deriveStatus, indexAttempts } from "@/lib/attempts"
import type {
  Attempt,
  AttemptBlocker,
  AttemptEffort,
  AttemptOutcome,
  Difficulty,
  Problem,
  ProblemStatus,
} from "@/types"

const MS_PER_DAY = 1000 * 60 * 60 * 24
const QUEUE_LIMIT = 6
const TOPIC_AXIS_LIMIT = 12
export const TARGET_MINUTES = 45
export const TARGET_SCORE = 75
/** Suggestions are capped so a broad topic does not emit a thousand rows. */
const UNATTEMPTED_LIMIT = 25
const READINESS_MONTHS = 6

export const MAX_CONFIDENCE = 5

/**
 * Interval multipliers applied per attempt outcome. A zero collapses the
 * interval back to a single day and counts as a lapse. These mirror the
 * deterministic engine the API will own — no randomness, no I/O.
 */
const INTERVAL_GROWTH: Record<AttemptOutcome, number> = {
  optimal: 2.5,
  hint: 1.5,
  solution: 0,
  failed: 0,
}

const CONFIDENCE_BASE: Record<AttemptOutcome, number> = {
  optimal: 4,
  hint: 2,
  solution: 1,
  failed: 0,
}

const STATUS_WEIGHT: Record<ProblemStatus, number> = {
  "not-started": 0,
  solved: 1,
  review: 0.6,
  struggling: 0.25,
}

/** Readiness is a weighted blend of four signals; the weights sum to 1. */
const READINESS_WEIGHTS = {
  coverage: 0.4,
  mastery: 0.35,
  activity: 0.15,
  pace: 0.1,
} as const

const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"]

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export type DashboardTone = "emerald" | "amber" | "indigo" | "violet"

export interface SummaryStat {
  id: string
  label: string
  value: string
  delta: string
  tone: DashboardTone
}

export interface ActivityDay {
  key: string
  label: string
  minutes: number
  problemCount: number
  level: number
}

export interface ActivityWeek {
  key: string
  days: (ActivityDay | null)[]
}

export interface ReviewState {
  problemId: number
  lastAttempt: Attempt
  attemptCount: number
  intervalDays: number
  lapses: number
  confidence: number
  dueInDays: number
  status: ProblemStatus
}

export interface ReviewItem extends ReviewState {
  title: string
  tag: string
  topic: string
  when: string
}

/** One catalog problem inside a topic, with whatever history exists for it. */
export interface TopicProblem {
  id: number
  title: string
  slug: string
  difficulty: Difficulty
  acceptance: number
  attempts: number
  lastOutcome: AttemptOutcome | null
  lastDurationMinutes: number | null
  bestDurationMinutes: number | null
  lapses: number
  intervalDays: number | null
  dueInDays: number | null
  blocker: AttemptBlocker | null
  effort: AttemptEffort | null
  notes: string
}

/** Completed and attempted counts inside one topic, split by difficulty. */
export interface TopicDifficulty {
  difficulty: Difficulty
  solved: number
  attempted: number
}

export interface TopicBlocker {
  blocker: AttemptBlocker
  count: number
  total: number
}

/** Everything one carousel slide renders, and everything its copy action emits. */
export interface TopicFocus {
  topic: string
  score: number
  solved: number
  attempted: number
  problemCount: number
  dueCount: number
  averageMinutes: number
  difficulty: TopicDifficulty[]
  topBlocker: TopicBlocker | null
  attemptedProblems: TopicProblem[]
  unattemptedProblems: TopicProblem[]
}

export interface TopicMastery {
  topic: string
  score: number
  attempted: number
  problemCount: number
}

export interface DifficultyMix {
  difficulty: Difficulty
  solved: number
  attempted: number
  total: number
  percent: number
}

export interface ConsistencySummary {
  days: ActivityDay[]
  weeks: ActivityWeek[]
  totalMinutes: number
  activeDays: number
  streak: number
  bestStreak: number
}

export interface ReadinessPoint {
  name: string
  score: number
}

export interface ReadinessSummary {
  score: number
  solved: number
  totalProblems: number
  averageDuration: number
  activeDays: number
  history: ReadinessPoint[]
}

export interface DashboardData {
  attemptCount: number
  solvedCount: number
  loggedToday: number
  focuses: TopicFocus[]
  summary: SummaryStat[]
  consistency: ConsistencySummary
  queue: ReviewItem[]
  dueCount: number
  mastery: TopicMastery[]
  masteryScore: number
  readiness: ReadinessSummary
  mix: DifficultyMix[]
}

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

/** Whole days between two instants, ignoring the time of day. */
function dayDistance(from: Date, to: Date): number {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY
  )
}

/** Monday-first weekday index, so the heatmap rows read M–S. */
function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

function activityLevel(minutes: number): number {
  if (minutes === 0) {
    return 0
  }

  if (minutes < 30) {
    return 1
  }

  if (minutes < 60) {
    return 2
  }

  return minutes < 100 ? 3 : 4
}

function activityByDay(attempts: Attempt[]): {
  minutes: Map<string, number>
  counts: Map<string, number>
} {
  const minutes = new Map<string, number>()
  const counts = new Map<string, number>()

  for (const attempt of attempts) {
    const key = dayKey(new Date(attempt.completedAt))
    minutes.set(key, (minutes.get(key) ?? 0) + attempt.durationMinutes)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return { minutes, counts }
}

function groupByProblem(attempts: Attempt[]): Map<number, Attempt[]> {
  const grouped = new Map<number, Attempt[]>()

  for (const attempt of attempts) {
    const bucket = grouped.get(attempt.problemId)

    if (bucket) {
      bucket.push(attempt)
      continue
    }

    grouped.set(attempt.problemId, [attempt])
  }

  return grouped
}

function attemptsThrough(attempts: Attempt[], cutoff: Date): Attempt[] {
  const limit = cutoff.getTime()
  return attempts.filter(
    (attempt) => new Date(attempt.completedAt).getTime() <= limit
  )
}

function totalMinutes(attempts: Attempt[]): number {
  return attempts.reduce((total, attempt) => total + attempt.durationMinutes, 0)
}

/**
 * Folds each problem's attempt history into its scheduling state. Replaying the
 * whole history keeps the result recomputable from attempts alone.
 */
export function buildReviewStates(
  attempts: Attempt[],
  now: Date = new Date()
): ReviewState[] {
  const states: ReviewState[] = []

  for (const [problemId, history] of groupByProblem(attempts)) {
    const ordered = [...history].sort((a, b) =>
      a.completedAt.localeCompare(b.completedAt)
    )

    let intervalDays = 1
    let lapses = 0
    let streak = 0

    for (const attempt of ordered) {
      const growth = INTERVAL_GROWTH[attempt.outcome]

      if (growth === 0) {
        intervalDays = 1
        lapses += 1
        streak = 0
        continue
      }

      intervalDays = Math.max(1, Math.round(intervalDays * growth))
      streak += 1
    }

    const lastAttempt = ordered[ordered.length - 1]
    const dueOn = addDays(new Date(lastAttempt.completedAt), intervalDays)

    states.push({
      problemId,
      lastAttempt,
      attemptCount: ordered.length,
      intervalDays,
      lapses,
      confidence: Math.min(
        MAX_CONFIDENCE,
        CONFIDENCE_BASE[lastAttempt.outcome] + (streak >= 3 ? 1 : 0)
      ),
      dueInDays: dayDistance(now, dueOn),
      status: deriveStatus(lastAttempt),
    })
  }

  return states.sort((a, b) => a.dueInDays - b.dueInDays)
}

/** Sidebar badge count — attempts are all it needs, so the catalog stays out. */
export function dueReviewCount(
  attempts: Attempt[],
  now: Date = new Date()
): number {
  return buildReviewStates(attempts, now).filter(
    (state) => state.dueInDays <= 0
  ).length
}

/**
 * Streaks count days that carry an attempt, not days that carry minutes — a
 * logged attempt of zero duration is still a day at the desk.
 */
function currentStreak(counts: Map<string, number>, now: Date): number {
  let cursor = startOfDay(now)

  // A day that has not been logged yet should not break yesterday's streak.
  if (!counts.get(dayKey(cursor))) {
    cursor = addDays(cursor, -1)
  }

  let streak = 0

  while (counts.get(dayKey(cursor))) {
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return streak
}

function bestStreak(counts: Map<string, number>): number {
  const active = [...counts.entries()]
    .filter(([, count]) => count > 0)
    .map(([key]) => key)
    .sort()

  let best = 0
  let run = 0
  let previous: Date | null = null

  for (const key of active) {
    const date = startOfDay(new Date(`${key}T00:00:00`))
    run = previous && dayDistance(previous, date) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    previous = date
  }

  return best
}

export function buildConsistency(
  attempts: Attempt[],
  rangeDays: number,
  now: Date = new Date()
): ConsistencySummary {
  const { minutes: minuteTotals, counts } = activityByDay(attempts)
  const today = startOfDay(now)
  const days: ActivityDay[] = []

  for (let offset = rangeDays - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset)
    const key = dayKey(date)
    const minutes = minuteTotals.get(key) ?? 0
    const problemCount = counts.get(key) ?? 0

    days.push({
      key,
      label: `${WEEKDAY_LABELS[weekdayIndex(date)]}, ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
      minutes,
      problemCount,
      level: activityLevel(minutes),
    })
  }

  const weeks: ActivityWeek[] = []
  const leadingBlanks =
    days.length > 0 ? weekdayIndex(addDays(today, -(rangeDays - 1))) : 0
  const cells: (ActivityDay | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...days,
  ]

  for (let start = 0; start < cells.length; start += 7) {
    const slice = cells.slice(start, start + 7)

    weeks.push({
      key: `week-${start / 7}`,
      days: [...slice, ...Array.from({ length: 7 - slice.length }, () => null)],
    })
  }

  return {
    days,
    weeks,
    totalMinutes: days.reduce((total, day) => total + day.minutes, 0),
    activeDays: days.filter((day) => day.problemCount > 0).length,
    streak: currentStreak(counts, now),
    bestStreak: bestStreak(counts),
  }
}

function solvedProblemIds(attempts: Attempt[]): Set<number> {
  const solved = new Set<number>()

  for (const attempt of Object.values(indexAttempts(attempts))) {
    if (deriveStatus(attempt) === "solved") {
      solved.add(attempt.problemId)
    }
  }

  return solved
}

/** Weighted mean of every attempted problem's status, scaled to 0–100. */
export function masteryScore(attempts: Attempt[]): number {
  const latest = Object.values(indexAttempts(attempts))

  if (latest.length === 0) {
    return 0
  }

  const total = latest.reduce(
    (sum, attempt) => sum + STATUS_WEIGHT[deriveStatus(attempt)],
    0
  )

  return Math.round((total / latest.length) * 100)
}

/** Distinct days carrying an attempt inside the window ending at `cutoff`. */
function activeDaysWithin(
  attempts: Attempt[],
  cutoff: Date,
  rangeDays: number
): number {
  const from = addDays(startOfDay(cutoff), -(rangeDays - 1)).getTime()
  const to = cutoff.getTime()
  const days = new Set<string>()

  for (const attempt of attempts) {
    const at = new Date(attempt.completedAt)
    const time = at.getTime()

    if (time >= from && time <= to) {
      days.add(dayKey(at))
    }
  }

  return days.size
}

interface ReadinessSnapshot {
  score: number
  solved: number
  averageDuration: number
  activeDays: number
}

/**
 * Readiness as of a single instant. Every term is measured against the history
 * that existed at `cutoff`, so replaying the function across past cutoffs
 * yields a real trend rather than today's figure smeared backwards.
 */
function readinessAt(
  problems: Problem[],
  attempts: Attempt[],
  cutoff: Date,
  rangeDays: number
): ReadinessSnapshot {
  const window = attemptsThrough(attempts, cutoff)
  const solved = solvedProblemIds(window).size
  const coverage =
    problems.length > 0 ? Math.min(100, (solved / problems.length) * 100) : 0
  const mastery = masteryScore(window)
  const activeDays = activeDaysWithin(window, cutoff, rangeDays)
  const activity = Math.min(100, (activeDays / rangeDays) * 100)
  const averageDuration = window.length
    ? totalMinutes(window) / window.length
    : 0
  const pace =
    averageDuration > 0
      ? Math.min(100, (TARGET_MINUTES / averageDuration) * 100)
      : 0

  return {
    score: Math.round(
      coverage * READINESS_WEIGHTS.coverage +
        mastery * READINESS_WEIGHTS.mastery +
        activity * READINESS_WEIGHTS.activity +
        pace * READINESS_WEIGHTS.pace
    ),
    solved,
    averageDuration,
    activeDays,
  }
}

/** Aggregate interview-readiness signal from coverage, mastery, consistency, and pace. */
export function buildReadiness(
  problems: Problem[],
  attempts: Attempt[],
  now: Date = new Date(),
  rangeDays: number = 90
): ReadinessSummary {
  const history: ReadinessPoint[] = []

  for (let back = READINESS_MONTHS - 1; back >= 0; back -= 1) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - back, 1)
    // The current month is only complete up to now; earlier months run to their end.
    const cutoff =
      back === 0
        ? now
        : new Date(now.getFullYear(), now.getMonth() - back + 1, 0, 23, 59, 59, 999)

    history.push({
      name: monthStart.toLocaleDateString(undefined, { month: "short" }),
      score: readinessAt(problems, attempts, cutoff, rangeDays).score,
    })
  }

  // Shares the cutoff with the final history point, so the two agree by construction.
  const current = readinessAt(problems, attempts, now, rangeDays)

  return {
    score: current.score,
    solved: current.solved,
    totalProblems: problems.length,
    averageDuration: Math.round(current.averageDuration),
    activeDays: current.activeDays,
    history,
  }
}

/**
 * Mastery per topic, limited to the axes the catalog leans on hardest. Ranking
 * by catalog frequency keeps the radar's axis set stable as history grows;
 * topics with no attempts stay in at 0% so gaps stay visible.
 */
export function buildTopicMastery(
  problems: Problem[],
  attempts: Attempt[],
  limit: number = TOPIC_AXIS_LIMIT
): TopicMastery[] {
  const catalog = new Map(problems.map((problem) => [problem.id, problem]))
  const entries = new Map<
    string,
    { weight: number; attempted: number; problemCount: number }
  >()

  const entryFor = (topic: string) => {
    const existing = entries.get(topic)

    if (existing) {
      return existing
    }

    const created = { weight: 0, attempted: 0, problemCount: 0 }
    entries.set(topic, created)
    return created
  }

  for (const problem of problems) {
    for (const topic of problem.topics) {
      entryFor(topic).problemCount += 1
    }
  }

  for (const attempt of Object.values(indexAttempts(attempts))) {
    const problem = catalog.get(attempt.problemId)

    if (!problem) {
      continue
    }

    const weight = STATUS_WEIGHT[deriveStatus(attempt)]

    for (const topic of problem.topics) {
      const entry = entryFor(topic)
      entry.weight += weight
      entry.attempted += 1
    }
  }

  return [...entries.entries()]
    .map(([topic, entry]) => ({
      topic,
      score:
        entry.attempted > 0
          ? Math.round((entry.weight / entry.attempted) * 100)
          : 0,
      attempted: entry.attempted,
      problemCount: entry.problemCount,
    }))
    .sort(
      (a, b) =>
        b.problemCount - a.problemCount ||
        b.attempted - a.attempted ||
        a.topic.localeCompare(b.topic)
    )
    .slice(0, limit)
}

export function buildDifficultyMix(
  problems: Problem[],
  attempts: Attempt[]
): DifficultyMix[] {
  const catalog = new Map(problems.map((problem) => [problem.id, problem]))
  const solved = solvedProblemIds(attempts)
  const counts = new Map<
    Difficulty,
    { solved: number; attempted: number; total: number }
  >()

  for (const problem of problems) {
    const entry = counts.get(problem.difficulty) ?? {
      solved: 0,
      attempted: 0,
      total: 0,
    }
    entry.total += 1
    counts.set(problem.difficulty, entry)
  }

  for (const attempt of Object.values(indexAttempts(attempts))) {
    const problem = catalog.get(attempt.problemId)

    if (!problem) {
      continue
    }

    const entry = counts.get(problem.difficulty) ?? {
      solved: 0,
      attempted: 0,
      total: 0,
    }
    entry.attempted += 1
    entry.solved += solved.has(problem.id) ? 1 : 0
    counts.set(problem.difficulty, entry)
  }

  return DIFFICULTY_ORDER.map((difficulty) => {
    const entry = counts.get(difficulty) ?? {
      solved: 0,
      attempted: 0,
      total: 0,
    }

    const denominator = entry.total > 0 ? entry.total : entry.attempted

    return {
      difficulty,
      solved: entry.solved,
      attempted: entry.attempted,
      total: entry.total,
      percent:
        denominator > 0 ? Math.round((entry.solved / denominator) * 100) : 0,
    }
  })
}

/** "Dynamic Programming" -> "DP", "Trie" -> "TR". */
export function topicTag(topic: string | undefined): string {
  if (!topic) {
    return "??"
  }

  const words = topic.split(/[\s-]+/).filter(Boolean)

  if (words.length > 1) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }

  return topic.slice(0, 2).toUpperCase()
}

function dueLabel(dueInDays: number): string {
  if (dueInDays < 0) {
    return `${Math.abs(dueInDays)}d late`
  }

  if (dueInDays === 0) {
    return "Today"
  }

  return dueInDays === 1 ? "Tomorrow" : `In ${dueInDays}d`
}

const QUEUE_TONES: Record<ProblemStatus, DashboardTone> = {
  "not-started": "indigo",
  solved: "emerald",
  review: "amber",
  struggling: "amber",
}

export function queueTone(status: ProblemStatus): DashboardTone {
  return QUEUE_TONES[status]
}

function buildQueue(
  states: ReviewState[],
  catalog: Map<number, Problem>
): ReviewItem[] {
  const items: ReviewItem[] = []

  for (const state of states) {
    const problem = catalog.get(state.problemId)

    if (!problem) {
      continue
    }

    items.push({
      ...state,
      title: problem.title,
      tag: topicTag(problem.topics[0]),
      topic: problem.topics[0] ?? "General",
      when: dueLabel(state.dueInDays),
    })

    if (items.length === QUEUE_LIMIT) {
      break
    }
  }

  return items
}

function formatHours(minutes: number): string {
  const hours = minutes / 60
  return hours >= 100 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`
}

function buildSummary(
  consistency: ConsistencySummary,
  rangeDays: number
): SummaryStat[] {
  const { activeDays, totalMinutes: minutes, streak, bestStreak: best } =
    consistency
  const weeks = Math.max(1, rangeDays / 7)

  return [
    {
      id: "streak",
      label: "Current streak",
      value: `${streak}d`,
      delta: best > 0 ? `best ${best}d` : "no streak yet",
      tone: "emerald",
    },
    {
      id: "active",
      label: "Active days",
      value: `${activeDays} / ${rangeDays}`,
      delta: `${Math.round((activeDays / rangeDays) * 100)}% coverage`,
      tone: "amber",
    },
    {
      id: "average",
      label: "Average time per day",
      value: `${Math.round(minutes / rangeDays)}m`,
      delta: `${Math.round(minutes / Math.max(1, activeDays))}m on active days`,
      tone: "indigo",
    },
    {
      id: "total",
      label: "Total time logged",
      value: formatHours(minutes),
      delta: `${(minutes / 60 / weeks).toFixed(1)}h / week avg`,
      tone: "violet",
    },
  ]
}

/**
 * Ranks a topic for the carousel. Topics with review debt lead, weakest first;
 * then topics you have touched but that are not yet due; untouched topics last,
 * because a 0% score is a gap to plan for, not the thing to open on.
 */
function focusTier(focus: TopicFocus): number {
  if (focus.dueCount > 0) {
    return 0
  }

  return focus.attempted > 0 ? 1 : 2
}

function blockerFor(history: Attempt[]): TopicBlocker | null {
  const counts = new Map<AttemptBlocker, number>()

  for (const attempt of history) {
    if (attempt.blocker !== "none") {
      counts.set(attempt.blocker, (counts.get(attempt.blocker) ?? 0) + 1)
    }
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])

  if (ranked.length === 0) {
    return null
  }

  const [blocker, count] = ranked[0]

  return { blocker, count, total: history.length }
}

function toTopicProblem(
  problem: Problem,
  history: Attempt[],
  state: ReviewState | undefined
): TopicProblem {
  const ordered = [...history].sort((a, b) =>
    a.completedAt.localeCompare(b.completedAt)
  )
  const last = ordered[ordered.length - 1]

  return {
    id: problem.id,
    title: problem.title,
    slug: problem.slug,
    difficulty: problem.difficulty,
    acceptance: problem.acceptance,
    attempts: ordered.length,
    lastOutcome: last?.outcome ?? null,
    lastDurationMinutes: last?.durationMinutes ?? null,
    bestDurationMinutes: bestDuration(ordered) ?? null,
    lapses: state?.lapses ?? 0,
    intervalDays: state?.intervalDays ?? null,
    dueInDays: state?.dueInDays ?? null,
    blocker: last?.blocker ?? null,
    effort: last?.effort ?? null,
    notes: last?.notes ?? "",
  }
}

/**
 * Folds the catalog and the attempt history into one slide per topic. Pure —
 * the carousel position picks a slide, it does not change what is computed.
 */
export function buildTopicFocuses(
  problems: Problem[],
  attempts: Attempt[],
  now: Date = new Date(),
  limit: number = TOPIC_AXIS_LIMIT
): TopicFocus[] {
  const mastery = buildTopicMastery(problems, attempts, limit)
  const byProblem = groupByProblem(attempts)
  const states = new Map(
    buildReviewStates(attempts, now).map((state) => [state.problemId, state])
  )
  const solved = solvedProblemIds(attempts)

  const focuses = mastery.map((entry) => {
    const catalogProblems = problems.filter((problem) =>
      problem.topics.includes(entry.topic)
    )

    const attemptedProblems: TopicProblem[] = []
    const unattemptedProblems: TopicProblem[] = []
    const history: Attempt[] = []
    const tallies: Record<Difficulty, { solved: number; attempted: number }> = {
      easy: { solved: 0, attempted: 0 },
      medium: { solved: 0, attempted: 0 },
      hard: { solved: 0, attempted: 0 },
    }
    let dueCount = 0
    let solvedCount = 0

    for (const problem of catalogProblems) {
      const problemHistory = byProblem.get(problem.id) ?? []
      const state = states.get(problem.id)
      const row = toTopicProblem(problem, problemHistory, state)
      const tally = tallies[problem.difficulty]

      if (problemHistory.length === 0) {
        unattemptedProblems.push(row)
        continue
      }

      history.push(...problemHistory)
      attemptedProblems.push(row)
      tally.attempted += 1

      if (state && state.dueInDays <= 0) {
        dueCount += 1
      }

      if (solved.has(problem.id)) {
        solvedCount += 1
        tally.solved += 1
      }
    }

    return {
      topic: entry.topic,
      score: entry.score,
      solved: solvedCount,
      attempted: attemptedProblems.length,
      problemCount: catalogProblems.length,
      dueCount,
      averageMinutes: history.length
        ? Math.round(totalMinutes(history) / history.length)
        : 0,
      difficulty: DIFFICULTY_ORDER.map((difficulty) => ({
        difficulty,
        ...tallies[difficulty],
      })),
      topBlocker: blockerFor(history),
      // Most overdue first, so the slide and the payload lead with the debt.
      attemptedProblems: attemptedProblems.sort(
        (a, b) => (a.dueInDays ?? 0) - (b.dueInDays ?? 0)
      ),
      // Widely-solved problems first — a sane default entry point into a topic.
      unattemptedProblems: unattemptedProblems
        .sort((a, b) => b.acceptance - a.acceptance)
        .slice(0, UNATTEMPTED_LIMIT),
    }
  })

  return focuses.sort(
    (a, b) =>
      focusTier(a) - focusTier(b) ||
      b.dueCount - a.dueCount ||
      a.score - b.score ||
      a.topic.localeCompare(b.topic)
  )
}

export type MasteryTier = "under" | "at" | "open"

/** Under target, at target, or never attempted — the rail's three tiers. */
export function masteryTier(focus: TopicFocus): MasteryTier {
  if (focus.attempted === 0) {
    return "open"
  }

  return focus.score >= TARGET_SCORE ? "at" : "under"
}

/**
 * Ranks study candidates by mastery gap alone — review debt deliberately plays
 * no part, so the order answers "where am I weakest" rather than "what is due".
 * Widest gap first, then topics already at target, then open ground ordered by
 * how much catalog sits behind them.
 */
export function rankByMasteryGap(focuses: TopicFocus[]): TopicFocus[] {
  const tierRank: Record<MasteryTier, number> = { under: 0, at: 1, open: 2 }

  return [...focuses].sort((a, b) => {
    const tierDelta = tierRank[masteryTier(a)] - tierRank[masteryTier(b)]

    if (tierDelta !== 0) {
      return tierDelta
    }

    if (masteryTier(a) === "open") {
      return b.problemCount - a.problemCount || a.topic.localeCompare(b.topic)
    }

    return a.score - b.score || a.topic.localeCompare(b.topic)
  })
}

export function buildDashboard(
  problems: Problem[],
  attempts: Attempt[],
  now: Date = new Date(),
  rangeDays: number = 90
): DashboardData {
  const catalog = new Map(problems.map((problem) => [problem.id, problem]))
  const states = buildReviewStates(attempts, now)
  const consistency = buildConsistency(attempts, rangeDays, now)
  const today = dayKey(startOfDay(now))

  return {
    attemptCount: attempts.length,
    solvedCount: solvedProblemIds(attempts).size,
    loggedToday: attempts.filter(
      (attempt) => dayKey(new Date(attempt.completedAt)) === today
    ).length,
    focuses: buildTopicFocuses(problems, attempts, now),
    summary: buildSummary(consistency, rangeDays),
    consistency,
    queue: buildQueue(states, catalog),
    dueCount: states.filter((state) => state.dueInDays <= 0).length,
    mastery: buildTopicMastery(problems, attempts),
    masteryScore: masteryScore(attempts),
    readiness: buildReadiness(problems, attempts, now, rangeDays),
    mix: buildDifficultyMix(problems, attempts),
  }
}
