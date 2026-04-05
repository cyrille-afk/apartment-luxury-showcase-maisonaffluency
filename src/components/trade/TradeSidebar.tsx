import { useState, useEffect } from "react";
import { LayoutDashboard, Image, FileText, FolderOpen, Settings, LogOut, Shield, MapPin, Heart, Package, Box, FolderArchive, AlertCircle, Users, DollarSign, ClipboardList } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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

const browseItems = [
  { title: "Dashboard", url: "/trade", icon: LayoutDashboard },
  { title: "Showroom", url: "/trade/showroom", icon: MapPin },
];

const collectionItems = [
  { title: "Favorites", url: "/trade/favorites", icon: Heart },
  { title: "Project Folders", url: "/trade/boards", icon: FolderArchive },
];

const toolItems = [
  { title: "Gallery", url: "/trade/gallery", icon: Image },
  { title: "Designers & Ateliers Library", url: "/trade/designers", icon: Users },
  { title: "Resources", url: "/trade/documents", icon: FolderOpen },
  { title: "Sample Requests", url: "/trade/samples", icon: Package },
  { title: "Quote Builder", url: "/trade/quotes", icon: FileText },
  { title: "3D Studio", url: "/trade/axonometric-requests", icon: Box },
  { title: "Settings", url: "/trade/settings", icon: Settings },
];

export function TradeSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin, signOut, profile, user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [submittedQuotes, setSubmittedQuotes] = useState(0);
  const [pendingApps, setPendingApps] = useState(0);
  const [pendingSamples, setPendingSamples] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("avatar_url").eq("id", user.id).single()
      .then(({ data }) => { if ((data as any)?.avatar_url) setAvatarUrl((data as any).avatar_url); });
  }, [user]);

  // Fetch counts for admin badges
  useEffect(() => {
    if (!isAdmin) return;
    const fetchCounts = async () => {
      const [quotes, apps, samples] = await Promise.all([
        supabase.from("trade_quotes").select("*", { count: "exact", head: true }).eq("status", "submitted"),
        supabase.from("trade_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("trade_sample_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      setSubmittedQuotes(quotes.count || 0);
      setPendingApps(apps.count || 0);
      setPendingSamples(samples.count || 0);
    };
    fetchCounts();

    const channel = supabase
      .channel("admin-badges")
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_quotes" }, () => fetchCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_applications" }, () => fetchCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_sample_requests" }, () => fetchCounts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);

  const totalBadge = submittedQuotes + pendingApps + pendingSamples;

  const handleSignOut = async () => {
    await signOut();
    navigate("/trade/login");
  };

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
              {browseItems.map((item) => (
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            {!collapsed && "My Collections"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {collectionItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2 rounded-md font-body text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                      activeClassName="bg-muted text-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            {!collapsed && "Tools"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2 rounded-md font-body text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                      activeClassName="bg-muted text-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              {!collapsed && "Admin"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/trade/admin-dashboard"
                      className="flex items-center gap-3 px-3 py-2 rounded-md font-body text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                      activeClassName="bg-muted text-foreground font-medium"
                    >
                      <Shield className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="flex items-center gap-2 flex-wrap">
                          Admin
                          {submittedQuotes > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive text-[9px] font-medium leading-none" title={`${submittedQuotes} pending quote${submittedQuotes > 1 ? 's' : ''}`}>
                              <DollarSign className="h-2.5 w-2.5" />
                              {submittedQuotes}
                            </span>
                          )}
                          {pendingApps > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-warning/15 text-warning text-[9px] font-medium leading-none" title={`${pendingApps} pending application${pendingApps > 1 ? 's' : ''}`}>
                              <ClipboardList className="h-2.5 w-2.5" />
                              {pendingApps}
                            </span>
                          )}
                          {pendingSamples > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-medium leading-none" title={`${pendingSamples} pending sample${pendingSamples > 1 ? 's' : ''}`}>
                              <Package className="h-2.5 w-2.5" />
                              {pendingSamples}
                            </span>
                          )}
                        </span>
                      )}
                      {collapsed && totalBadge > 0 && (
                        <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-destructive" />
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-3">
        {profile && (
          <div className={`flex items-center gap-2.5 mb-2 ${collapsed ? "justify-center" : ""}`}>
            <div className="w-8 h-8 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-display text-[10px] text-muted-foreground">
                  {(profile.first_name?.[0] || "")}{(profile.last_name?.[0] || "")}
                </span>
              )}
            </div>
            {!collapsed && (
              <p className="font-body text-xs text-muted-foreground truncate">
                {profile.first_name} {profile.last_name}
              </p>
            )}
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md font-body text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors min-h-[44px]"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
