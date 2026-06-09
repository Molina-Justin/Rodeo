import * as React from "react"
import { BellIcon, PlusIcon } from "lucide-react"

import { ModeToggle } from "@/components/layout/mode-toggle"
import { LogSessionDialog } from "@/components/problems/log-session-dialog"
import { ProblemDialog } from "@/components/problems/problem-dialog"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useAppStore } from "@/store/use-app-store"
import type { NavView, Problem } from "@/types"

const viewLabels: Record<NavView, string> = {
  focus: "Focus",
  dashboard: "Overview",
  problems: "Problems",
  schedule: "Schedule",
  "review-queue": "Review Queue",
  tracks: "Tracks",
  library: "Library",
  analytics: "Analytics",
  settings: "Settings",
  help: "Help Center",
}

export function SiteHeader() {
  const currentView = useAppStore((state) => state.currentView)
  const [logProblemOpen, setLogProblemOpen] = React.useState(false)
  const [pendingProblem, setPendingProblem] = React.useState<Problem | null>(
    null
  )
  const [selectedProblem, setSelectedProblem] = React.useState<Problem | null>(
    null
  )

  React.useEffect(() => {
    if (!logProblemOpen && pendingProblem) {
      setSelectedProblem(pendingProblem)
      setPendingProblem(null)
    }
  }, [logProblemOpen, pendingProblem])

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-2 size-9 rounded-lg text-muted-foreground hover:text-foreground" />
        <Separator
          orientation="vertical"
          className="mx-1 h-4 data-vertical:self-auto"
        />
        <Breadcrumb>
          <BreadcrumbList className="text-sm">
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium">
                {viewLabels[currentView]}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex items-center gap-2">
        <ModeToggle />
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 rounded-lg text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <BellIcon />
          <span className="absolute top-2 right-2 size-2 rounded-full bg-destructive ring-2 ring-background" />
        </Button>
        <Button
          className="h-9 rounded-lg px-4"
          onClick={() => setLogProblemOpen(true)}
        >
          <PlusIcon />
          Log Problem
        </Button>
      </div>
      <LogSessionDialog
        open={logProblemOpen}
        onOpenChange={setLogProblemOpen}
        onSelectProblem={(problem) => {
          setPendingProblem(problem)
          setLogProblemOpen(false)
        }}
      />
      <ProblemDialog
        problem={selectedProblem}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedProblem(null)
          }
        }}
      />
    </header>
  )
}
