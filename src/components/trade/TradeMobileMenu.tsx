import { Fragment } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronRight, LogOut, Menu, X,
  LayoutDashboard, Heart, FolderArchive, FolderKanban, MapPin,
  FileText, Settings, Shield, Wrench,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

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

interface TradeMobileMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submittedCount?: number;
}

export function TradeMobileMenu({ open, onOpenChange }: TradeMobileMenuProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, signOut, profile } = useAuth();

  const isActive = (url: string, end?: boolean) =>
    end ? location.pathname === url : location.pathname.startsWith(url);

  const handleNav = (url: string) => {
    onOpenChange(false);
    setTimeout(() => navigate(url), 150);
  };

  const handleSignOut = async () => {
    onOpenChange(false);
    await signOut();
    navigate("/trade/login");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 md:hidden" aria-label="Toggle menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-full overflow-y-auto p-0" aria-describedby={undefined}>
        <div className="sr-only"><h2>Trade Portal Menu</h2></div>

        <div className="flex flex-col items-center pt-6 pb-4 border-b border-border/30 mb-2 px-6">
          <button onClick={() => handleNav("/trade")} className="group cursor-pointer">
            <span className="font-display text-base text-foreground tracking-wide block text-center">Maison Affluency</span>
            <span className="font-body text-[9px] text-muted-foreground uppercase tracking-[0.2em] block text-center">Trade Portal</span>
          </button>
        </div>

        <div className="flex flex-col px-6 pb-32">
          {coreItems.map((item, idx) => {
            const active = isActive(item.url, item.end);
            return (
              <button
                key={item.url}
                onClick={() => handleNav(item.url)}
                className={cn(
                  "font-body text-[15px] tracking-wide text-left transition-colors py-3 w-full flex items-center justify-between animate-fade-in opacity-0",
                  active ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
                style={{ animationDelay: `${idx * 50}ms`, animationFillMode: "forwards" }}
              >
                <span className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.title}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              </button>
            );
          })}

          {isAdmin && (
            <>
              <div className="border-t border-border/30 my-3" />
              <span className="font-body text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-1 mt-2">Admin</span>
              <button
                onClick={() => handleNav("/trade/admin-dashboard")}
                className={cn(
                  "font-body text-[15px] tracking-wide text-left transition-colors py-3 w-full flex items-center justify-between animate-fade-in opacity-0",
                  isActive("/trade/admin-dashboard") ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
                style={{ animationDelay: `${(coreItems.length + 1) * 50}ms`, animationFillMode: "forwards" }}
              >
                <span className="flex items-center gap-3">
                  <Shield className="h-4 w-4 shrink-0" />
                  Admin Dashboard
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              </button>
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
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full py-3 font-body text-[15px] tracking-wide text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sign Out
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
