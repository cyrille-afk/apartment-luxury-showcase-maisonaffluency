import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Smartphone } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { issueMobileSyncToken, MOBILE_SYNC_TTL_SECONDS } from "@/lib/mobileSync.functions";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

let deferredPrompt: InstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
  });
}

/** Production origin — never derive from window.location so preview/dev hosts never leak into QR codes. */
const PWA_ORIGIN = "https://maisonaffluency.com";

/** QR pointing at the mobile launch page, which handles sign-in and install. */
export function usePwaQr(size = 200) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(`${PWA_ORIGIN}/trade/launch`, {
      margin: 1,
      width: size,
      errorCorrectionLevel: "M",
      color: { dark: "#1a1a1a", light: "#ffffff" },
    }).then((u) => !cancelled && setSrc(u)).catch(() => {});
    return () => { cancelled = true; };
  }, [size]);
  return src;
}

/**
 * Signed-in QR: a one-time, 2-minute token at /auth/sync so scanning signs the
 * phone straight in. Refreshes while shown; falls back to the static launch QR.
 */
function useSyncQr(size: number, active: boolean) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: number | undefined;
    const mint = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) return;
        const { token } = await issueMobileSyncToken({ data: { accessToken } });
        const url = `${PWA_ORIGIN}/auth/sync?t=${encodeURIComponent(token)}`;
        const img = await QRCode.toDataURL(url, {
          margin: 1, width: size, errorCorrectionLevel: "M",
          color: { dark: "#1a1a1a", light: "#ffffff" },
        });
        if (!cancelled) setSrc(img);
      } catch {
        /* keep static fallback */
      }
      if (!cancelled) timer = window.setTimeout(mint, (MOBILE_SYNC_TTL_SECONDS - 20) * 1000);
    };
    mint();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [size, active]);
  return src;
}

function PwaQr({ size, className, signedIn = false }: { size: number; className?: string; signedIn?: boolean }) {
  const fallback = usePwaQr(size * 2);
  const synced = useSyncQr(size * 2, signedIn);
  const src = synced ?? fallback;
  return src ? (
    <img src={src} alt="QR code to install the Maison Affluency app" width={size} height={size} className={className} />
  ) : (
    <div style={{ width: size, height: size }} className={`animate-pulse bg-muted ${className ?? ""}`} />
  );
}

export function SidebarPwaBadge({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-40 bg-background/40 backdrop-blur-sm"
        />
      )}
      <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className={`mt-3 inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--gold)/0.35)] border-l-2 border-l-[hsl(var(--gold))] bg-gradient-to-r from-[hsl(var(--gold)/0.16)] to-[hsl(var(--gold)/0.04)] px-2.5 py-1.5 font-body text-[9px] uppercase tracking-[0.18em] text-foreground shadow-sm transition-all hover:from-[hsl(var(--gold)/0.24)] hover:to-[hsl(var(--gold)/0.08)] ${collapsed ? "justify-center" : ""}`}
          aria-label="Mobile app workspace"
          data-felix-target="sidebar-pwa"
          data-tour-sidebar-anchor="pwa"
        >
          <Smartphone className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--gold))]" strokeWidth={1.75} shapeRendering="geometricPrecision" />
          {!collapsed && (
            <>
              <span>Mobile App Workspace</span>
              <span className="rounded-sm bg-[hsl(var(--gold))] px-1 py-px text-[7px] font-semibold leading-none tracking-[0.12em] text-background">
                PWA
              </span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        className="w-56 bg-background p-4 text-center"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <PwaQr size={160} className="mx-auto" signedIn={open} />
        <p className="mt-3 font-body text-[11px] leading-snug text-muted-foreground">
          Scan to sign in on your phone instantly — code refreshes every 2 minutes
        </p>
      </PopoverContent>
    </Popover>
    </>
  );
}

export function DashboardPwaBanner() {
  const install = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      deferredPrompt = null;
    } else {
      window.location.href = `${PWA_ORIGIN}/trade/launch`;
    }
  };
  return (
    <section
      data-felix-target="pwa-banner"
      className="mb-8 flex flex-col items-center gap-8 border border-foreground/40 bg-background p-6 sm:flex-row sm:items-center md:p-8"
    >
      <div className="flex h-24 w-24 shrink-0 items-center justify-center">
        <PwaQr size={96} className="h-24 w-24" />
      </div>
      <div className="text-center sm:text-left">
        <h2 className="font-body text-xs uppercase tracking-[0.2em] text-foreground">
          Maison Affluency — Mobile Studio Concierge
        </h2>
        <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-muted-foreground">
          Install our Progressive Web App in 1 or 2 clicks to take your trade tools on site. Snap rendering photographs,
          review wholesale pricing matrices, and stage collection pieces fluidly from any mobile device.
        </p>
        <button
          type="button"
          onClick={install}
          className="mt-4 font-body text-[11px] uppercase tracking-[0.2em] text-foreground underline underline-offset-4 hover:opacity-70"
        >
          Install Applicable App
        </button>
      </div>
    </section>
  );
}
