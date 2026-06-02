import { DashboardPlaceholder } from "@/components/dashboard/dashboard-placeholder"
import { DashboardToolbar } from "@/components/layout/dashboard-toolbar"
import { SiteHeader } from "@/components/layout/site-header"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

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
          <DashboardToolbar />
          <DashboardPlaceholder />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
