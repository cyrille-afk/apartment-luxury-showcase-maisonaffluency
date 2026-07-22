import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Loader2, RefreshCw, Smartphone, Share, Plus, MoreVertical, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MobileHandoffDialog } from "./MobileHandoffDialog";
import { trackEvent } from "@/lib/analytics";

/**
 * Dashboard hero: merges the old "Install Maison Affluency on your phone"
 * link card with the "Sync to Phone" QR handoff. Renders the QR inline so
 * the trade user sees, in one glance, that they are getting a real,
 * signed-in, home-screen-installable native app — not just a mobile URL.
 */
export function InstallNativeAppCard() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const attempted = useRef(false);

  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/trade`;
  }, []);

  const mint = async () => {
    setState("loading");
    try {
      const { data, error } = await supabase.functions.invoke("trade-mobile-magic-link", {
        body: { redirectTo },
      });
      if (error) throw error;
      const link = (data as any)?.url as string | undefined;
      if (!link) throw new Error("No link returned");
      const png = await QRCode.toDataURL(link, {
        margin: 1,
        width: 260,
        errorCorrectionLevel: "M",
        color: { dark: "#0a0a0a", light: "#ffffff" },
      });
      setDataUrl(png);
      setState("ready");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    mint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <section
        aria-label="Install Maison Affluency on your phone"
        className="mb-6 rounded-lg border border-[hsl(var(--gold))/0.3] bg-muted/20 p-4 md:p-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-[168px_1fr_auto] gap-4 md:gap-5 items-center">
          {/* QR */}
          <div className="mx-auto md:mx-0 w-[160px] h-[160px] rounded-md border border-border bg-white flex items-center justify-center overflow-hidden shrink-0">
            {state === "ready" && dataUrl ? (
              <img src={dataUrl} alt="Scan to sign in on your phone" className="w-full h-full" />
            ) : state === "error" ? (
              <button
                onClick={mint}
                className="inline-flex items-center gap-1.5 text-xs font-body text-foreground hover:underline"
              >
                <RefreshCw className="h-3 w-3" /> Try again
              </button>
            ) : (
              <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
            )}
          </div>

          {/* Copy */}
          <div className="min-w-0 text-center md:text-left">
            <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              New · Mobile essentials
            </p>
            <h3 className="font-display text-base md:text-lg text-foreground leading-snug mt-0.5">
              Install the Native App on your phone
            </h3>
            <p className="font-body text-[12px] md:text-[13px] text-muted-foreground leading-snug mt-1">
              Scan to open Maison Affluency on your phone with your session already signed in —
              then add it to your home screen for a real, fullscreen native app experience (no App
              Store required).
            </p>
            <div className="mt-2 flex flex-wrap justify-center md:justify-start gap-x-4 gap-y-1 font-body text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Smartphone className="h-3 w-3" /> iPhone · <Share className="h-3 w-3" /> Share →{" "}
                <Plus className="h-3 w-3" /> Add to Home Screen
              </span>
              <span className="inline-flex items-center gap-1">
                <Smartphone className="h-3 w-3" /> Android · <MoreVertical className="h-3 w-3" />{" "}
                Menu → Install app
              </span>
            </div>
            <p className="mt-1.5 font-body text-[10px] text-muted-foreground/80">
              Signed link · expires in 60 min. Keep it private.
            </p>
          </div>

          {/* Actions */}
          <div className="flex md:flex-col items-center gap-2 justify-center md:justify-start shrink-0">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-body text-[11px] uppercase tracking-[0.15em] text-foreground/80 hover:text-foreground hover:bg-muted transition-colors"
            >
              Full instructions
            </button>
            <a
              href="/guides/studio-pwa-preview-checklist.pdf"
              download
              onClick={() =>
                trackEvent("guide_pdf_download", {
                  event_category: "Trade Guides",
                  event_label: "pwa-preview-checklist",
                  source: "dashboard_install_card",
                })
              }
              className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--pdf-red))]/10 border border-[hsl(var(--pdf-red))]/30 px-2.5 py-1.5 font-body text-[11px] text-[hsl(var(--pdf-red))] hover:bg-[hsl(var(--pdf-red))]/20 transition-colors"
            >
              <Download className="h-3 w-3" /> PDF
            </a>
          </div>
        </div>
      </section>

      <MobileHandoffDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        redirectTo={redirectTo}
        targetLabel="your trade dashboard"
      />
    </>
  );
}
