import { useLocation, useNavigate } from "@/lib/router-compat";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, MapPin, Heart, FileText, FolderOpen, Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TRADE_SANDBOX_ONLY } from "@/lib/tradeSandboxOnly";

const fullNavItems = [
  { id: "/trade", label: "Home", icon: LayoutDashboard, end: true },
  { id: "/trade/the-collection", label: "Collection", icon: MapPin },
  { id: "/trade/projects", label: "Projects", icon: FolderOpen },
  { id: "/trade/favorites", label: "Favorites", icon: Heart },
  { id: "/trade/quotes", label: "Quotes", icon: FileText },
];

const navItems = TRADE_SANDBOX_ONLY
  ? [{ id: "/trade/visualiser", label: "Visualiser", icon: Scan }]
  : fullNavItems;

const TradeBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (url: string, end?: boolean) =>
    end ? location.pathname === url : location.pathname.startsWith(url);

  return (
    <AnimatePresence>
      {(
        <motion.nav
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed bottom-0 left-0 right-0 z-40 md:hidden print:hidden"
          aria-label="Trade navigation"
        >
          <div className="bg-card border-t border-border">
            <div className={`grid ${TRADE_SANDBOX_ONLY ? "grid-cols-1" : "grid-cols-5"} px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]`}>
              {navItems.map(({ id, label, icon: Icon, end }) => {
                const active = isActive(id, end);
                return (
                   <Button
                    type="button"
                    variant="ghost"
                    key={id}
                    onClick={() => navigate(id)}
                    className={cn(
                      "h-12 min-w-0 flex flex-col items-center justify-center gap-1 px-1 py-1.5 rounded-none transition-colors duration-200 touch-manipulation relative",
                      active
                        ? "text-primary"
                        : "text-muted-foreground active:text-foreground"
                    )}
                    aria-label={`Go to ${label}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4" strokeWidth={active ? 2.5 : 1.5} />
                    <span className={cn("text-[11px] leading-tight font-body", active && "font-medium")}>
                      {label}
                    </span>
                    {active && (
                      <motion.div
                        layoutId="tradeActiveTab"
                        className="absolute -bottom-0.5 w-5 h-px bg-foreground"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
};

export default TradeBottomNav;
