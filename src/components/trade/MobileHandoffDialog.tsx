import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Smartphone, Share, Plus, MoreVertical, Loader2, Check, Copy, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { copyTextToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

interface MobileHandoffDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Absolute URL the phone should land on after sign-in. */
  redirectTo: string;
  /** Optional short label describing what will open on the phone. */
  targetLabel?: string;
}

/**
 * Elegant modal that mints a short-lived signed magic link and renders it as
 * a QR code so a Trade user can hop from desktop to their phone (or PWA) with
 * an already-authenticated session, landing on the exact page they were on.
 */
export function MobileHandoffDialog({ open, onOpenChange, redirectTo, targetLabel }: MobileHandoffDialogProps) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const mint = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("trade-mobile-magic-link", {
        body: { redirectTo },
      });
      if (error) throw error;
      const link = (data as any)?.url as string | undefined;
      if (!link) throw new Error("No link returned");
      setUrl(link);
      const png = await QRCode.toDataURL(link, {
        margin: 1,
        width: 320,
        errorCorrectionLevel: "M",
        color: { dark: "#0a0a0a", light: "#ffffff" },
      });
      setDataUrl(png);
      setState("ready");
    } catch (e) {
      setError((e as Error).message || "Failed to generate link");
      setState("error");
    }
  }, [redirectTo]);

  useEffect(() => {
    if (open) mint();
    else {
      setState("idle");
      setUrl(null);
      setDataUrl(null);
      setError(null);
      setCopied(false);
    }
  }, [open, mint]);

  const onCopy = async () => {
    if (!url) return;
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Take it on the go</DialogTitle>
          <DialogDescription className="font-body text-sm text-muted-foreground">
            Scan with your phone to open{" "}
            <span className="text-foreground">{targetLabel || "this page"}</span> with your session already signed in.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-[240px_1fr] gap-6 mt-2">
          {/* QR panel */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-[240px] h-[240px] rounded-lg border border-border bg-white flex items-center justify-center overflow-hidden">
              {state === "ready" && dataUrl ? (
                <img src={dataUrl} alt="Scan to open on phone" className="w-full h-full" />
              ) : state === "error" ? (
                <div className="text-center px-4">
                  <p className="font-body text-xs text-destructive mb-3">{error}</p>
                  <button
                    onClick={mint}
                    className="inline-flex items-center gap-1.5 text-xs font-body text-foreground hover:underline"
                  >
                    <RefreshCw className="h-3 w-3" /> Try again
                  </button>
                </div>
              ) : (
                <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <p className="font-body text-[11px] text-muted-foreground text-center leading-snug">
              Signed link · expires in 60 minutes. Anyone with the code can sign in as you — keep it private.
            </p>
            {state === "ready" && url && (
              <div className="flex items-center gap-2">
                <button
                  onClick={onCopy}
                  className="inline-flex items-center gap-1.5 text-[11px] font-body text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy link"}
                </button>
                <span className="text-muted-foreground/40">·</span>
                <button
                  onClick={mint}
                  className="inline-flex items-center gap-1.5 text-[11px] font-body text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className="h-3 w-3" /> New code
                </button>
              </div>
            )}
          </div>

          {/* Install instructions */}
          <div className="space-y-5">
            <section>
              <h3 className="font-display text-sm text-foreground flex items-center gap-2 mb-2">
                <Smartphone className="h-3.5 w-3.5" /> iPhone &amp; iPad (Safari)
              </h3>
              <ol className="space-y-1.5 font-body text-xs text-foreground/80">
                <li className="flex gap-2"><span className="text-accent">1.</span><span>Scan the QR with Camera — tap the banner to open in Safari.</span></li>
                <li className="flex gap-2"><span className="text-accent">2.</span><span className="flex items-center gap-1 flex-wrap">Tap <Share className="inline h-3 w-3" /> <strong>Share</strong> at the bottom.</span></li>
                <li className="flex gap-2"><span className="text-accent">3.</span><span>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</span></li>
              </ol>
            </section>
            <section>
              <h3 className="font-display text-sm text-foreground flex items-center gap-2 mb-2">
                <Smartphone className="h-3.5 w-3.5" /> Android (Chrome)
              </h3>
              <ol className="space-y-1.5 font-body text-xs text-foreground/80">
                <li className="flex gap-2"><span className="text-accent">1.</span><span>Scan with the Camera app or Google Lens.</span></li>
                <li className="flex gap-2"><span className="text-accent">2.</span><span className="flex items-center gap-1 flex-wrap">Open the <MoreVertical className="inline h-3 w-3" /> menu.</span></li>
                <li className="flex gap-2"><span className="text-accent">3.</span><span className="flex items-center gap-1 flex-wrap">Tap <Plus className="inline h-3 w-3" /> <strong>Add to Home screen</strong> or <em>Install app</em>.</span></li>
              </ol>
            </section>
            <p className="font-body text-[11px] text-muted-foreground border-t border-border pt-3">
              Once installed, launching from the icon opens Maison Affluency fullscreen — perfect for on-site client presentations.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Small helper: signal that this device is a mobile client, so the desktop
 *  continuity banner can stop showing after the first mobile visit. */
export function markMobileSeen() {
  try {
    localStorage.setItem("maf_mobile_pwa_seen", "1");
  } catch {}
}

interface HandoffTriggerProps {
  className?: string;
  redirectTo: string;
  targetLabel?: string;
  children: React.ReactNode;
}

export function HandoffTrigger({ className, redirectTo, targetLabel, children }: HandoffTriggerProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(className)}>
        {children}
      </button>
      <MobileHandoffDialog open={open} onOpenChange={setOpen} redirectTo={redirectTo} targetLabel={targetLabel} />
    </>
  );
}
