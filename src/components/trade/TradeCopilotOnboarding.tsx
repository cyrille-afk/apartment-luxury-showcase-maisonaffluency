import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { saveName, DEFAULT_NAME, sanitizeName } from "@/components/trade/conciergeGreeting";

type Screen = "welcome" | "personalize";

const STORAGE_KEY = "ma:copilot-onboarded";
const OVERLAY_ID = "trade-copilot-onboarding";

function useOnboardingOpen(): { open: boolean; markDone: () => void } {
  const { profile, loading } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    // Only show for approved trade users who haven't completed the overlay.
    const completed = profile?.has_seen_trade_intro === true || localStorage.getItem(STORAGE_KEY) === "1";
    setOpen(!completed);
  }, [profile?.has_seen_trade_intro, loading]);

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

  const displayName = profile?.first_name?.trim() || "Designer";
  const persistedName = profile?.concierge_name?.trim();

  useEffect(() => {
    if (open && persistedName) {
      setNickname(persistedName);
    }
  }, [open, persistedName]);

  const complete = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const chosen = sanitizeName(nickname) || DEFAULT_NAME;

    // Persist locally so the header pill updates immediately.
    saveName(chosen);
    window.dispatchEvent(new CustomEvent("concierge:name-changed", { detail: chosen }));

    // Persist to profile so the name follows the user across devices.
    await supabase
      .from("profiles")
      .update({
        concierge_name: chosen === DEFAULT_NAME ? null : chosen,
        has_seen_trade_intro: true,
      })
      .eq("id", user.id);

    markDone();
    setBusy(false);
  }, [nickname, user, markDone]);

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
          {screen === "welcome" ? (
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
          ) : (
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
                Meet Felix: Your Digital Studio Assistant
              </h2>
              <p className="font-body text-sm text-muted-foreground leading-relaxed mb-8">
                We call him Felix, but every great design studio operates differently. What would you like to call your AI copilot?
              </p>

              <div className="text-left mb-8">
                <label htmlFor="copilot-nickname" className="sr-only">
                  Copilot name
                </label>
                <input
                  id="copilot-nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(sanitizeName(e.target.value))}
                  placeholder="e.g. Felix, Pierre, Assistant, Concierge"
                  maxLength={32}
                  className="w-full bg-background border border-border focus:border-foreground/40 text-foreground placeholder:text-muted-foreground/60 px-5 py-3.5 font-body text-sm rounded-sm transition-colors outline-none focus:ring-1 focus:ring-foreground/10"
                />
                <p className="mt-2 font-body text-[10px] text-muted-foreground tracking-wide">
                  This is how your copilot will introduce itself across your trade dashboard.
                </p>
              </div>

              <button
                onClick={complete}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-foreground text-background font-body text-xs uppercase tracking-[0.18em] hover:bg-foreground/90 transition-colors disabled:opacity-60"
              >
                {busy ? "Initializing…" : "Initialize Copilot"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
