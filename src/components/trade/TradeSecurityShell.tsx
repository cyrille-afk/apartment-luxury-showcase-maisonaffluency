import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Faint diagonal identification watermark burned over the trade shell. */
export function TradeWatermark() {
  const { profile, user } = useAuth() as any;
  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    profile?.email ||
    user?.email ||
    "MEMBER";
  const text = `CONFIDENTIAL PROPERTY OF MAISON AFFLUENCY · LICENSED EXCLUSIVELY TO ${String(name).toUpperCase()} · ACCESS SECURED`;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[80] select-none text-foreground print:hidden"
      style={{ opacity: 0.02 }}
    >
      <svg width="100%" height="100%">
        <defs>
          <pattern id="ma-trade-wm" width="900" height="220" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
            <text x="0" y="60" fill="currentColor" fontSize="14" letterSpacing="3" fontFamily="sans-serif">{text}</text>
            <text x="-450" y="170" fill="currentColor" fontSize="14" letterSpacing="3" fontFamily="sans-serif">{text}</text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ma-trade-wm)" />
      </svg>
    </div>
  );
}

/** Blocks context menu, print and inspector shortcuts while mounted. */
export function useTradeShortcutBlocks() {
  useEffect(() => {
    const onContext = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [contenteditable='true']")) return;
      e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      if (
        k === "f12" ||
        (mod && k === "p") ||
        (mod && (e.altKey || e.shiftKey) && (k === "i" || k === "j" || k === "c")) ||
        (mod && k === "u")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onDrag = (e: DragEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === "IMG") e.preventDefault();
    };
    window.addEventListener("contextmenu", onContext);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("dragstart", onDrag);
    return () => {
      window.removeEventListener("contextmenu", onContext);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("dragstart", onDrag);
    };
  }, []);
}

/** One-time click-wrap NDA, persisted to the member's profile. */
export function TradeNdaGate() {
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "required" | "accepted">("loading");
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("has_accepted_trade_nda")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        // A failed lookup must not lock members out; only show when explicitly false.
        if (error) return setStatus("accepted");
        setStatus(data?.has_accepted_trade_nda ? "accepted" : "required");
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (status !== "required" || !user) return null;

  const accept = async () => {
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("profiles")
      .update({ has_accepted_trade_nda: true, trade_nda_accepted_at: new Date().toISOString() })
      .eq("id", user.id);
    setSaving(false);
    if (error) return setError("We couldn't record your acceptance. Please try again.");
    setStatus("accepted");
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/90 backdrop-blur-md px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="nda-title" className="w-full max-w-xl border border-border bg-background p-8 md:p-10 shadow-2xl">
        <p className="font-body text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Trade Confidentiality Agreement</p>
        <h2 id="nda-title" className="mt-3 font-display text-2xl md:text-3xl text-foreground tracking-wide">Secure Studio Access</h2>
        <div className="mt-6 space-y-3 font-body text-sm leading-relaxed text-muted-foreground">
          <p>
            The Maison Affluency Trade Portal — including its user interface framework, dashboard layouts, top-down budget
            calculator formulas, pricing structures and curator picks tables — constitutes proprietary trade secrets of
            Maison Affluency.
          </p>
          <p>
            Access is licensed to you personally for professional sourcing. You agree not to copy, screenshot, record,
            reproduce or disclose any part of the portal to third parties, including competitors. Sessions are
            watermarked with your identity.
          </p>
        </div>
        <label className="mt-6 flex items-start gap-3 cursor-pointer font-body text-sm text-foreground">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 h-4 w-4 accent-foreground" />
          <span>I have read and accept these confidentiality terms.</span>
        </label>
        {error && <p className="mt-3 font-body text-xs text-destructive">{error}</p>}
        <button
          type="button"
          disabled={!checked || saving}
          onClick={accept}
          className="mt-8 w-full bg-foreground text-background py-3.5 font-body text-xs uppercase tracking-[0.2em] transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {saving ? "Securing…" : "Proceed to Secure Studio"}
        </button>
      </div>
    </div>
  );
}
