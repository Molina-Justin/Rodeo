export type NavView =
  | "focus"
  | "dashboard"
  | "problems"
  | "schedule"
  | "review-queue"
  | "tracks"
  | "library"
  | "analytics"
  | "settings"
  | "help"

export interface UserProfile {
  name: string
  email: string
  avatarUrl?: string
}

export type Difficulty = "easy" | "medium" | "hard"

export interface Problem {
  id: number
  title: string
  slug: string
  difficulty: Difficulty
  premium: boolean
  acceptance: number
  topics: string[]
  status: ProblemStatus
  attemptCount: number
  hasNotes: boolean
  hasAudio: boolean
  hasTranscript: boolean
  lastAttempt?: Attempt
}

export type DifficultyFilter = Difficulty | "all"

export type AccessFilter = "all" | "free" | "premium"

export type ProblemSort =
  | "id-asc"
  | "id-desc"
  | "title-asc"
  | "title-desc"
  | "difficulty-asc"
  | "difficulty-desc"
  | "acceptance-desc"
  | "acceptance-asc"

export type AttemptOutcome = "optimal" | "hint" | "solution" | "failed"

export type AttemptEffort = "light" | "moderate" | "heavy" | "brutal"

export type AttemptBlocker =
  | "none"
  | "pattern"
  | "edge-cases"
  | "complexity"
  | "implementation"
  | "debugging"
  | "time"

export interface Attempt {
  id: string
  problemId: number
  completedAt: string
  durationMinutes: number
  outcome: AttemptOutcome
  effort: AttemptEffort
  blocker: AttemptBlocker
  notes: string
  /** Durable recording endpoint returned by the API. */
  audioUrl?: string
  recordingId?: string
  transcriptionId?: string
  transcriptionStatus?: "queued" | "processing" | "completed" | "failed"
  hasTranscript?: boolean
}

export type AttemptDraft = Omit<Attempt, "id">

export type ProblemStatus = "not-started" | "solved" | "review" | "struggling"

export type ProblemColumnId =
  | "status"
  | "number"
  | "problem"
  | "topic"
  | "difficulty"
  | "acceptance"
  | "lastAttempt"

export type StatusFilter = ProblemStatus | "all"

export interface ProblemFilters {
  search: string
  difficulty: DifficultyFilter
  status: StatusFilter
  access: AccessFilter
}
