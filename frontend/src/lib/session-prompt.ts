import type { TopicFocus, TopicProblem } from "@/lib/dashboard"
import { interpolatePromptTemplate } from "@/lib/prompt-templates"

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
  /** Completed problem history for the selected topic only. */
  completedProblems: TopicProblem[]
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
    completedProblems:
      focus.attempted > 0 ? focus.attemptedProblems.map(strip) : [],
  }
}

/** Task text used only before the prompt-templates request has resolved. */
function defaultSessionTask(payload: SessionPayload) {
  return [
    `Pick ${payload.request.problemCount} problems for a ${payload.request.minutes}-minute session on ${payload.topic}.`,
    payload.completedProblems.length > 0
      ? "Weigh overdue reviews against new coverage."
      : "Build a sensible entry point and increase the difficulty gradually.",
    payload.topBlocker ? "Account for the recurring blocker above." : "",
    "For each pick, give one sentence on why it earns the slot and what to",
    "watch for. Order them for the session.",
  ]
    .filter(Boolean)
    .join(" ")
}

/**
 * JSON keeps the selected topic context and its completed problem rows. It
 * intentionally excludes unanswered catalog rows, which are not user history.
 * The interpolated Settings template is included as `task`.
 */
export function toJson(payload: SessionPayload, template?: string): string {
  const instructions = template
    ? interpolatePromptTemplate(template, {
        topic: payload.topic,
        minutes: payload.request.minutes,
        problem_count: payload.request.problemCount,
        blocker: payload.topBlocker?.blocker ?? "No recurring blocker",
        readiness: `${payload.readinessScore}%`,
      })
    : defaultSessionTask(payload)
  const task =
    payload.completedProblems.length === 0
      ? `I have no completed problems in ${payload.topic} yet. Do not infer any prior performance from unanswered catalog problems. ${instructions}`
      : instructions

  return JSON.stringify({ ...payload, task }, null, 2)
}
