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
export const TOPIC_MASTERY_SAMPLE_TARGET = 50
export const TARGET_MINUTES = 45
export const TARGET_SCORE = 75
const UNATTEMPTED_LIMIT = 25
const READINESS_MONTHS = 6
const MAX_INTERVAL_DAYS = 365

export const MAX_CONFIDENCE = 5

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

const READINESS_DIFFICULTY_WEIGHT: Record<Difficulty, number> = {
  easy: 0.8,
  medium: 1,
  hard: 1.2,
}

const READINESS_TARGET_MINUTES: Record<Difficulty, number> = {
  easy: 20,
  medium: 30,
  hard: 45,
}

type AttemptClassification =
  "lapse" | "assisted-recall" | "independent-not-quick" | "clean-and-quick"

const READINESS_MIN_TIME_FACTOR = 0.5
const READINESS_MIN_OVERDUE_FACTOR = 0.4
const READINESS_OVERDUE_GRACE_DAYS = 14

const READINESS_WEIGHTS = {
  mastery: 0.7,
  coverage: 0.2,
  cadence: 0.1,
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
  dueInDays: number | null
  status: ProblemStatus
  nextDueOn: string | null
  graduatedAt: string | null
  cleanQuickStreak: number
}

export interface ReviewItem extends Omit<ReviewState, "dueInDays"> {
  dueInDays: number
  title: string
  tag: string
  topic: string
  when: string
}

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

function dayDistance(from: Date, to: Date): number {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY
  )
}

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

function classifyAttempt(attempt: Attempt): AttemptClassification {
  if (attempt.outcome === "solution" || attempt.outcome === "failed") {
    return "lapse"
  }
  if (attempt.outcome === "hint") {
    return "assisted-recall"
  }
  const targetMinutes =
    attempt.targetMinutesAtAttempt ??
    READINESS_TARGET_MINUTES[attempt.difficultyAtAttempt ?? "medium"]
  const durationSeconds =
    attempt.durationSeconds ?? Math.round(attempt.durationMinutes * 60)
  return durationSeconds <= targetMinutes * 60
    ? "clean-and-quick"
    : "independent-not-quick"
}

function nextIntervalDays(
  classification: AttemptClassification,
  previousIntervalDays: number
): number {
  if (classification === "lapse") return 1

  const candidate =
    classification === "assisted-recall"
      ? Math.max(2, Math.round(previousIntervalDays * 0.7))
      : classification === "independent-not-quick"
        ? Math.max(3, Math.round(previousIntervalDays * 1.5))
        : Math.max(3, Math.round(previousIntervalDays * 2.5))

  return Math.min(MAX_INTERVAL_DAYS, candidate)
}

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
    let successfulStreak = 0
    let cleanQuickStreak = 0
    let recentCleanReviews: boolean[] = []
    let nextDueOn: Date | null = null
    let graduatedAt: string | null = null

    for (const attempt of ordered) {
      const completedOn = startOfDay(new Date(attempt.completedAt))
      const classification = classifyAttempt(attempt)
      const wasEarlyPractice =
        nextDueOn !== null &&
        completedOn.getTime() < addDays(nextDueOn, -1).getTime()

      if (graduatedAt !== null) {
        if (classification === "clean-and-quick") {
          cleanQuickStreak += 1
          continue
        }
        intervalDays = 1
        nextDueOn = null
        graduatedAt = null
        cleanQuickStreak = 0
        recentCleanReviews = []
      }

      const candidateInterval = nextIntervalDays(classification, intervalDays)
      const candidateDueOn = addDays(completedOn, candidateInterval)

      if (
        wasEarlyPractice &&
        (classification === "clean-and-quick" ||
          classification === "independent-not-quick")
      ) {
        continue
      }

      intervalDays = candidateInterval
      nextDueOn = candidateDueOn
      if (classification === "lapse") {
        lapses += 1
        successfulStreak = 0
        cleanQuickStreak = 0
        recentCleanReviews = []
        continue
      }

      successfulStreak += 1
      if (classification !== "clean-and-quick") {
        cleanQuickStreak = 0
        recentCleanReviews = []
        continue
      }

      cleanQuickStreak += 1
      recentCleanReviews = [...recentCleanReviews.slice(-2), !wasEarlyPractice]
      if (
        cleanQuickStreak >= 4 &&
        recentCleanReviews.length === 3 &&
        recentCleanReviews.every(Boolean) &&
        intervalDays >= 20
      ) {
        nextDueOn = null
        graduatedAt = attempt.completedAt
      }
    }

    const lastAttempt = ordered[ordered.length - 1]

    states.push({
      problemId,
      lastAttempt,
      attemptCount: ordered.length,
      intervalDays,
      lapses,
      confidence: Math.min(
        MAX_CONFIDENCE,
        CONFIDENCE_BASE[lastAttempt.outcome] + (successfulStreak >= 3 ? 1 : 0)
      ),
      dueInDays: nextDueOn === null ? null : dayDistance(now, nextDueOn),
      status: deriveStatus(lastAttempt),
      nextDueOn: nextDueOn === null ? null : dayKey(nextDueOn),
      graduatedAt,
      cleanQuickStreak,
    })
  }

  return states.sort((a, b) => {
    if (a.dueInDays === null) return b.dueInDays === null ? 0 : 1
    if (b.dueInDays === null) return -1
    return a.dueInDays - b.dueInDays
  })
}

export function dueReviewCount(
  attempts: Attempt[],
  now: Date = new Date()
): number {
  return buildReviewStates(attempts, now).filter(
    (state) => state.dueInDays !== null && state.dueInDays <= 0
  ).length
}

function currentStreak(counts: Map<string, number>, now: Date): number {
  let cursor = startOfDay(now)

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

export function masteryScore(
  attempts: Attempt[],
  problemCount?: number
): number {
  const latest = Object.values(indexAttempts(attempts))
  const denominator = problemCount ?? latest.length

  if (denominator === 0) {
    return 0
  }

  const total = latest.reduce(
    (sum, attempt) => sum + STATUS_WEIGHT[deriveStatus(attempt)],
    0
  )

  return Math.round((total / denominator) * 100)
}

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

function readinessTimeFactor(problem: Problem, attempt: Attempt): number {
  const targetMinutes = READINESS_TARGET_MINUTES[problem.difficulty]
  const ratio = targetMinutes / attempt.durationMinutes
  return Math.max(READINESS_MIN_TIME_FACTOR, Math.min(1, ratio))
}

function readinessAttemptQuality(problem: Problem, attempt: Attempt): number {
  const outcomeWeight = STATUS_WEIGHT[deriveStatus(attempt)]
  return (
    outcomeWeight *
    READINESS_DIFFICULTY_WEIGHT[problem.difficulty] *
    readinessTimeFactor(problem, attempt)
  )
}

function readinessOverdueFactor(dueInDays: number | null): number {
  if (dueInDays === null || dueInDays > 0) {
    return 1
  }

  const overdueDays = -dueInDays
  return Math.max(
    READINESS_MIN_OVERDUE_FACTOR,
    READINESS_OVERDUE_GRACE_DAYS / (READINESS_OVERDUE_GRACE_DAYS + overdueDays)
  )
}

function readinessAt(
  problems: Problem[],
  attempts: Attempt[],
  cutoff: Date,
  rangeDays: number
): ReadinessSnapshot {
  const window = attemptsThrough(attempts, cutoff)
  const solved = solvedProblemIds(window).size
  const coverage = problems.length > 0 ? solved / problems.length : 0
  const catalog = new Map(problems.map((problem) => [problem.id, problem]))

  let discountedTotal = 0
  for (const state of buildReviewStates(window, cutoff)) {
    const problem = catalog.get(state.problemId)

    if (!problem) {
      continue
    }

    const quality = readinessAttemptQuality(problem, state.lastAttempt)
    discountedTotal += quality * readinessOverdueFactor(state.dueInDays)
  }

  const discountedMastery =
    problems.length > 0 ? Math.min(1, discountedTotal / problems.length) : 0
  const activeDays = activeDaysWithin(window, cutoff, rangeDays)
  const cadence = rangeDays > 0 ? activeDays / rangeDays : 0
  const averageDuration = window.length
    ? totalMinutes(window) / window.length
    : 0

  return {
    score: Math.round(
      (discountedMastery * READINESS_WEIGHTS.mastery +
        coverage * READINESS_WEIGHTS.coverage +
        cadence * READINESS_WEIGHTS.cadence) *
        100
    ),
    solved,
    averageDuration,
    activeDays,
  }
}

export function buildReadiness(
  problems: Problem[],
  attempts: Attempt[],
  now: Date = new Date(),
  rangeDays: number = 90
): ReadinessSummary {
  const history: ReadinessPoint[] = []

  for (let back = READINESS_MONTHS - 1; back >= 0; back -= 1) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - back, 1)
    const cutoff =
      back === 0
        ? now
        : new Date(
            now.getFullYear(),
            now.getMonth() - back + 1,
            0,
            23,
            59,
            59,
            999
          )

    history.push({
      name: monthStart.toLocaleDateString(undefined, { month: "short" }),
      score: readinessAt(problems, attempts, cutoff, rangeDays).score,
    })
  }

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
        entry.problemCount > 0
          ? Math.round(
              (entry.weight /
                Math.min(entry.problemCount, TOPIC_MASTERY_SAMPLE_TARGET)) *
                100
            )
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

    if (!problem || state.dueInDays === null) {
      continue
    }

    items.push({
      ...state,
      dueInDays: state.dueInDays,
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
  const {
    activeDays,
    totalMinutes: minutes,
    streak,
    bestStreak: best,
  } = consistency
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

      if (
        state?.dueInDays !== null &&
        state?.dueInDays !== undefined &&
        state.dueInDays <= 0
      ) {
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
      attemptedProblems: attemptedProblems.sort(
        (a, b) => (a.dueInDays ?? 0) - (b.dueInDays ?? 0)
      ),
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

export function masteryTier(focus: TopicFocus): MasteryTier {
  if (focus.attempted === 0) {
    return "open"
  }

  return focus.score >= TARGET_SCORE ? "at" : "under"
}

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
    dueCount: states.filter(
      (state) => state.dueInDays !== null && state.dueInDays <= 0
    ).length,
    mastery: buildTopicMastery(problems, attempts),
    masteryScore: masteryScore(attempts, problems.length),
    readiness: buildReadiness(problems, attempts, now, rangeDays),
    mix: buildDifficultyMix(problems, attempts),
  }
}
