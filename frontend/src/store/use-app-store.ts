import type { NavView } from "@/types"
import { create } from "zustand"

interface AppState {
  currentView: NavView
  setCurrentView: (view: NavView) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: "dashboard",
  setCurrentView: (view) => set({ currentView: view }),
}))
