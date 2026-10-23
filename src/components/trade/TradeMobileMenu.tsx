import { useAIGuideName } from "@/hooks/useAIGuideName";
import { Fragment, useEffect, useState } from "react";
import { useLocation, useNavigate } from "@/lib/router-compat";
import {
  ChevronRight, LogOut, Menu, X,
  LayoutDashboard, Heart, FolderKanban, MapPin,
  FileText, Settings, Shield, Wrench, UserCircle, Image, Users, Inbox, Sparkles,
  TrendingDown,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePendingInquiryCount } from "@/hooks/usePendingInquiryCount";
import { cn } from "@/lib/utils";
import { TRADE_SANDBOX_ONLY } from "@/lib/tradeSandboxOnly";
import { Scan } from "lucide-react";
import { useProjects, pushRecentProject } from "@/hooks/useProjects";
import { projectDefaultUrl, useProjectBoardTree } from "@/hooks/useProjectBoardTree";
import { SignOutConfirmDialog, useSignOutConfirmation } from "@/components/trade/SignOutConfirmDialog";

const coreItems = [
  { title: "Dashboard", url: "/trade", icon: LayoutDashboard, end: true },
  { title: "My Dashboard", url: "/trade/me", icon: UserCircle },
  { title: "The Collection", url: "/trade/the-collection", icon: MapPin },
  { title: "Full Catalogue", url: "/trade/gallery", icon: Image },
  { title: "Designers & Ateliers", url: "/trade/designers", icon: Users },
  { title: "Resources", url: "/trade/documents", icon: FolderKanban },
  { title: "Favorites", url: "/trade/favorites", icon: Heart },
  { title: "Trade Concierge (Powered by Felix)", url: "/trade/concierge", icon: Sparkles },
  { title: "AI Extension Sync", url: "/trade/extension-sync", icon: LayoutDashboard },
  { title: "Projects", url: "/trade/projects", icon: FolderKanban },
  { title: "Clients", url: "/trade/client-management", icon: Users },
  { title: "QUOTES & PROFORMAS", url: "/trade/quotes", icon: FileText },
  { title: "Tools", url: "/trade/tools", icon: Wrench },
  { title: "Settings", url: "/trade/settings", icon: Settings },
];

interface TradeMobileMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submittedCount?: number;
}

export function TradeMobileMenu({ open, onOpenChange }: TradeMobileMenuProps) {
  const guideName = useAIGuideName();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, isTradeUser, applicationStatus, signOut, profile } = useAuth();
  const pendingInquiryCount = usePendingInquiryCount();
  const { projects: activeProjects } = useProjects({ activeOnly: true });
  const projectBoards = useProjectBoardTree(activeProjects.map((project) => project.id));
  const [expandedProjects, setExpandedProjects] = useState<string[]>([]);
  useEffect(() => {
    const current = activeProjects.find((project) => location.pathname.startsWith(`/trade/projects/${project.id}`) || projectBoards.some((board) => location.pathname === `/trade/boards/${board.id}` && board.project_id === project.id));
    if (current) setExpandedProjects((ids) => ids.includes(current.id) ? ids : [...ids, current.id]);
  }, [location.pathname, activeProjects, projectBoards]);
  // Approved trade accounts and admins use the Curated Showroom dashboard only.
  const hasTradeAccess = isAdmin || isTradeUser || applicationStatus === "approved";
  const items = TRADE_SANDBOX_ONLY
    ? [{ title: "Visualiser Sandbox", url: "/trade/visualiser", icon: Scan }]
    : hasTradeAccess
    ? coreItems.filter((i) => i.url !== "/trade/me")
    : coreItems.filter((i) => i.url !== "/trade/concierge");

  const isActive = (url: string, end?: boolean) =>
    end ? location.pathname === url : location.pathname.startsWith(url);

  const handleNav = (url: string) => {
    onOpenChange(false);
    setTimeout(() => navigate(url), 150);
  };

  const {
    open: confirmOpen,
    setOpen: setConfirmOpen,
    requestSignOut,
  } = useSignOutConfirmation(() => onOpenChange(false));

  const confirmSignOut = async () => {
    await signOut();
    navigate("/trade/login");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-11 w-11 md:hidden" aria-label="Toggle menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-full h-dvh overflow-y-auto overscroll-contain p-0 motion-reduce:transition-none [&>button]:h-11 [&>button]:w-11" aria-describedby={undefined}>
        <SheetTitle className="sr-only">Trade Portal Menu</SheetTitle>

        <div className="flex flex-col items-center pt-6 pb-4 border-b border-border/30 mb-2 px-6">
          <Button variant="ghost" onClick={() => handleNav("/trade")} className="group cursor-pointer">
            <span className="font-display text-base text-foreground tracking-wide block text-center">Maison Affluency</span>
            <span className="font-body text-[9px] text-muted-foreground uppercase tracking-[0.2em] block text-center">Trade Portal</span>
          </Button>
        </div>

        <div className="flex flex-col px-6 pb-32">
          {items.map((item) => {
            const active = isActive(item.url, item.end);
            return (
              <Fragment key={item.url}>
              <Button variant="ghost"
                onClick={() => handleNav(item.url)}
                className={cn(
                  "font-body text-sm text-left transition-colors min-h-12 h-auto px-2 py-3 w-full grid grid-cols-[minmax(0,1fr)_auto] gap-2 whitespace-normal rounded-none",
                  active ? "bg-muted text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.title.replace(/\bFelix\b/g, guideName)}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              </Button>
              {item.url === "/trade/projects" && activeProjects.length > 0 && (
                <div className="ml-7 border-l border-border pl-3 pb-2 font-body text-xs text-muted-foreground">
                  {activeProjects.map((project) => {
                    const expanded = expandedProjects.includes(project.id);
                    return <div key={project.id}>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label={`${expanded ? "Collapse" : "Expand"} ${project.name}`} aria-expanded={expanded} onClick={() => setExpandedProjects((ids) => expanded ? ids.filter((id) => id !== project.id) : [...ids, project.id])}>
                          <ChevronRight className={`h-3 w-3 ${expanded ? "rotate-90" : ""}`} />
                        </Button>
                        <Button variant="ghost" className="h-11 min-w-0 flex-1 justify-start truncate text-xs font-normal" onClick={() => { pushRecentProject(project.id); handleNav(projectDefaultUrl(project.id, projectBoards)); }}>{project.name}</Button>
                      </div>
                      {expanded && <div className="ml-4 border-l border-border pl-4">
                        <Button variant="ghost" className="block h-11 w-full truncate text-left text-xs font-normal" onClick={() => handleNav(`/trade/projects/${project.id}?tab=boards`)}>Folders & Drafts</Button>
                        {projectBoards.filter((board) => board.project_id === project.id).map((board) => <Button key={board.id} variant="ghost" className="block h-11 w-full truncate pl-6 text-left text-xs font-normal" onClick={() => handleNav(`/trade/boards/${board.id}?project=${project.id}`)}>{board.title}</Button>)}
                        <Button variant="ghost" className="block h-11 w-full text-left text-xs font-normal" onClick={() => handleNav(`/trade/projects/${project.id}?tab=tearsheets`)}>Tearsheets</Button>
                        <Button variant="ghost" className="block h-11 w-full text-left text-xs font-normal" onClick={() => handleNav(`/trade/projects/${project.id}/studio`)}>Project Studio</Button>
                      </div>}
                    </div>;
                  })}
                </div>
              )}
              </Fragment>
            );
          })}

          {isAdmin && (
            <>
              <div className="border-t border-border/30 my-3" />
              <span className="font-body text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-1 mt-2">Admin</span>
              <Button variant="ghost"
                onClick={() => handleNav("/trade/admin-dashboard")}
                className={cn(
                  "font-body text-sm text-left transition-colors min-h-12 h-auto px-2 py-3 w-full grid grid-cols-[minmax(0,1fr)_auto] gap-2 whitespace-normal rounded-none",
                  isActive("/trade/admin-dashboard") ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Shield className="h-4 w-4 shrink-0" />
                  Admin Dashboard
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              </Button>
              <Button variant="ghost"
                onClick={() => handleNav("/trade/admin/inquiries")}
                className={cn(
                  "font-body text-sm text-left transition-colors min-h-12 h-auto px-2 py-3 w-full grid grid-cols-[minmax(0,1fr)_auto] gap-2 whitespace-normal rounded-none",
                  isActive("/trade/admin/inquiries") ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="relative">
                    <Inbox className="h-4 w-4 shrink-0" />
                    {pendingInquiryCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent animate-pulse ring-2 ring-background" />
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    Quote Requests
                    {pendingInquiryCount > 0 && (
                      <span
                        aria-label={`${pendingInquiryCount} pending quote request${pendingInquiryCount > 1 ? "s" : ""}`}
                        className="inline-flex h-5 min-w-[1.25rem] animate-pulse items-center justify-center rounded-full bg-accent px-1.5 font-mono text-[10px] leading-none text-white"
                      >
                        {pendingInquiryCount}
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              </Button>
              <Button variant="ghost"
                onClick={() => handleNav("/trade/admin/sales-funnel")}
                className={cn(
                  "font-body text-sm text-left transition-colors min-h-12 h-auto px-2 py-3 w-full grid grid-cols-[minmax(0,1fr)_auto] gap-2 whitespace-normal rounded-none",
                  isActive("/trade/admin/sales-funnel") ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <TrendingDown className="h-4 w-4 shrink-0" />
                  Sales Funnel
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              </Button>
              <a
                href="/designers-hero-lock"
                className={cn(
                  "font-body text-[15px] tracking-wide text-left transition-colors min-h-12 py-3 w-full flex items-center justify-between text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Image className="h-4 w-4 shrink-0" />
                  Locked Layout Gallery
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              </a>
            </>
          )}

          <div className="border-t border-border/30 mt-6 pt-4">
            {profile && (
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                  <span className="font-display text-[10px] text-muted-foreground">
                    {(profile.first_name?.[0] || "")}{(profile.last_name?.[0] || "")}
                  </span>
                </div>
                <p className="font-body text-sm text-muted-foreground">
                  {profile.first_name} {profile.last_name}
                </p>
              </div>
            )}
            <Button variant="ghost"
              onClick={requestSignOut}
              className="flex justify-start items-center gap-3 w-full min-h-12 py-3 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sign Out
            </Button>
          </div>
        </div>
      </SheetContent>
      <SignOutConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => void confirmSignOut()}
      />
    </Sheet>
  );
}
