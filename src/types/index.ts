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

export type DashboardTab = "overview" | "sessions" | "progress" | "roadmap"

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

export interface Attempt {
  problemId: number
  completedAt: string
  durationMinutes: number
  outcome: AttemptOutcome
}

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
