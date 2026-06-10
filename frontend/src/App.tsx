import * as React from "react"

import { SiteHeader } from "@/components/layout/site-header"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAppStore } from "@/store/use-app-store"

const DashboardOverview = React.lazy(async () => ({
  default: (await import("@/components/dashboard/dashboard-overview"))
    .DashboardOverview,
}))
const ProblemsPage = React.lazy(async () => ({
  default: (await import("@/components/problems/problems-page")).ProblemsPage,
}))
const ReviewQueuePage = React.lazy(async () => ({
  default: (await import("@/components/review-queue/review-queue-page"))
    .ReviewQueuePage,
}))
const SettingsPage = React.lazy(async () => ({
  default: (await import("@/components/settings/settings-page")).SettingsPage,
}))

function PageFallback() {
  return <Skeleton className="h-96 w-full rounded-2xl" />
}

function AppContent() {
  const currentView = useAppStore((state) => state.currentView)

  if (currentView === "problems") {
    return <ProblemsPage />
  }

  if (currentView === "review-queue") {
    return <ReviewQueuePage />
  }

  if (currentView === "settings") {
    return <SettingsPage />
  }

  return <DashboardOverview />
}

export function App() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "17rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset className="overflow-hidden border border-border">
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-6 pt-6 pb-8">
          <React.Suspense fallback={<PageFallback />}>
            <AppContent />
          </React.Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
