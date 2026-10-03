import { useState, useEffect, useCallback } from "react";
import { useRealtimeTables } from "@/contexts/RealtimeMultiplexerContext";
import {
  LayoutDashboard, LogOut, Shield, MapPin, Heart, FolderKanban,
  DollarSign, ClipboardList, Package, FileText, Settings, Wrench, UserCircle, Wand2, Image, Users, Inbox, Sparkles,
  TrendingDown, Lock, Wallet, Activity, ShieldCheck, Target, BarChart3, ChevronDown, ChevronRight, FolderOpen,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useStudioBridge, useStudioAlerts } from "@/hooks/useStudioBridge";
import { useStudio } from "@/hooks/useStudio";
import { StudioBridgeSidebar } from "@/components/trade/StudioBridgeSidebar";
import { pushRecentProject, useProjects } from "@/hooks/useProjects";
import { projectDefaultUrl, useProjectBoardTree } from "@/hooks/useProjectBoardTree";
import { Button } from "@/components/ui/button";
import { useClientTierUpgrades } from "@/hooks/useClientTierUpgrades";
import { usePendingInquiryCount } from "@/hooks/usePendingInquiryCount";


type NavItem = { title: string; url: string; icon: React.ElementType; end?: boolean };

const topItems: NavItem[] = [
  { title: "Dashboard", url: "/trade", icon: LayoutDashboard, end: true },
  { title: "My Dashboard", url: "/trade/me", icon: UserCircle },
  { title: "THE COLLECTION", url: "/trade/the-collection", icon: MapPin },
  { title: "Favorites", url: "/trade/favorites", icon: Heart },
  { title: "Trade Concierge (Powered by Felix)", url: "/trade/concierge", icon: Sparkles },
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
  const location = useLocation();
  const { isAdmin, isTradeUser, applicationStatus, signOut, profile, user } = useAuth();
  // Approved trade accounts and admins use the Curated Showroom dashboard only.
  const hasTradeAccess = isAdmin || isTradeUser || applicationStatus === "approved";
  const visibleTopItems = hasTradeAccess
    ? topItems.filter((i) => i.url !== "/trade/me")
    : topItems.filter((i) => i.url !== "/trade/concierge");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [submittedQuotes, setSubmittedQuotes] = useState(0);
  const [pendingApps, setPendingApps] = useState(0);
  const [pendingSamples, setPendingSamples] = useState(0);
  // Mobile → desktop bridge: surfaced on Projects now that folders live there.
  const [bridgeOpen, setBridgeOpen] = useState(false);
  const { count: flaggedCount } = useStudioBridge();
  const { count: alertCount } = useStudioAlerts();
  const bridgeCount = flaggedCount + alertCount;
  const { currentStudio } = useStudio();
  const { count: clientUpgradeCount } = useClientTierUpgrades(currentStudio?.id);
  const { projects: activeProjects } = useProjects({ activeOnly: true });
  const boards = useProjectBoardTree(activeProjects.map((project) => project.id));
  const [expandedProjects, setExpandedProjects] = useState<string[]>([]);
  const currentBoard = location.pathname.match(/^\/trade\/boards\/([^/]+)/)?.[1];
  const currentProject = activeProjects.find((project) => location.pathname.startsWith(`/trade/projects/${project.id}`) || boards.some((board) => board.id === currentBoard && board.project_id === project.id));
  useEffect(() => {
    if (currentProject) setExpandedProjects((ids) => ids.includes(currentProject.id) ? ids : [...ids, currentProject.id]);
  }, [currentProject?.id]);
  const pendingInquiryCount = usePendingInquiryCount();


  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("avatar_url").eq("id", user.id).single()
      .then(({ data }) => { if ((data as any)?.avatar_url) setAvatarUrl((data as any).avatar_url); });
  }, [user]);

  const fetchCounts = useCallback(async () => {
    if (!isAdmin) return;
    const [quotes, apps, samples] = await Promise.all([
      supabase.from("trade_quotes").select("id", { count: "exact", head: true }).eq("status", "submitted"),
      supabase.from("trade_accounts").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
      supabase.from("trade_sample_requests").select("id", { count: "exact", head: true }).eq("status", "requested"),
    ]);
    setSubmittedQuotes(quotes.count || 0);
    setPendingApps(apps.count || 0);
    setPendingSamples(samples.count || 0);
  }, [isAdmin]);

  useEffect(() => {
    void fetchCounts();
  }, [fetchCounts]);

  useRealtimeTables(
    ["trade_quotes", "trade_accounts", "trade_sample_requests"],
    () => void fetchCounts(),
    isAdmin,
  );

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
              {visibleTopItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild className="h-auto">
                    <NavLink
                      to={item.url}
                      end={item.end}
                      data-felix-target={
                        item.url === "/trade/the-collection"
                          ? "nav-collection"
                          : item.url === "/trade/quotes"
                            ? "nav-quotes"
                            : item.url === "/trade/tools"
                              ? "nav-tools"
                            : item.url === "/trade/settings"
                                 ? "nav-settings"
                                 : item.url === "/trade/concierge"
                                   ? "nav-concierge"
                                   : undefined
                      }
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

        <SidebarGroup data-felix-target="nav-projects">
          <SidebarGroupLabel className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            {!collapsed && "PROJECTS & INTERVENTIONS"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {projectItems.map((item) => {
                const isProjects = item.url === "/trade/projects";
                const showDot = isProjects && bridgeCount > 0;
                const isClients = item.url === "/trade/client-management";
                const showUpgrades = isClients && clientUpgradeCount > 0;
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
                          {showUpgrades && collapsed && (
                            <span
                              aria-hidden="true"
                              className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-accent ring-2 ring-background"
                            />
                          )}
                        </span>
                        {!collapsed && (
                          <span className="flex items-center gap-2">
                            <span>{item.title}</span>
                            {showUpgrades && (
                              <span
                                aria-label={`${clientUpgradeCount} client${clientUpgradeCount > 1 ? "s" : ""} eligible for a tier upgrade`}
                                title={`${clientUpgradeCount} client${clientUpgradeCount > 1 ? "s" : ""} eligible for a tier upgrade`}
                                className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full border border-accent/40 bg-accent/10 px-1 font-mono text-[9px] leading-none text-accent"
                              >
                                {clientUpgradeCount}
                              </span>
                            )}
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
                     {isProjects && !collapsed && activeProjects.length > 0 && (
                      <ul
                         aria-label="Active project workspaces"
                         className="ml-8 mr-2 mt-0.5 mb-2 space-y-0.5 border-l border-border pl-2"
                      >
                         {activeProjects.map((project) => {
                           const expanded = expandedProjects.includes(project.id);
                           const projectBoards = boards.filter((board) => board.project_id === project.id);
                           return (
                             <li key={project.id}>
                               <div className="flex min-w-0 items-center">
                                 <Button type="button" variant="ghost" size="icon" className="h-7 w-6 shrink-0" aria-label={`${expanded ? "Collapse" : "Expand"} ${project.name}`} aria-expanded={expanded} onClick={() => setExpandedProjects((ids) => expanded ? ids.filter((id) => id !== project.id) : [...ids, project.id])}>
                                   {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                 </Button>
                                 <NavLink to={projectDefaultUrl(project.id, boards)} onClick={() => { pushRecentProject(project.id); setExpandedProjects((ids) => ids.includes(project.id) ? ids : [...ids, project.id]); }} className="block min-w-0 truncate py-1.5 font-body text-[11px] text-muted-foreground transition-colors hover:text-foreground" activeClassName="text-foreground font-medium" title={project.name}>{project.name}</NavLink>
                               </div>
                               {expanded && (
                                 <ul className="ml-4 border-l border-border/70 pl-3 font-body text-[10px] text-muted-foreground">
                                   <li><NavLink to={`/trade/projects/${project.id}?tab=boards`} className="flex items-center gap-2 py-1.5 hover:text-foreground"><FolderOpen className="h-3 w-3 shrink-0" /> Folders & Drafts</NavLink></li>
                                   {projectBoards.map((board) => <li key={board.id} className="ml-2 border-l border-border/60 pl-3"><NavLink to={`/trade/boards/${board.id}?project=${project.id}`} className="block truncate py-1.5 hover:text-foreground" activeClassName="text-foreground font-medium" title={board.title}>{board.title}</NavLink></li>)}
                                   <li><NavLink to={`/trade/projects/${project.id}?tab=tearsheets`} className="block py-1.5 hover:text-foreground">Tearsheets</NavLink></li>
                                   <li><NavLink to={`/trade/projects/${project.id}/studio`} className="block py-1.5 hover:text-foreground">Project Studio</NavLink></li>
                                 </ul>
                               )}
                             </li>
                           );
                         })}
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
                    <NavLink
                      to="/trade/admin/inquiries"
                      className="flex items-start gap-3 px-3 py-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
                      activeClassName="text-foreground font-medium"
                    >
                      <span className="relative shrink-0">
                        <Inbox className="h-4 w-4 shrink-0" />
                        {collapsed && pendingInquiryCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent animate-pulse ring-2 ring-background" />
                        )}
                      </span>
                      {!collapsed && (
                        <span className="flex items-center gap-2">
                          <span>Quote Requests</span>
                          {pendingInquiryCount > 0 && (
                            <span
                              aria-label={`${pendingInquiryCount} pending quote request${pendingInquiryCount > 1 ? "s" : ""}`}
                              className="relative inline-flex h-4 min-w-[1rem] animate-pulse items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] leading-none text-white"
                            >
                              {pendingInquiryCount}
                            </span>
                          )}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/trade/admin/sales-funnel"
                      className="flex items-start gap-3 px-3 py-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
                      activeClassName="text-foreground font-medium"
                    >
                      <TrendingDown className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Sales Funnel</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/trade/admin/procurement-ledger"
                      className="flex items-start gap-3 px-3 py-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
                      activeClassName="text-foreground font-medium"
                    >
                      <Wallet className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Procurement Ledger</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/trade/admin/payment-settings"
                      className="flex items-start gap-3 px-3 py-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
                      activeClassName="text-foreground font-medium"
                    >
                      <Lock className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Payment Settings</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/trade/admin/queue"
                      className="flex items-start gap-3 px-3 py-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
                      activeClassName="text-foreground font-medium"
                    >
                      <Activity className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Event Queue</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/trade/admin/trade-applications"
                      className="flex items-start gap-3 px-3 py-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
                      activeClassName="text-foreground font-medium"
                    >
                      <Inbox className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Inbound Applications</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/trade/admin/client-acquisitions"
                      className="flex items-start gap-3 px-3 py-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
                      activeClassName="text-foreground font-medium"
                    >
                      <Target className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Client Acquisitions</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/trade/admin/kpi-ledger"
                      className="flex items-start gap-3 px-3 py-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
                      activeClassName="text-foreground font-medium"
                    >
                      <BarChart3 className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Acquisition KPI Ledger</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/trade/admin/compliance/sub-processors"
                      className="flex items-start gap-3 px-3 py-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
                      activeClassName="text-foreground font-medium"
                    >
                      <ShieldCheck className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Sub-processors</span>}
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

