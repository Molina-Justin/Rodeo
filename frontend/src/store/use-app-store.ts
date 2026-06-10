import type { NavView, UserProfile } from "@/types"
import { create } from "zustand"

interface AppState {
  currentView: NavView
  user: UserProfile
  setCurrentView: (view: NavView) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: "dashboard",
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatarUrl: "",
  },
  setCurrentView: (view) => set({ currentView: view }),
}))
