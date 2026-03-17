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
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-500"
      role="banner"
    >
      <div className="relative bg-foreground/95 backdrop-blur-sm text-background px-5 py-3 rounded-full shadow-lg border border-accent/20 max-w-[90vw]">
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute -top-2 -right-2 p-1.5 rounded-full bg-foreground border border-background/20 hover:bg-foreground/80 transition-colors shadow-md z-10"
        >
          <X className="w-3.5 h-3.5 text-background" />
        </button>
        {/* Desktop: single row */}
        <div className="hidden sm:flex items-center gap-4">
          <p className="font-body text-xs tracking-wide whitespace-nowrap">
            Architect or Interior Designer?
          </p>
          <Link
            to="/trade/program"
            className="shrink-0 px-4 py-1.5 bg-accent text-foreground font-body text-xs uppercase tracking-[0.15em] rounded-full hover:bg-accent/80 transition-colors whitespace-nowrap"
          >
            Join Our Trade Program
          </Link>
        </div>
        {/* Mobile: stacked */}
        <div className="flex sm:hidden flex-col items-center gap-1.5 text-center">
          <p className="font-body text-[11px] uppercase tracking-[0.15em] text-background/80">
            Architect or Interior Designer?
          </p>
          <Link
            to="/trade/program"
            className="px-4 py-1.5 bg-accent text-foreground font-body text-[11px] uppercase tracking-[0.15em] rounded-full hover:bg-accent/80 transition-colors whitespace-nowrap"
          >
            Join Our Trade Program
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TradeFloatingCTA;
