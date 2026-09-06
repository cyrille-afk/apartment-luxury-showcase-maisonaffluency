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
        <div className="absolute bottom-24 right-5 md:right-14 lg:right-24 pointer-events-auto">
          <div className="relative max-w-[92vw] rounded-full border border-trade-banner-line/75 bg-trade-banner px-7 py-4 text-trade-banner-line shadow-lg">
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="absolute -right-2.5 -top-2.5 z-10 rounded-full border border-trade-banner-line/75 bg-trade-banner p-2 shadow-md transition-opacity hover:opacity-80"
            >
              <X className="h-4 w-4 text-trade-banner-line" />
            </button>
            {/* Desktop: single row */}
            <div className="hidden sm:flex items-center gap-5">
              <p className="font-body text-sm uppercase tracking-[0.15em] whitespace-nowrap">
                Architect or Interior Designer?
              </p>
              <Link
                to="/trade-program"
                className="shrink-0 whitespace-nowrap rounded-full border border-trade-banner-line bg-trade-banner-line px-5 py-2.5 font-body text-sm font-normal uppercase tracking-[0.15em] text-trade-banner shadow-sm transition-all hover:-translate-y-0.5 hover:opacity-90 hover:shadow-md"
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
