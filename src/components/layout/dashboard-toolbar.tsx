import { CalendarIcon, LayoutGridIcon, TableIcon, TrendingUpIcon } from "lucide-react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAppStore } from "@/store/use-app-store"
import type { DashboardTab } from "@/types"

const tabs: { value: DashboardTab; label: string; icon: typeof CalendarIcon }[] = [
  { value: "overview", label: "Overview", icon: LayoutGridIcon },
  { value: "sessions", label: "Sessions", icon: TableIcon },
  { value: "progress", label: "Progress", icon: TrendingUpIcon },
  { value: "roadmap", label: "Roadmap", icon: CalendarIcon },
]

export function DashboardToolbar() {
  const user = useAppStore((state) => state.user)
  const activeDashboardTab = useAppStore((state) => state.activeDashboardTab)
  const setActiveDashboardTab = useAppStore(
    (state) => state.setActiveDashboardTab
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back, {user.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Stay on top of your sessions, track mastery, and clear your review
          queue.
        </p>
      </div>
      <Tabs
        value={activeDashboardTab}
        onValueChange={(value) => setActiveDashboardTab(value as DashboardTab)}
      >
        <TabsList
          variant="line"
          className="h-11 gap-1 rounded-xl border border-border p-1"
        >
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="h-full gap-2 rounded-lg px-4 data-active:bg-muted data-active:text-foreground"
            >
              <tab.icon />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
