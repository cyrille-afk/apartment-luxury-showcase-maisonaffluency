import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Loader2, RefreshCw, Download } from "lucide-react";
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
        className="rounded-lg border border-[hsl(var(--gold))/0.3] bg-muted/20 p-3 md:p-4 flex items-center gap-3 md:gap-4"
      >
        {/* QR */}
        <div className="w-[104px] h-[104px] md:w-[116px] md:h-[116px] rounded-md border border-border bg-white flex items-center justify-center overflow-hidden shrink-0">
          {state === "ready" && dataUrl ? (
            <img src={dataUrl} alt="Scan to sign in on your phone" className="w-full h-full" />
          ) : state === "error" ? (
            <button
              onClick={mint}
              className="inline-flex items-center gap-1 text-[10px] font-body text-foreground hover:underline px-1 text-center"
            >
              <RefreshCw className="h-3 w-3" /> Try again
            </button>
          ) : (
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>

        {/* Copy + actions */}
        <div className="min-w-0 flex-1">
          <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            New · Mobile essentials
          </p>
          <h3 className="font-display text-sm md:text-base text-foreground leading-snug mt-0.5">
            Install the Native App on your phone
          </h3>
          <p className="font-body text-[11px] md:text-xs text-muted-foreground leading-tight mt-0.5">
            Scan to open on your phone — already signed in — then add to home screen for a real,
            fullscreen native experience.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 font-body text-[10px] uppercase tracking-[0.15em] text-foreground/80 hover:text-foreground hover:bg-muted transition-colors"
            >
              How to install
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
              className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--pdf-red))]/10 border border-[hsl(var(--pdf-red))]/30 px-2 py-1 font-body text-[10px] text-[hsl(var(--pdf-red))] hover:bg-[hsl(var(--pdf-red))]/20 transition-colors"
            >
              <Download className="h-3 w-3" /> PDF
            </a>
          </div>
          <p className="mt-1.5 font-body text-[10px] text-muted-foreground/70">
            Signed link · expires in 60 min.
          </p>
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
