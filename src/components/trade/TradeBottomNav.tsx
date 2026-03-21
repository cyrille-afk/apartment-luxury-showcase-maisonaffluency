import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, MapPin, Heart, FileText, Image } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "/trade", label: "Home", icon: LayoutDashboard, end: true },
  { id: "/trade/showroom", label: "Showroom", icon: MapPin },
  { id: "/trade/favorites", label: "Favorites", icon: Heart },
  { id: "/trade/gallery", label: "Gallery", icon: Image },
  { id: "/trade/quotes", label: "Quotes", icon: FileText },
];

const TradeBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Hide on scroll down, show on scroll up
  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      setIsVisible(currentY < lastScrollY || currentY < 100);
      setLastScrollY(currentY);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [lastScrollY]);

  const isActive = (url: string, end?: boolean) =>
    end ? location.pathname === url : location.pathname.startsWith(url);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.nav
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed bottom-0 left-0 right-0 z-40 md:hidden print:hidden"
          aria-label="Trade navigation"
        >
          <div className="bg-card/95 backdrop-blur-xl border-t border-border/30 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
            <div className="flex items-center justify-around px-1 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {navItems.map(({ id, label, icon: Icon, end }) => {
                const active = isActive(id, end);
                return (
                  <button
                    key={id}
                    onClick={() => navigate(id)}
                    className={cn(
                      "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors duration-200 touch-manipulation min-w-[3.5rem] relative",
                      active
                        ? "text-primary"
                        : "text-muted-foreground active:text-foreground"
                    )}
                    aria-label={`Go to ${label}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4" strokeWidth={active ? 2.5 : 1.5} />
                    <span className={cn("text-[10px] leading-tight font-body", active && "font-medium")}>
                      {label}
                    </span>
                    {active && (
                      <motion.div
                        layoutId="tradeActiveTab"
                        className="absolute -bottom-0.5 w-5 h-0.5 rounded-full bg-primary"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                  </button>
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
