import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { saveName, DEFAULT_NAME, sanitizeName } from "@/components/trade/conciergeGreeting";

type Screen = "welcome" | "personalize" | "done";

const STORAGE_KEY = "ma:copilot-onboarded";
const OVERLAY_ID = "trade-copilot-onboarding";

function useOnboardingOpen(): { open: boolean; markDone: () => void } {
  const { profile, loading, isTradeUser } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    // Only on the trade dashboard, for approved trade users who haven't
    // completed the overlay (profile flag or this browser).
    const onDashboard = pathname.startsWith("/trade/dashboard");
    const completed = profile?.has_seen_trade_intro === true || localStorage.getItem(STORAGE_KEY) === "1";
    setOpen(isTradeUser && onDashboard && !completed);
  }, [profile?.has_seen_trade_intro, loading, isTradeUser, pathname]);

  const markDone = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
  }, []);

  return { open, markDone };
}

export default function TradeCopilotOnboarding() {
  const { profile, user } = useAuth();
  const { open, markDone } = useOnboardingOpen();
  const [screen, setScreen] = useState<Screen>("welcome");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmedName, setConfirmedName] = useState("");

  const displayName = profile?.first_name?.trim() || "Designer";
  const persistedName = profile?.concierge_name?.trim();

  useEffect(() => {
    if (open) {
      // Default to the saved name, or the house default ("Felix").
      setNickname(persistedName || DEFAULT_NAME);
    }
  }, [open, persistedName]);

  const complete = useCallback(async () => {
    if (!user || busy) return;
    setBusy(true);
    setSaveError(null);
    const chosen = sanitizeName(nickname) || DEFAULT_NAME;

    // Persist locally so the header pill updates immediately.
    saveName(chosen);
    window.dispatchEvent(new CustomEvent("concierge:name-changed", { detail: chosen }));

    // Persist to profile so the name follows the user across devices.
    const { error } = await supabase
      .from("profiles")
      .update({
        concierge_name: chosen === DEFAULT_NAME ? null : chosen,
        has_seen_trade_intro: true,
      })
      .eq("id", user.id);

    setBusy(false);

    if (error) {
      // Local save succeeded — offer retry or continue without syncing.
      setSaveError("We couldn't save this to your profile. Check your connection and try again.");
      return;
    }

    setConfirmedName(chosen);
    setScreen("done");
    window.setTimeout(markDone, 2200);
  }, [nickname, user, busy, markDone]);

  if (!open) return null;

  return (
    <div
      id={OVERLAY_ID}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="copilot-welcome-title"
    >
      <div className="w-full max-w-md text-center">
        <div className="mb-8 inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 text-accent">
          <Sparkles className="w-6 h-6" />
        </div>

        <AnimatePresence mode="wait">
          {screen === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="font-body text-[10px] uppercase tracking-[0.25em] text-accent mb-4">
                Maison Affluency Trade Portal
              </p>
              <h2
                id="copilot-welcome-title"
                className="font-display text-2xl md:text-3xl text-foreground leading-snug mb-5"
              >
                Welcome to the Maison, {displayName}.
              </h2>
              <p className="font-body text-sm text-muted-foreground leading-relaxed mb-10">
                To help you manage your upcoming architectural projects, your digital concierge is ready.
              </p>
              <button
                onClick={() => setScreen("personalize")}
                className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-foreground text-background font-body text-xs uppercase tracking-[0.18em] hover:bg-foreground/90 transition-colors"
              >
                Meet your copilot
              </button>
            </motion.div>
          )}

          {screen === "personalize" && (
            <motion.div
              key="personalize"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="font-body text-[10px] uppercase tracking-[0.25em] text-accent mb-4">
                Personalize
              </p>
              <h2 className="font-display text-2xl md:text-3xl text-foreground leading-snug mb-5">
                Meet {DEFAULT_NAME}: Your Digital Studio Assistant
              </h2>
              <p className="font-body text-sm text-muted-foreground leading-relaxed mb-8">
                We call him {DEFAULT_NAME}, but every great design studio operates differently. What would you like to call your AI copilot?
              </p>

              <div className="text-left mb-6">
                <label htmlFor="copilot-nickname" className="sr-only">
                  Copilot name
                </label>
                <input
                  id="copilot-nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(sanitizeName(e.target.value))}
                  placeholder={DEFAULT_NAME}
                  maxLength={32}
                  disabled={busy}
                  className="w-full bg-background border border-border focus:border-foreground/40 text-foreground placeholder:text-muted-foreground/60 px-5 py-3.5 font-body text-sm rounded-sm transition-colors outline-none focus:ring-1 focus:ring-foreground/10 disabled:opacity-60"
                />
                <p className="mt-2 font-body text-[10px] text-muted-foreground tracking-wide">
                  This is how your copilot will introduce itself across your trade dashboard.
                </p>
              </div>

              {saveError && (
                <div
                  role="alert"
                  className="mb-6 flex items-start gap-2.5 text-left border border-destructive/30 bg-destructive/5 px-4 py-3 rounded-sm"
                >
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div className="font-body text-xs text-destructive leading-relaxed">
                    {saveError}{" "}
                    <button
                      onClick={markDone}
                      className="underline underline-offset-2 hover:text-destructive/80"
                    >
                      Continue anyway
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={complete}
                disabled={busy}
                className="inline-flex min-w-[220px] items-center justify-center gap-2 border border-accent bg-accent px-8 py-3 font-body text-xs uppercase tracking-[0.18em] text-accent-foreground transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-70"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Initializing…
                  </>
                ) : saveError ? (
                  "Try again"
                ) : (
                  "Initialize Copilot"
                )}
              </button>
            </motion.div>
          )}

          {screen === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mb-6 inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent text-accent-foreground">
                <Check className="w-5 h-5" />
              </div>
              <h2 className="font-display text-2xl md:text-3xl text-foreground leading-snug mb-4">
                You're all set.
              </h2>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">
                {confirmedName} is ready to assist with your projects.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
