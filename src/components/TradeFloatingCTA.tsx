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
      <div className="relative flex items-center gap-4 bg-foreground/95 backdrop-blur-sm text-background px-5 py-3 rounded-full shadow-lg border border-accent/20 max-w-[90vw]">
        <p className="font-body text-xs sm:text-sm tracking-wide whitespace-nowrap">
          <span className="hidden sm:inline">Architect or Interior Designer? </span>
          <span className="sm:hidden">Architect or Designer? </span>
        </p>
        <Link
          to="/trade/register"
          className="shrink-0 px-4 py-1.5 bg-accent text-foreground font-body text-xs uppercase tracking-[0.15em] rounded-full hover:bg-accent/80 transition-colors whitespace-nowrap"
        >
          Join Our Trade Program
        </Link>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 p-1 rounded-full hover:bg-background/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default TradeFloatingCTA;
