import { DashboardPlaceholder } from "@/components/dashboard/dashboard-placeholder"
import { DashboardToolbar } from "@/components/layout/dashboard-toolbar"
import { SiteHeader } from "@/components/layout/site-header"
import { ProblemsPage } from "@/components/problems/problems-page"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAppStore } from "@/store/use-app-store"

function AppContent() {
  const currentView = useAppStore((state) => state.currentView)

  if (currentView === "problems") {
    return <ProblemsPage />
  }

  return (
    <>
      <DashboardToolbar />
      <DashboardPlaceholder />
    </>
  )
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
        <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-6 pt-2 pb-8">
          <AppContent />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
