import { create } from "zustand"
import type { DashboardTab, NavView, UserProfile } from "@/types"

interface AppState {
  currentView: NavView
  activeDashboardTab: DashboardTab
  reviewQueueCount: number
  user: UserProfile
  setCurrentView: (view: NavView) => void
  setActiveDashboardTab: (tab: DashboardTab) => void
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
  setCurrentView: (view) => set({ currentView: view }),
  setActiveDashboardTab: (tab) => set({ activeDashboardTab: tab }),
}))
