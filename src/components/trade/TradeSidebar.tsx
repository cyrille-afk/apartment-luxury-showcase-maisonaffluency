import { useState, useEffect } from "react";
import {
  LayoutDashboard, LogOut, Shield, MapPin, Heart, FolderArchive, FolderKanban,
  DollarSign, ClipboardList, Package, FileText, Settings, Wrench,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const coreItems = [
  { title: "Dashboard", url: "/trade", icon: LayoutDashboard, end: true },
  { title: "Showroom", url: "/trade/showroom", icon: MapPin },
  { title: "Favorites", url: "/trade/favorites", icon: Heart },
  { title: "Projects", url: "/trade/projects", icon: FolderKanban },
  { title: "Project Folders", url: "/trade/boards", icon: FolderArchive },
  { title: "Quotes", url: "/trade/quotes", icon: FileText },
  { title: "Tools", url: "/trade/tools", icon: Wrench },
  { title: "Settings", url: "/trade/settings", icon: Settings },
];

export function TradeSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { isAdmin, signOut, profile, user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [submittedQuotes, setSubmittedQuotes] = useState(0);
  const [pendingApps, setPendingApps] = useState(0);
  const [pendingSamples, setPendingSamples] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("avatar_url").eq("id", user.id).single()
      .then(({ data }) => { if ((data as any)?.avatar_url) setAvatarUrl((data as any).avatar_url); });
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchCounts = async () => {
      const [quotes, apps, samples] = await Promise.all([
        supabase.from("trade_quotes").select("*", { count: "exact", head: true }).eq("status", "submitted"),
        supabase.from("trade_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("trade_sample_requests").select("*", { count: "exact", head: true }).eq("status", "requested"),
      ]);
      setSubmittedQuotes(quotes.count || 0);
      setPendingApps(apps.count || 0);
      setPendingSamples(samples.count || 0);
    };
    fetchCounts();
    const channel = supabase
      .channel("admin-badges")
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_quotes", filter: "status=eq.submitted" }, () => fetchCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_applications", filter: "status=eq.pending" }, () => fetchCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_sample_requests", filter: "status=eq.requested" }, () => fetchCounts())
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
          <SidebarGroupContent>
            <SidebarMenu>
              {coreItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.end}
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
                  <SidebarMenuButton asChild className="h-auto min-h-[36px]">
                    <NavLink
                      to="/trade/admin-dashboard"
                      className="flex items-start gap-3 px-3 py-2 rounded-md font-body text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                      activeClassName="bg-muted text-foreground font-medium"
                    >
                      <Shield className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="flex flex-col gap-1">
                          <span>Admin</span>
                          {(submittedQuotes > 0 || pendingApps > 0 || pendingSamples > 0) && (
                            <span className="flex flex-col gap-0.5">
                              {submittedQuotes > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive text-[9px] font-medium leading-none">
                                  <DollarSign className="h-2.5 w-2.5" />
                                  {submittedQuotes} Quote{submittedQuotes > 1 ? 's' : ''}
                                </span>
                              )}
                              {pendingApps > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-warning/15 text-warning text-[9px] font-medium leading-none">
                                  <ClipboardList className="h-2.5 w-2.5" />
                                  {pendingApps} Application{pendingApps > 1 ? 's' : ''}
                                </span>
                              )}
                              {pendingSamples > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-medium leading-none">
                                  <Package className="h-2.5 w-2.5" />
                                  {pendingSamples} Sample{pendingSamples > 1 ? 's' : ''}
                                </span>
                              )}
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
