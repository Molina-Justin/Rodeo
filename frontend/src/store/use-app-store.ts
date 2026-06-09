import { demoAttempts } from "@/lib/__demo-attempts"
import { indexAttempts } from "@/lib/attempts"
import type { Attempt, AttemptDraft, NavView, UserProfile } from "@/types"
import { create } from "zustand"

interface AppState {
  currentView: NavView
  user: UserProfile
  attempts: Attempt[]
  /** Latest attempt per problem, recomputed on every log. */
  lastAttemptByProblem: Record<number, Attempt>
  setCurrentView: (view: NavView) => void
  logAttempt: (draft: AttemptDraft) => void
  updateAttempt: (id: string, draft: AttemptDraft) => void
}

/** Seed history for the design pass. `demoAttempts` advances a module-level
 * seed, so it must be called exactly once — the store and its index have to
 * describe the same set of attempts. Drops out once the API owns the data. */
const seedAttempts = demoAttempts()

export const useAppStore = create<AppState>((set) => ({
  currentView: "dashboard",
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatarUrl: "",
  },
  attempts: seedAttempts,
  lastAttemptByProblem: indexAttempts(seedAttempts),
  setCurrentView: (view) => set({ currentView: view }),
  logAttempt: (draft) =>
    set((state) => {
      const attempts = [
        ...state.attempts,
        { ...draft, id: crypto.randomUUID() },
      ]

      return {
        attempts,
        lastAttemptByProblem: indexAttempts(attempts),
      }
    }),
  updateAttempt: (id, draft) =>
    set((state) => {
      const attempts = state.attempts.map((attempt) =>
        attempt.id === id ? { ...attempt, ...draft, id } : attempt
      )

      return {
        attempts,
        lastAttemptByProblem: indexAttempts(attempts),
      }
    }),
}))
