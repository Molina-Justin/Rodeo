import { create } from "zustand"
import { indexAttempts } from "@/lib/attempts"
import type {
  Attempt,
  AttemptDraft,
  DashboardTab,
  NavView,
  UserProfile,
} from "@/types"

interface AppState {
  currentView: NavView
  activeDashboardTab: DashboardTab
  reviewQueueCount: number
  user: UserProfile
  attempts: Attempt[]
  /** Latest attempt per problem, recomputed on every log. */
  lastAttemptByProblem: Record<number, Attempt>
  setCurrentView: (view: NavView) => void
  setActiveDashboardTab: (tab: DashboardTab) => void
  logAttempt: (draft: AttemptDraft) => void
  updateAttempt: (id: string, draft: AttemptDraft) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: "dashboard",
  activeDashboardTab: "overview",
  reviewQueueCount: 6,
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatarUrl: "",
  },
  attempts: [],
  lastAttemptByProblem: {},
  setCurrentView: (view) => set({ currentView: view }),
  setActiveDashboardTab: (tab) => set({ activeDashboardTab: tab }),
  logAttempt: (draft) =>
    set((state) => {
      const attempts = [...state.attempts, { ...draft, id: crypto.randomUUID() }]

      return {
        attempts,
        lastAttemptByProblem: indexAttempts(attempts),
      }
    }),
  updateAttempt: (id, draft) =>
    set((state) => {
      const attempts = state.attempts.map((attempt) =>
        attempt.id === id ? { ...draft, id } : attempt
      )

      return {
        attempts,
        lastAttemptByProblem: indexAttempts(attempts),
      }
    }),
}))
