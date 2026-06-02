import { type LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useAppStore } from "@/store/use-app-store"
import type { NavView } from "@/types"

export interface NavItem {
  title: string
  view: NavView
  icon: LucideIcon
  badge?: number
}

interface NavGroupProps {
  items: NavItem[]
  label?: string
  className?: string
}

export function NavGroup({ items, label, className }: NavGroupProps) {
  const currentView = useAppStore((state) => state.currentView)
  const setCurrentView = useAppStore((state) => state.setCurrentView)

  return (
    <SidebarGroup className={className}>
      {label ? (
        <SidebarGroupLabel className="h-8 px-3 text-xs font-medium text-muted-foreground">
          {label}
        </SidebarGroupLabel>
      ) : null}
      <SidebarGroupContent className={label ? "pt-1" : undefined}>
        <SidebarMenu className="gap-1">
          {items.map((item) => (
            <SidebarMenuItem key={item.view}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={currentView === item.view}
                onClick={() => setCurrentView(item.view)}
                className="h-10 gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/80 data-active:bg-background data-active:font-medium data-active:text-sidebar-foreground data-active:shadow-xs data-active:ring-1 data-active:ring-sidebar-border [&>svg]:size-4.5 [&>svg]:text-muted-foreground data-active:[&>svg]:text-sidebar-foreground"
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
              {item.badge ? (
                <SidebarMenuBadge className="top-2.5 right-3 bg-destructive/10 font-medium text-destructive">
                  {item.badge}
                </SidebarMenuBadge>
              ) : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
