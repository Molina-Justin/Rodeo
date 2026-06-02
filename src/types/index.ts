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
