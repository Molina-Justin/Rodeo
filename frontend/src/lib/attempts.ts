import type {
  Attempt,
  AttemptBlocker,
  AttemptEffort,
  AttemptOutcome,
  ProblemStatus,
} from "@/types"

export interface AttemptArtifacts {
  hasAudio: boolean
  hasNotes: boolean
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

const OUTCOME_STATUS: Record<AttemptOutcome, ProblemStatus> = {
  optimal: "solved",
  hint: "review",
  solution: "struggling",
  failed: "struggling",
}

export const OUTCOME_LABELS: Record<AttemptOutcome, string> = {
  optimal: "Independent",
  hint: "Hint",
  solution: "Solution",
  failed: "Failed",
}

export const EFFORT_LABELS: Record<AttemptEffort, string> = {
  light: "Light",
  moderate: "Moderate",
  heavy: "Heavy",
  brutal: "Brutal",
}

export const BLOCKER_LABELS: Record<AttemptBlocker, string> = {
  none: "Nothing — it flowed",
  pattern: "Missed the pattern",
  "edge-cases": "Edge cases",
  complexity: "Time or space complexity",
  implementation: "Implementation details",
  debugging: "Debugging",
  time: "Ran out of time",
}

/** Latest attempt per problem, so table rows resolve in constant time. */
export function indexAttempts(attempts: Attempt[]): Record<number, Attempt> {
  const index: Record<number, Attempt> = {}

  for (const attempt of attempts) {
    const current = index[attempt.problemId]
    if (!current || attempt.completedAt > current.completedAt) {
      index[attempt.problemId] = attempt
    }
  }

  return index
}

/** Whether a problem has any saved notes or recorded audio across its history. */
export function indexAttemptArtifacts(
  attempts: Attempt[]
): Record<number, AttemptArtifacts> {
  const index: Record<number, AttemptArtifacts> = {}

  for (const attempt of attempts) {
    const current = index[attempt.problemId] ?? {
      hasAudio: false,
      hasNotes: false,
    }

    current.hasAudio ||= Boolean(attempt.audioUrl)
    current.hasNotes ||= attempt.notes.trim() !== ""
    index[attempt.problemId] = current
  }

  return index
}

export function deriveStatus(attempt: Attempt | undefined): ProblemStatus {
  if (!attempt) {
    return "not-started"
  }

  return OUTCOME_STATUS[attempt.outcome]
}

export function daysSince(isoDate: string, now: Date = new Date()): number {
  const elapsed = now.getTime() - new Date(isoDate).getTime()
  return Math.max(0, Math.floor(elapsed / MS_PER_DAY))
}

export function formatElapsed(isoDate: string, now: Date = new Date()): string {
  const days = daysSince(isoDate, now)

  if (days === 0) {
    return "Today"
  }

  if (days < 7) {
    return `${days}d ago`
  }

  if (days < 30) {
    return `${Math.floor(days / 7)}w ago`
  }

  return `${Math.floor(days / 30)}mo ago`
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60

  if (remainder === 0) {
    return `${hours}h`
  }

  return `${hours}h ${remainder}m`
}

export function bestDuration(attempts: Attempt[]): number | undefined {
  if (attempts.length === 0) {
    return undefined
  }

  return Math.min(...attempts.map((attempt) => attempt.durationMinutes))
}

/** Minutes saved (negative) or lost (positive) against the previous attempt. */
export function durationDelta(
  attempt: Attempt,
  previous: Attempt | undefined
): number | undefined {
  if (!previous) {
    return undefined
  }

  return attempt.durationMinutes - previous.durationMinutes
}

/** "3d ago · 28m · Optimal" */
export function formatLastAttempt(attempt: Attempt, now: Date = new Date()) {
  return [
    formatElapsed(attempt.completedAt, now),
    formatDuration(attempt.durationMinutes),
    OUTCOME_LABELS[attempt.outcome],
  ]
}
