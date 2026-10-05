import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Smartphone } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

function PwaQr({ size, className }: { size: number; className?: string }) {
  const src = usePwaQr(size * 2);
  return src ? (
    <img src={src} alt="QR code to install the Maison Affluency app" width={size} height={size} className={className} />
  ) : (
    <div style={{ width: size, height: size }} className={`animate-pulse bg-muted ${className ?? ""}`} />
  );
}

export function SidebarPwaBadge({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className={`mt-3 inline-flex items-center gap-1.5 border border-border px-2 py-1 font-body text-[9px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground ${collapsed ? "justify-center" : ""}`}
          aria-label="Mobile app workspace"
        >
          <Smartphone className="h-3 w-3" />
          {!collapsed && "Mobile App Workspace"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        className="w-56 bg-background p-4 text-center"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <PwaQr size={160} className="mx-auto" />
        <p className="mt-3 font-body text-[11px] leading-snug text-muted-foreground">
          Scan to install Maison Affluency PWA instantly
        </p>
      </PopoverContent>
    </Popover>
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
