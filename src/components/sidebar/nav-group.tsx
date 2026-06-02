import { ChevronDownIcon, type LucideIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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

  const menu = (
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
  )

  if (!label) {
    return (
      <SidebarGroup className={className}>
        <SidebarGroupContent>{menu}</SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <Collapsible defaultOpen render={<SidebarGroup className={className} />}>
      <CollapsibleTrigger
        render={
          <SidebarGroupLabel className="h-8 gap-1 px-3 text-xs font-medium text-muted-foreground data-[panel-open]:[&>svg]:rotate-0 hover:text-sidebar-foreground [&>svg]:-rotate-90 [&>svg]:transition-transform" />
        }
      >
        {label}
        <ChevronDownIcon />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarGroupContent className="pt-1">{menu}</SidebarGroupContent>
      </CollapsibleContent>
    </Collapsible>
  )
}
