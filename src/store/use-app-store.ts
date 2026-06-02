import { create } from "zustand"
import type {
  DashboardTab,
  NavView,
  StudyTrack,
  TableTab,
  UserProfile,
} from "@/types"

interface AppState {
  currentView: NavView
  activeDashboardTab: DashboardTab
  activeTableTab: TableTab
  timeRange: "30d" | "7d" | "12m"
  searchQuery: string
  reviewQueueCount: number
  tracks: StudyTrack[]
  user: UserProfile
  setCurrentView: (view: NavView) => void
  setActiveDashboardTab: (tab: DashboardTab) => void
  setActiveTableTab: (tab: TableTab) => void
  setTimeRange: (range: "30d" | "7d" | "12m") => void
  setSearchQuery: (query: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: "dashboard",
  activeDashboardTab: "overview",
  activeTableTab: "outline",
  timeRange: "30d",
  searchQuery: "",
  reviewQueueCount: 6,
  tracks: [
    { id: "arrays-hashing", name: "Arrays & Hashing", signal: "high" },
    { id: "graphs", name: "Graphs", signal: "low" },
    { id: "dynamic-programming", name: "Dynamic Programming", signal: "medium" },
  ],
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatarUrl: "",
  },
  setCurrentView: (view) => set({ currentView: view }),
  setActiveDashboardTab: (tab) => set({ activeDashboardTab: tab }),
  setActiveTableTab: (tab) => set({ activeTableTab: tab }),
  setTimeRange: (range) => set({ timeRange: range }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}))
