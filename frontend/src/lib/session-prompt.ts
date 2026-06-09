import type { TopicFocus, TopicProblem } from "@/lib/dashboard"

/**
 * Builds the clipboard payload for a study session. The AI that consumes this
 * lives entirely outside the app — there is no request, no key, and nothing
 * here feeds mastery or scheduling. It is a string the user carries by hand.
 */

export interface SessionOptions {
  minutes: number
  problemCount: number
  /** Notes are free text written for the user alone, so they ship opt-in. */
  includeNotes: boolean
}

export const DEFAULT_SESSION_OPTIONS: SessionOptions = {
  minutes: 60,
  problemCount: 3,
  includeNotes: false,
}

export interface SessionContext {
  readinessScore: number
  streak: number
  targetScore: number
  targetMinutes: number
}

export interface SessionPayload {
  topic: string
  mastery: { score: number; target: number }
  coverage: { solved: number; attempted: number; total: number }
  reviewsDue: number
  averageMinutes: number
  targetMinutes: number
  topBlocker: TopicFocus["topBlocker"]
  readinessScore: number
  streakDays: number
  request: { minutes: number; problemCount: number }
  attempted: TopicProblem[]
  unattempted: TopicProblem[]
}

export function buildSessionPayload(
  focus: TopicFocus,
  context: SessionContext,
  options: SessionOptions = DEFAULT_SESSION_OPTIONS
): SessionPayload {
  const strip = (problem: TopicProblem): TopicProblem =>
    options.includeNotes ? problem : { ...problem, notes: "" }

  return {
    topic: focus.topic,
    mastery: { score: focus.score, target: context.targetScore },
    coverage: {
      solved: focus.solved,
      attempted: focus.attempted,
      total: focus.problemCount,
    },
    reviewsDue: focus.dueCount,
    averageMinutes: focus.averageMinutes,
    targetMinutes: context.targetMinutes,
    topBlocker: focus.topBlocker,
    readinessScore: context.readinessScore,
    streakDays: context.streak,
    request: {
      minutes: options.minutes,
      problemCount: options.problemCount,
    },
    attempted: focus.attempted > 0 ? focus.attemptedProblems.map(strip) : [],
    unattempted: focus.unattemptedProblems.map(strip),
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function tag(name: string, value: string | number | null): string {
  if (value === null || value === "") {
    return ""
  }

  return `<${name}>${escapeXml(String(value))}</${name}>`
}

function problemXml(problem: TopicProblem, indent: string): string {
  const fields = [
    tag("id", problem.id),
    tag("title", problem.title),
    tag("difficulty", problem.difficulty),
    tag("acceptance", `${problem.acceptance.toFixed(1)}%`),
    tag("attempts", problem.attempts || null),
    tag("last_outcome", problem.lastOutcome),
    tag("last_minutes", problem.lastDurationMinutes),
    tag("best_minutes", problem.bestDurationMinutes),
    tag("lapses", problem.lapses || null),
    tag("interval_days", problem.intervalDays),
    tag("due_in_days", problem.dueInDays),
    tag("blocker", problem.blocker === "none" ? null : problem.blocker),
    tag("effort", problem.effort),
    tag("notes", problem.notes),
  ].filter(Boolean)

  return `${indent}<problem>${fields.join("")}</problem>`
}

/**
 * XML rather than JSON: tagged structure is what the models read most reliably,
 * and it survives being pasted into a chat box without a code fence.
 */
export function toXml(payload: SessionPayload): string {
  const blocker = payload.topBlocker
    ? `<recurring_blocker count="${payload.topBlocker.count}" of="${payload.topBlocker.total}">${escapeXml(payload.topBlocker.blocker)}</recurring_blocker>`
    : ""

  const lines = [
    "<study_session_request>",
    "  <context>",
    `    ${tag("topic", payload.topic)}`,
    `    <mastery score="${payload.mastery.score}" target="${payload.mastery.target}" />`,
    `    <coverage solved="${payload.coverage.solved}" attempted="${payload.coverage.attempted}" catalog_total="${payload.coverage.total}" />`,
    `    ${tag("reviews_due", payload.reviewsDue)}`,
    `    <pace average_minutes="${payload.averageMinutes}" target_minutes="${payload.targetMinutes}" />`,
    blocker ? `    ${blocker}` : "",
    `    ${tag("overall_readiness", `${payload.readinessScore}%`)}`,
    `    ${tag("current_streak_days", payload.streakDays)}`,
    "  </context>",
    "",
    `  <attempted count="${payload.attempted.length}">`,
    ...payload.attempted.map((problem) => problemXml(problem, "    ")),
    "  </attempted>",
    "",
    `  <not_yet_attempted count="${payload.unattempted.length}">`,
    ...payload.unattempted.map((problem) => problemXml(problem, "    ")),
    "  </not_yet_attempted>",
    "",
    "  <task>",
    `    Pick ${payload.request.problemCount} problems for a ${payload.request.minutes}-minute session on ${payload.topic}.`,
    payload.attempted.length > 0
      ? "    Weigh overdue reviews against new coverage."
      : "    I have no history in this topic — pick a sane entry point and build up.",
    blocker ? "    Account for the recurring blocker above." : "",
    "    For each pick, give one sentence on why it earns the slot and what to",
    "    watch for. Order them for the session.",
    "  </task>",
    "</study_session_request>",
  ]

  return lines.filter((line) => line !== "").join("\n")
}

export function toJson(payload: SessionPayload): string {
  return JSON.stringify(payload, null, 2)
}
