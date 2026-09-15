import { useState, useEffect } from "react";
import {
  LayoutDashboard, LogOut, Shield, MapPin, Heart, FolderKanban,
  DollarSign, ClipboardList, Package, FileText, Settings, Wrench, UserCircle, Wand2, Image, Users,
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
import { useStudioBridge, useStudioAlerts } from "@/hooks/useStudioBridge";
import { StudioBridgeSidebar } from "@/components/trade/StudioBridgeSidebar";
import { pushRecentProject, useProjects } from "@/hooks/useProjects";


type NavItem = { title: string; url: string; icon: React.ElementType; end?: boolean };

const topItems: NavItem[] = [
  { title: "Dashboard", url: "/trade", icon: LayoutDashboard, end: true },
  { title: "My Dashboard", url: "/trade/me", icon: UserCircle },
  { title: "THE COLLECTION", url: "/trade/the-collection", icon: MapPin },
  { title: "Favorites", url: "/trade/favorites", icon: Heart },
  { title: "QUOTES & PROFORMAS", url: "/trade/quotes", icon: FileText },
  { title: "Tools", url: "/trade/tools", icon: Wrench },
  { title: "Settings", url: "/trade/settings", icon: Settings },
];

const projectItems: NavItem[] = [
  { title: "Projects", url: "/trade/projects", icon: FolderKanban },
  { title: "Clients", url: "/trade/client-management", icon: Users },
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
  // Mobile → desktop bridge: surfaced on Projects now that folders live there.
  const [bridgeOpen, setBridgeOpen] = useState(false);
  const { count: flaggedCount } = useStudioBridge();
  const { count: alertCount } = useStudioAlerts();
  const bridgeCount = flaggedCount + alertCount;
  const { projects: activeProjects } = useProjects({ activeOnly: true });
  const recentActiveProjects = activeProjects.slice(0, 2);


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
    <Sidebar collapsible="icon" className="trade-editorial-sidebar border-r border-border bg-background">
      <SidebarContent>
        {/* Brand */}
        <div className={`px-5 py-8 ${collapsed ? "px-2 py-5" : ""}`}>
          <NavLink to="/trade" className="block">
            {collapsed ? (
              <span className="font-display text-lg text-foreground block text-center">MA</span>
            ) : (
              <>
                <span className="font-display text-lg text-foreground block">Maison Affluency</span>
                <span className="font-body text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Trade Portal</span>
              </>
            )}
          </NavLink>
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {topItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild className="h-auto">
                    <NavLink
                      to={item.url}
                      end={item.end}
                      className="flex items-center gap-3 px-3 py-3 font-body text-xs text-muted-foreground hover:text-foreground transition-colors border-l border-transparent"
                      activeClassName="text-foreground font-medium border-foreground"
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
            {!collapsed && "PROJECTS & INTERVENTIONS"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {projectItems.map((item) => {
                const isProjects = item.url === "/trade/projects";
                const showDot = isProjects && bridgeCount > 0;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild className="h-auto">
                      <NavLink
                        to={item.url}
                        end={item.end}
                        className="flex items-center gap-3 px-3 py-3 font-body text-xs text-muted-foreground hover:text-foreground transition-colors border-l border-transparent"
                        activeClassName="text-foreground font-medium border-foreground"
                      >
                        <span className="relative shrink-0">
                          <item.icon className="h-4 w-4 shrink-0" />
                          {showDot && (
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label={`${bridgeCount} item${bridgeCount > 1 ? "s" : ""} flagged from mobile`}
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setBridgeOpen(true); }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setBridgeOpen(true); }
                              }}
                              className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-muted-foreground ring-2 ring-background cursor-pointer"
                            />
                          )}
                        </span>
                        {!collapsed && (
                          <span className="flex items-center gap-2">
                            <span>{item.title}</span>
                            {showDot && (
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setBridgeOpen(true); }}
                                className="inline-flex items-center text-muted-foreground text-[9px] font-normal leading-none"
                              >
                                {bridgeCount} from mobile
                              </button>
                            )}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                    {isProjects && !collapsed && recentActiveProjects.length > 0 && (
                      <ul
                        aria-label="Recent active project workspaces"
                        className="ml-10 mr-2 mt-0.5 mb-2 space-y-0.5 border-l border-border pl-3"
                      >
                        {recentActiveProjects.map((project) => (
                          <li key={project.id}>
                            <NavLink
                              to={`/trade/projects/${project.id}/studio`}
                              onClick={() => pushRecentProject(project.id)}
                              className="block py-1.5 font-body text-[10px] leading-relaxed text-muted-foreground transition-colors hover:text-foreground"
                              activeClassName="text-foreground"
                            >
                              {project.name}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </SidebarMenuItem>
                );
              })}
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
                      className="flex items-start gap-3 px-3 py-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
                      activeClassName="text-foreground font-medium"
                    >
                      <Shield className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="flex flex-col gap-1">
                          <span>Admin</span>
                          {(submittedQuotes > 0 || pendingApps > 0 || pendingSamples > 0) && (
                            <span className="flex flex-col gap-0.5">
                              {submittedQuotes > 0 && (
                                <span className="inline-flex items-center gap-1 text-muted-foreground text-[9px] font-normal leading-none">
                                  <DollarSign className="h-2.5 w-2.5" />
                                  {submittedQuotes} Quote{submittedQuotes > 1 ? 's' : ''}
                                </span>
                              )}
                              {pendingApps > 0 && (
                                <span className="inline-flex items-center gap-1 text-muted-foreground text-[9px] font-normal leading-none">
                                  <ClipboardList className="h-2.5 w-2.5" />
                                  {pendingApps} Application{pendingApps > 1 ? 's' : ''}
                                </span>
                              )}
                              {pendingSamples > 0 && (
                                <span className="inline-flex items-center gap-1 text-muted-foreground text-[9px] font-normal leading-none">
                                  <Package className="h-2.5 w-2.5" />
                                  {pendingSamples} Sample{pendingSamples > 1 ? 's' : ''}
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                      )}
                      {collapsed && totalBadge > 0 && (
                        <span className="absolute top-0 right-0 w-2 h-2 bg-muted-foreground" />
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a
                      href="/designers-hero-lock"
                      className="flex items-start gap-3 px-3 py-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Image className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Locked Layout Gallery</span>}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
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
          className="flex items-center gap-2 w-full px-3 py-2 font-body text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </SidebarFooter>
      <StudioBridgeSidebar open={bridgeOpen} onOpenChange={setBridgeOpen} />
    </Sidebar>
  );
}

