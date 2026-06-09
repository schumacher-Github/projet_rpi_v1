import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  Building2,
  Users,
  Anchor,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth, ROLE_LABELS } from "@/hooks/use-auth";

const mainItems = [
  { title: "Tableau de bord", url: "/dashboard", icon: LayoutDashboard },
  { title: "Demandes", url: "/demandes", icon: ClipboardList },
  { title: "Nouvelle demande", url: "/demandes/nouvelle", icon: PlusCircle },
];

const adminItems = [
  { title: "Infrastructures", url: "/infrastructures", icon: Building2 },
  { title: "Utilisateurs", url: "/utilisateurs", icon: Users },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { profile, roles, hasAnyRole } = useAuth();

  const canManage = hasAnyRole(["admin", "chef_service"]);
  const isActive = (p: string) =>
    p === "/dashboard" ? pathname === p : pathname.startsWith(p);
  const primaryRole = roles[0];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="h-9 w-9 rounded-md bg-sidebar-primary flex items-center justify-center shrink-0">
            <Anchor className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-semibold text-sidebar-foreground leading-tight">
                RPI-PAD
              </div>
              <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/70 truncate">
                Port Autonome de Douala
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {canManage && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {!collapsed && profile && (
        <SidebarFooter className="border-t border-sidebar-border">
          <div className="px-2 py-2">
            <div className="text-sm font-medium text-sidebar-foreground truncate">
              {profile.prenom} {profile.nom}
            </div>
            <div className="text-xs text-sidebar-foreground/70 truncate">
              {primaryRole ? ROLE_LABELS[primaryRole] : "—"}
            </div>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
