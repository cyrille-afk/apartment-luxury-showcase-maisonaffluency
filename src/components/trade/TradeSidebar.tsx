import { LayoutDashboard, Image, FileText, FolderOpen, Settings, LogOut, Shield, MapPin } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/trade", icon: LayoutDashboard },
  { title: "Showroom", url: "/trade/showroom", icon: MapPin },
  { title: "Website Products", url: "/trade/gallery", icon: Image },
  { title: "Quote Builder", url: "/trade/quotes", icon: FileText },
  { title: "Documents", url: "/trade/documents", icon: FolderOpen },
  { title: "Settings", url: "/trade/settings", icon: Settings },
];

export function TradeSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isAdmin, signOut, profile } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent>
        {/* Brand */}
        <div className={`px-4 py-6 ${collapsed ? "px-2 py-4" : ""}`}>
          <NavLink to="/trade" className="block">
            {collapsed ? (
              <span className="font-display text-lg text-foreground block text-center">MA</span>
            ) : (
              <>
                <span className="font-display text-base text-foreground tracking-wide block">Maison Affluency</span>
                <span className="font-body text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Trade Portal</span>
              </>
            )}
          </NavLink>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            {!collapsed && "Navigation"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/trade"}
                      className="flex items-center gap-3 px-3 py-2 rounded-md font-body text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                      activeClassName="bg-muted text-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/trade/admin"
                      className="flex items-center gap-3 px-3 py-2 rounded-md font-body text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                      activeClassName="bg-muted text-foreground font-medium"
                    >
                      <Shield className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Admin</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-3">
        {!collapsed && profile && (
          <p className="font-body text-xs text-muted-foreground mb-2 truncate">
            {profile.first_name} {profile.last_name}
          </p>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md font-body text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
