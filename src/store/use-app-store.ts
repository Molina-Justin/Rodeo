import { create } from "zustand"
import type { NavView, TableTab, UserProfile } from "@/types"

interface AppState {
  currentView: NavView
  activeTableTab: TableTab
  timeRange: "30d" | "7d" | "12m"
  searchQuery: string
  user: UserProfile
  setCurrentView: (view: NavView) => void
  setActiveTableTab: (tab: TableTab) => void
  setTimeRange: (range: "30d" | "7d" | "12m") => void
  setSearchQuery: (query: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: "dashboard",
  activeTableTab: "outline",
  timeRange: "30d",
  searchQuery: "",
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatarUrl: "",
  },
  setCurrentView: (view) => set({ currentView: view }),
  setActiveTableTab: (tab) => set({ activeTableTab: tab }),
  setTimeRange: (range) => set({ timeRange: range }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}))
