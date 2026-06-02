import * as React from "react"
import {
  BarChart3Icon,
  BookOpenIcon,
  CalendarDaysIcon,
  LayersIcon,
  LayoutGridIcon,
  ListChecksIcon,
  RepeatIcon,
  SettingsIcon,
  TargetIcon,
} from "lucide-react"

import { RodeoLogo } from "@/components/brand/rodeo-logo"
import { NavGroup, type NavItem } from "@/components/sidebar/nav-group"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar"
import { useAppStore } from "@/store/use-app-store"

const practiceItems: NavItem[] = [
  { title: "Focus", view: "focus", icon: TargetIcon },
  { title: "Dashboard", view: "dashboard", icon: LayoutGridIcon },
  { title: "Problems", view: "problems", icon: ListChecksIcon },
  { title: "Schedule", view: "schedule", icon: CalendarDaysIcon },
]

const footerItems: NavItem[] = [
  { title: "Settings", view: "settings", icon: SettingsIcon },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const reviewQueueCount = useAppStore((state) => state.reviewQueueCount)

  const toolItems: NavItem[] = [
    {
      title: "Review Queue",
      view: "review-queue",
      icon: RepeatIcon,
      badge: reviewQueueCount,
    },
    { title: "Tracks", view: "tracks", icon: LayersIcon },
    { title: "Library", view: "library", icon: BookOpenIcon },
    { title: "Analytics", view: "analytics", icon: BarChart3Icon },
  ]

  return (
    <Sidebar collapsible="offcanvas" className="border-none p-2" {...props}>
      <SidebarHeader className="p-2">
        <div className="flex items-center gap-3 px-1 py-1.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
            <RodeoLogo className="size-7" />
          </span>
          <span className="text-base font-semibold tracking-tight">Rodeo</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-4 pt-2">
        <NavGroup label="Practice" items={practiceItems} className="py-0" />
        <NavGroup label="Tools" items={toolItems} className="py-0" />
        <NavGroup items={footerItems} className="mt-auto py-0" />
      </SidebarContent>
    </Sidebar>
  )
}
