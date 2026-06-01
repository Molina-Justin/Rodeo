export type NavView =
  | "dashboard"
  | "lifecycle"
  | "analytics"
  | "projects"
  | "team"
  | "data-library"
  | "reports"
  | "word-assistant"
  | "settings"
  | "help"

export type TableTab =
  | "outline"
  | "past-performance"
  | "key-personnel"
  | "focus-documents"

export interface MetricCardData {
  title: string
  value: string
  change: string
  trend: "up" | "down" | "neutral"
  subtextTitle: string
  subtextDescription: string
}

export interface ActivityDataPoint {
  date: string
  primary: number
  secondary: number
}

export type SectionStatus = "In Process" | "Done" | "To Review" | "Pending"

export interface OutlineItem {
  id: string
  header: string
  sectionType: string
  status: SectionStatus
  target: number
  limit: number
  reviewer: string
}

export interface UserProfile {
  name: string
  email: string
  avatarUrl?: string
}
