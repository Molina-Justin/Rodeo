import type { TopicFocus, TopicProblem } from "@/lib/dashboard"
import { interpolatePromptTemplate } from "@/lib/prompt-templates"


export interface SessionOptions {
  minutes: number
  problemCount: number
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

export interface CandidateGoals {
  targetRole: string
  targetDate: string
  yearsExperience: number | null
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
  completedProblems: TopicProblem[]
  candidateGoals: CandidateGoals | null
}

export function buildSessionPayload(
  focus: TopicFocus,
  context: SessionContext,
  options: SessionOptions = DEFAULT_SESSION_OPTIONS,
  candidateGoals: CandidateGoals | null = null
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
    candidateGoals:
      candidateGoals &&
      (candidateGoals.targetRole ||
        candidateGoals.targetDate ||
        candidateGoals.yearsExperience !== null)
        ? candidateGoals
        : null,
  }
}

function defaultSessionTask(payload: SessionPayload) {
  return [
    `Pick ${payload.request.problemCount} problems for a ${payload.request.minutes}-minute session on ${payload.topic}.`,
    payload.completedProblems.length > 0
      ? "Weigh overdue reviews against new coverage."
      : "Start with an approachable problem, then increase the difficulty.",
    payload.topBlocker ? "Account for the recurring blocker above." : "",
    "For each pick, explain why you chose it and what to watch for. Order them for the session.",
  ]
    .filter(Boolean)
    .join(" ")
}

export function toJson(payload: SessionPayload, template?: string): string {
  const goals = payload.candidateGoals
  const instructions = template
    ? interpolatePromptTemplate(template, {
        topic: payload.topic,
        minutes: payload.request.minutes,
        problem_count: payload.request.problemCount,
        blocker: payload.topBlocker?.blocker ?? "No recurring blocker",
        readiness: `${payload.readinessScore}%`,
        target_role: goals?.targetRole || "Not specified",
        target_date: goals?.targetDate || "Not specified",
        years_experience: goals?.yearsExperience ?? "Not specified",
      })
    : defaultSessionTask(payload)
  const task =
    payload.completedProblems.length === 0
      ? `I have no completed problems in ${payload.topic} yet. Do not infer any prior performance from unanswered catalog problems. ${instructions}`
      : instructions

  return JSON.stringify({ ...payload, task }, null, 2)
}
