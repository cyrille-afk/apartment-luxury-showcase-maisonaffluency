import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";


const DISMISS_KEY = "trade_cta_dismissed";

const TradeFloatingCTA = () => {
  const { user, loading, isTradeUser, isAdmin } = useAuth();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  const hasTradeAccess = isTradeUser || isAdmin;

  useEffect(() => {
    if (dismissed || loading || hasTradeAccess) return;
    const timer = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(timer);
  }, [dismissed, loading, user]);

  if (!visible || hasTradeAccess) return null;

  const dismiss = () => {
    setVisible(false);
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[100] hidden animate-in slide-in-from-bottom-4 fade-in duration-500 sm:block pointer-events-none"
      role="banner"
    >
      <div className="mx-auto max-w-7xl px-5 md:px-14 lg:px-24 relative h-0">
        <div className="absolute bottom-36 right-5 md:right-14 lg:right-24 pointer-events-auto">
          <div className="relative bg-foreground/95 backdrop-blur-sm text-background px-7 py-4 rounded-full shadow-lg border border-accent/20 max-w-[92vw]">
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="absolute -top-2.5 -right-2.5 p-2 rounded-full bg-foreground border border-background/20 hover:bg-foreground/80 transition-colors shadow-md z-10"
            >
              <X className="w-4 h-4 text-background" />
            </button>
            {/* Desktop: single row */}
            <div className="hidden sm:flex items-center gap-5">
              <p className="font-body text-sm uppercase tracking-[0.15em] whitespace-nowrap">
                Architect or Interior Designer?
              </p>
              <Link
                to="/trade-program"
                className="shrink-0 px-5 py-2.5 bg-accent text-black font-body text-sm font-semibold uppercase tracking-[0.15em] rounded-full border border-black/15 shadow-sm hover:bg-accent/90 hover:-translate-y-0.5 hover:shadow-md transition-all whitespace-nowrap"
              >
                Join Our Trade Program
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradeFloatingCTA;
