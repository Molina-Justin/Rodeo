import { LayoutGridIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useAppStore } from "@/store/use-app-store"
import type { DashboardTab } from "@/types"

const tabCopy: Record<DashboardTab, { title: string; description: string }> = {
  overview: {
    title: "Nothing here yet",
    description:
      "Log a practice session and your streak, mastery, and next-up queue will show up here.",
  },
  sessions: {
    title: "No sessions logged",
    description: "Every attempt you record will appear in this list.",
  },
  progress: {
    title: "No progress to chart",
    description: "Mastery scores render here once you have a few attempts.",
  },
  roadmap: {
    title: "Roadmap not generated",
    description: "The spaced-repetition schedule builds itself from your logs.",
  },
}

export function DashboardPlaceholder() {
  const activeDashboardTab = useAppStore((state) => state.activeDashboardTab)
  const copy = tabCopy[activeDashboardTab]

  return (
    <Empty className="min-h-96 border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LayoutGridIcon />
        </EmptyMedia>
        <EmptyTitle>{copy.title}</EmptyTitle>
        <EmptyDescription>{copy.description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" className="rounded-lg">
          <PlusIcon />
          Log Session
        </Button>
      </EmptyContent>
    </Empty>
  )
}
