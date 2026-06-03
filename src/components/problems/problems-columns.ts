import type { ProblemColumnId } from "@/types"

export interface ProblemColumn {
  id: ProblemColumnId
  label: string
}

export const PROBLEM_COLUMNS: ProblemColumn[] = [
  { id: "status", label: "Status" },
  { id: "number", label: "Number" },
  { id: "problem", label: "Problem" },
  { id: "topic", label: "Topic" },
  { id: "difficulty", label: "Difficulty" },
  { id: "lastAttempt", label: "Last attempt" },
  { id: "acceptance", label: "Acceptance" },
]

export const DEFAULT_VISIBLE_COLUMNS: ProblemColumnId[] = [
  "status",
  "number",
  "problem",
  "topic",
  "difficulty",
  "lastAttempt",
]
