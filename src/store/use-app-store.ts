import { create } from "zustand"
import { indexAttempts } from "@/lib/attempts"
import type { Attempt, DashboardTab, NavView, UserProfile } from "@/types"

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
  logAttempt: (attempt: Attempt) => void
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
  logAttempt: (attempt) =>
    set((state) => {
      const attempts = [...state.attempts, attempt]

      return {
        attempts,
        lastAttemptByProblem: indexAttempts(attempts),
      }
    }),
}))
