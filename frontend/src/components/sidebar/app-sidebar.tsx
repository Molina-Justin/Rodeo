import * as React from "react"
import {
  LayoutGridIcon,
  ListChecksIcon,
  RepeatIcon,
  SettingsIcon,
} from "lucide-react"

import { RodeoLogo } from "@/components/brand/rodeo-logo"
import { NavGroup, type NavItem } from "@/components/sidebar/nav-group"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { dueReviewCount } from "@/lib/dashboard"
import { useAttempts } from "@/hooks/use-attempts"

const footerItems: NavItem[] = [
  { title: "Settings", view: "settings", icon: SettingsIcon },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const attemptsData = useAttempts().data
  const attempts = React.useMemo(() => attemptsData ?? [], [attemptsData])
  const reviewQueueCount = React.useMemo(
    () => dueReviewCount(attempts),
    [attempts]
  )

  const menuItems: NavItem[] = [
    { title: "Dashboard", view: "dashboard", icon: LayoutGridIcon },
    { title: "Problems", view: "problems", icon: ListChecksIcon },
    {
      title: "Review Queue",
      view: "review-queue",
      icon: RepeatIcon,
      badge: reviewQueueCount,
    },
  ]

  return (
    <Sidebar collapsible="offcanvas" className="border-none p-2" {...props}>
      <SidebarHeader className="p-2">
        <div className="flex items-center gap-3 px-1 py-1.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
            <RodeoLogo className="size-8" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Rodeo</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-4 pt-2">
        <NavGroup items={menuItems} className="py-0" />
        <SidebarSeparator className="mx-3 mt-auto" />
        <NavGroup items={footerItems} className="py-0" />
      </SidebarContent>
    </Sidebar>
  )
}
