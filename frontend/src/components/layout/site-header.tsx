import * as React from "react"
import { PlusIcon } from "lucide-react"

import { ModeToggle } from "@/components/layout/mode-toggle"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useAppStore } from "@/store/use-app-store"
import type { NavView, Problem } from "@/types"

const LogSessionDialog = React.lazy(async () => ({
  default: (await import("@/components/problems/log-session-dialog"))
    .LogSessionDialog,
}))
const ProblemDialog = React.lazy(async () => ({
  default: (await import("@/components/problems/problem-dialog")).ProblemDialog,
}))

const viewLabels: Record<NavView, string> = {
  focus: "Focus",
  dashboard: "Dashboard",
  problems: "Problems",
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
        <span className="text-sm font-medium">{viewLabels[currentView]}</span>
      </div>
      <div className="flex items-center gap-2">
        <ModeToggle />
        <Button
          className="h-9 rounded-lg px-4"
          onClick={() => setLogProblemOpen(true)}
        >
          <PlusIcon />
          Log Problem
        </Button>
      </div>
      {logProblemOpen || pendingProblem || selectedProblem ? (
        <React.Suspense fallback={null}>
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
        </React.Suspense>
      ) : null}
    </header>
  )
}
