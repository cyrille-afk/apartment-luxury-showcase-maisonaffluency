import { useMemo, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Smartphone, X, RotateCw } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

type Device = "se" | "pro_max" | "pixel";
type Side = "trade" | "public" | "split";

const DEVICES: Record<Device, { label: string; w: number; h: number }> = {
  se:      { label: "iPhone SE",        w: 375, h: 667 },
  pro_max: { label: "iPhone 16 Pro Max", w: 440, h: 956 },
  pixel:   { label: "Pixel",            w: 412, h: 915 },
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
  if (pathname === "/" || pathname === "") return "/trade";
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
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const buildSrc = (target: "trade" | "public") => {
    if (typeof window === "undefined") return "";
    const targetPath = target === "trade" ? toTradePath(pathname) : toPublicPath(pathname);
    const url = new URL(targetPath, window.location.origin);
    url.searchParams.set("mobile_preview", "1");
    return `${url.pathname}${url.search}${url.hash}`;
  };

  const tradeSrc = useMemo(() => buildSrc("trade"), [pathname]);
  const publicSrc = useMemo(() => buildSrc("public"), [pathname]);
  const previewSrc = side === "trade" ? tradeSrc : side === "public" ? publicSrc : "";

  // Hide on real mobile devices — preview is a desktop QA aid.
  if (isMobileViewport) return null;

  const dims = DEVICES[device];
  const frameW = orientation === "portrait" ? dims.w : dims.h;
  const frameH = orientation === "portrait" ? dims.h : dims.w;

  return (
    <>
      {/* Bottom-right trigger — sits immediately to the left of the AI Concierge bubble,
          well clear of the preview iframe chrome (notification badges, share/publish bar). */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-24 z-[100] flex items-center gap-2 px-3 h-9 rounded-full bg-foreground text-background shadow-lg hover:opacity-90 transition-opacity print:hidden"
        aria-label="Preview this page in mobile size"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span className="font-body text-[10px] uppercase tracking-[0.15em]">
          Mobile preview
        </span>
      </button>

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
                <div key={pane.label} className="flex flex-col items-center">
                  <span className="font-body text-[10px] uppercase tracking-[0.15em] text-background/80 mb-2">
                    {pane.label}
                  </span>
                  <div
                    className="relative bg-neutral-900 rounded-[2.5rem] p-3 shadow-2xl overflow-hidden"
                    style={{ maxHeight: "calc(100vh - 8rem)" }}
                  >
                    <iframe
                      key={pane.src}
                      src={pane.src}
                      title={`Mobile preview · ${pane.label}`}
                      className="bg-background rounded-[1.75rem] block transition-all"
                      style={{
                        width: frameW,
                        height: frameH,
                        maxHeight: "calc(100vh - 9rem)",
                        maxWidth: "calc((100vw - 5rem) / 2)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="relative bg-neutral-900 rounded-[2.5rem] p-3 shadow-2xl overflow-hidden"
              style={{
                maxHeight: "calc(100vh - 6rem)",
                maxWidth: "calc(100vw - 2rem)",
              }}
            >
              <iframe
                key={previewSrc}
                src={previewSrc}
                title={`Mobile preview · ${side}`}
                className="bg-background rounded-[1.75rem] block transition-all"
                style={{
                  width: frameW,
                  height: frameH,
                  maxHeight: "calc(100vh - 7rem)",
                  maxWidth: "calc(100vw - 3rem)",
                }}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default MobilePreviewShareButton;
