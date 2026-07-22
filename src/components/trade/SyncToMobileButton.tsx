import { useMemo, useState } from "react";
import { Smartphone } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import QRCode from "qrcode";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { MobileHandoffDialog } from "./MobileHandoffDialog";

/**
 * Desktop-only header button that reveals a lightweight popover with a QR
 * code deep-linking the phone into the exact route the user is on. A
 * secondary "Full instructions" affordance opens the richer modal.
 */
export function SyncToMobileButton() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const lastPathRef = useRef<string | null>(null);

  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${location.pathname}${location.search}`;
  }, [location.pathname, location.search]);

  const mint = async () => {
    setState("loading");
    setErrMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("trade-mobile-magic-link", {
        body: { redirectTo },
      });
      if (error) throw error;
      const link = (data as any)?.url as string | undefined;
      const errFromBody = (data as any)?.error as string | undefined;
      if (!link) throw new Error(errFromBody || "No link returned");
      const png = await QRCode.toDataURL(link, {
        margin: 1,
        width: 220,
        errorCorrectionLevel: "M",
        color: { dark: "#0a0a0a", light: "#ffffff" },
      });
      setDataUrl(png);
      setState("ready");
    } catch (e) {
      console.error("[sync-to-phone] mint failed", e);
      setErrMsg((e as Error).message || "Failed");
      setState("error");
    }
  };

  useEffect(() => {
    if (!open) return;
    if (lastPathRef.current === redirectTo && state === "ready") return;
    lastPathRef.current = redirectTo;
    mint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, redirectTo]);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-border bg-background text-foreground/80 hover:text-foreground hover:bg-muted px-3 py-1.5 transition-colors"
            aria-label="Sync to mobile"
            title="View this page on your phone"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span className="font-body text-[11px] uppercase tracking-[0.15em]">Sync to Phone</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-4">
          <div className="text-center">
            <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              View on Mobile
            </p>
            <h4 className="font-display text-sm text-foreground mt-1 mb-3">
              Open this page on your phone
            </h4>
            <div className="w-[220px] h-[220px] mx-auto rounded-md border border-border bg-white flex items-center justify-center overflow-hidden">
              {state === "ready" && dataUrl ? (
                <img src={dataUrl} alt="Scan to open on phone" className="w-full h-full" />
              ) : state === "error" ? (
                <div className="text-center px-2">
                  {errMsg && (
                    <p className="font-body text-[10px] text-destructive mb-1.5 leading-snug">{errMsg}</p>
                  )}
                  <button onClick={mint} className="inline-flex items-center gap-1 text-xs font-body text-foreground hover:underline">
                    <RefreshCw className="h-3 w-3" /> Try again
                  </button>
                </div>
              ) : (
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              )}
            </div>
            <p className="font-body text-[10px] text-muted-foreground mt-3 leading-snug">
              Signed link · expires in 60 min. Keep it private.
            </p>
            <button
              onClick={() => { setOpen(false); setModalOpen(true); }}
              className="inline-flex items-center gap-1 mt-3 font-body text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" /> Install instructions
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <MobileHandoffDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        redirectTo={redirectTo}
        targetLabel="this page"
      />
    </>
  );
}
