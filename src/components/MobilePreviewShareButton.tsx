import { useMemo, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Smartphone, X, RotateCw } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

type Device = "se" | "pro_max" | "pixel";
type Side = "trade" | "public" | "split";

type DeviceMeta = {
  label: string;
  w: number;
  h: number;
  /** iOS home-indicator / bottom safe-area height in CSS px */
  homeBarH: number;
  /** True for devices with a Dynamic Island / centre notch */
  hasDynamicIsland: boolean;
};

const DEVICES: Record<Device, DeviceMeta> = {
  se:      { label: "iPhone SE",         w: 375, h: 667, homeBarH: 20, hasDynamicIsland: false },
  pro_max: { label: "iPhone 16 Pro Max", w: 440, h: 956, homeBarH: 34, hasDynamicIsland: true },
  pixel:   { label: "Pixel",             w: 412, h: 915, homeBarH: 0,  hasDynamicIsland: false },
};

/**
 * Map a trade route to its closest public counterpart (and vice-versa) so the
 * "Public ↔ Trade" toggle in the mobile-preview toolbar lands the user on
 * something meaningful instead of a 404.
 */
const PUBLIC_FOR_TRADE: Record<string, string> = {
  "/trade": "/",
  "/trade/dashboard": "/",
  "/trade/designers": "/designers",
  "/trade/gallery": "/gallery",
  "/trade/journal": "/journal",
  "/trade/showroom": "/",
  "/trade/guides": "/",
};

const toPublicPath = (pathname: string): string => {
  if (PUBLIC_FOR_TRADE[pathname]) return PUBLIC_FOR_TRADE[pathname];
  // Generic fall-backs: /trade/designers/<slug> → /designers/<slug>, etc.
  if (pathname.startsWith("/trade/designers/")) return pathname.replace("/trade/designers/", "/designers/");
  if (pathname.startsWith("/trade/journal/")) return pathname.replace("/trade/journal/", "/journal/");
  if (pathname.startsWith("/trade/gallery")) return pathname.replace("/trade/gallery", "/gallery");
  // Default: drop the /trade prefix, fall back to home if that yields nothing.
  const stripped = pathname.replace(/^\/trade/, "");
  return stripped || "/";
};

const toTradePath = (pathname: string): string => {
  if (pathname === "/" || pathname === "") return "/trade/dashboard";
  if (pathname === "/gallery") return "/trade/gallery";
  if (pathname === "/designers") return "/trade/designers";
  if (pathname === "/journal") return "/trade/journal";
  if (pathname.startsWith("/trade")) return pathname;
  return `/trade${pathname}`;
};

/**
 * Floating button that opens a phone-sized preview of the current page.
 * - Available on every route (trade and public) for desktop reviewers.
 * - Anchored top-right so it never collides with the bottom-right AI Concierge panel.
 * - Toolbar toggle lets the reviewer flip between Trade and Public views without leaving.
 */
const MobilePreviewShareButton = () => {
  const { pathname } = useLocation();
  const isMobileViewport = useIsMobile();
  const [open, setOpen] = useState(false);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [device, setDevice] = useState<Device>("pro_max");
  const [side, setSide] = useState<Side>(() =>
    typeof window !== "undefined" && window.location.pathname.startsWith("/trade") ? "trade" : "public"
  );

  // Reset side to match the current page each time the preview opens.
  useEffect(() => {
    if (open) setSide(pathname.startsWith("/trade") ? "trade" : "public");
  }, [open, pathname]);

  // Listen for an external trigger so the dashboard header button can open us
  // without rendering its own duplicate floating button.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-mobile-preview", handler);
    return () => window.removeEventListener("open-mobile-preview", handler);
  }, []);

  // Lock body scroll while preview is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.dataset.mobilePreviewOpen = "1";
    window.dispatchEvent(new CustomEvent("mobile-preview-open-change"));
    return () => {
      document.body.style.overflow = prev;
      delete document.documentElement.dataset.mobilePreviewOpen;
      window.dispatchEvent(new CustomEvent("mobile-preview-open-change"));
    };
  }, [open]);

  const buildSrc = (target: "trade" | "public") => {
    if (typeof window === "undefined") return "";
    // `/trade` and `/trade/dashboard` are the same app route, but in the
    // Lovable test iframe `/trade` can be restored/rewritten back to `/` by
    // preview continuity. Use the concrete dashboard route for the iframe so
    // the Trade tab cannot show the public homepage.
    const currentPath = pathname === "/trade" ? "/trade/dashboard" : pathname;
    const targetPath = target === "trade" ? toTradePath(currentPath) : toPublicPath(currentPath);
    const url = new URL(targetPath, window.location.origin);
    const currentSearch = new URLSearchParams(window.location.search);
    const lovableToken = currentSearch.get("__lovable_token");
    if (lovableToken) url.searchParams.set("__lovable_token", lovableToken);
    url.searchParams.set("mobile_preview", "1");
    // Simulate the installed PWA experience so the preview shows the iOS home
    // indicator and PWA-specific layouts rather than mobile-Safari chrome.
    url.searchParams.set("source", "pwa");
    return `${url.pathname}${url.search}${url.hash}`;
  };

  const tradeSrc = useMemo(() => buildSrc("trade"), [pathname]);
  const publicSrc = useMemo(() => buildSrc("public"), [pathname]);
  const previewSrc = side === "trade" ? tradeSrc : side === "public" ? publicSrc : "";

  // Hide on real mobile devices — preview is a desktop QA aid.
  if (isMobileViewport) return null;

  // QA-only tool: never render on the published/production site. Allow it in
  // local dev (Vite dev server) and on Lovable preview hosts (id-preview--*,
  // *.lovableproject.com), but not on the user-facing apex / .lovable.app build.
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocalDev = import.meta.env.DEV && (host === "localhost" || host === "127.0.0.1");
    const isEditorSandbox =
      /(^|\.)lovableproject\.com$/.test(host) ||
      /(^|\.)lovableproject-dev\.com$/.test(host) ||
      host.startsWith("id-preview--");
    if (!isLocalDev && !isEditorSandbox) return null;
  }

  const dims = DEVICES[device];
  const frameW = orientation === "portrait" ? dims.w : dims.h;
  const frameH = orientation === "portrait" ? dims.h : dims.w;
  const isIOS = device !== "pixel";
  const homeBarH = isIOS && orientation === "portrait" ? dims.homeBarH : 0;
  const usableH = frameH - homeBarH;

  // Floating trigger removed — opening is handled exclusively by the
  // MobilePreviewHeaderButton in the trade header (and `open-mobile-preview`
  // event listener above) so it never overlaps page content.

  const PhoneFrame = ({
    src,
    label,
    variant,
  }: {
    src: string;
    label?: string;
    variant: "split" | "single";
  }) => (
    <div className="flex flex-col items-center">
      {label && (
        <span className="font-body text-[10px] uppercase tracking-[0.15em] text-background/80 mb-2">
          {label}
        </span>
      )}
      <div
        className="relative bg-neutral-900 rounded-[2.5rem] p-3 shadow-2xl overflow-hidden"
        style={{
          maxHeight: variant === "split" ? "calc(100vh - 8rem)" : "calc(100vh - 6rem)",
        }}
      >
        {/* Dynamic Island — iPhone Pro Max portrait only */}
        {isIOS && orientation === "portrait" && dims.hasDynamicIsland && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-[84px] h-[26px] bg-black rounded-full pointer-events-none" />
        )}

        <iframe
          key={src}
          src={src}
          title={`Mobile preview · ${label || side}`}
          className="bg-background rounded-[1.75rem] block transition-all"
          style={{
            width: frameW,
            height: usableH,
            maxHeight: variant === "split" ? "calc(100vh - 9rem)" : "calc(100vh - 7rem)",
            maxWidth: variant === "split" ? "calc((100vw - 5rem) / 2)" : "calc(100vw - 3rem)",
          }}
        />

        {/* iOS home-indicator strip */}
        {homeBarH > 0 && (
          <div
            className="absolute bottom-3 left-3 right-3 bg-black/90 rounded-b-[1.75rem] flex items-start justify-center pt-2 pointer-events-none"
            style={{ height: homeBarH }}
          >
            <div className="w-[120px] h-[5px] bg-white/80 rounded-full" />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center p-4 print:hidden">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-3 bg-background border border-border rounded-full px-3 py-1.5 shadow-lg">
            {/* Side toggle */}
            <div className="flex items-center gap-1 border-r border-border pr-2 mr-1">
              {(["trade", "public", "split"] as Side[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={`px-2.5 py-0.5 rounded-full font-body text-[10px] uppercase tracking-wider transition ${
                    side === s
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-pressed={side === s}
                >
                  {s === "split" ? "Split" : s}
                </button>
              ))}
            </div>

            <span className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground mr-1">
              {frameW}×{frameH}
            </span>
            <div className="flex items-center gap-1">
              {(Object.keys(DEVICES) as Device[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setDevice(key)}
                  className={`px-2 py-0.5 rounded-full font-body text-[10px] uppercase tracking-wider transition ${
                    device === key
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {DEVICES[key].label}
                </button>
              ))}
            </div>
            <button
              onClick={() =>
                setOrientation((o) => (o === "portrait" ? "landscape" : "portrait"))
              }
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition"
              aria-label="Rotate"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition"
              aria-label="Close preview"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Phone frame(s) */}
          {side === "split" ? (
            <div className="flex items-start gap-4" style={{ maxWidth: "calc(100vw - 2rem)" }}>
              {([
                { label: "Trade", src: tradeSrc },
                { label: "Public", src: publicSrc },
              ] as const).map((pane) => (
                <PhoneFrame
                  key={pane.label}
                  src={pane.src}
                  label={pane.label}
                  variant="split"
                />
              ))}
            </div>
          ) : (
            <PhoneFrame src={previewSrc} variant="single" />
          )}
        </div>
      )}
    </>
  );
};

export default MobilePreviewShareButton;
