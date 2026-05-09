import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Smartphone, X, RotateCw } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

type Device = "se" | "iphone14" | "pixel";

const DEVICES: Record<Device, { label: string; w: number; h: number }> = {
  se:      { label: "iPhone SE", w: 375, h: 667 },
  iphone14: { label: "iPhone 14", w: 390, h: 844 },
  pixel:   { label: "Pixel",     w: 412, h: 915 },
};

/**
 * Floating button that opens the current trade page in a phone-sized
 * preview frame on desktop. Hidden on real mobile devices and on all
 * public (non-trade) routes.
 */
const MobilePreviewShareButton = () => {
  const { pathname } = useLocation();
  const isMobileViewport = useIsMobile();
  const [open, setOpen] = useState(false);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [device, setDevice] = useState<Device>("iphone14");

  // Only show on trade routes and only on desktop viewports
  const isTradeRoute = pathname.startsWith("/trade");
  if (!isTradeRoute || isMobileViewport) return null;

  // Lock body scroll while preview is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const dims = DEVICES[device];
  const frameW = orientation === "portrait" ? dims.w : dims.h;
  const frameH = orientation === "portrait" ? dims.h : dims.w;

  const currentUrl = `${pathname}${window.location.search}${window.location.hash}`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-3 h-10 rounded-full bg-foreground text-background shadow-lg hover:opacity-90 transition-opacity print:hidden"
        aria-label="Preview this page in mobile size"
      >
        <Smartphone className="w-4 h-4" />
        <span className="font-body text-[10px] uppercase tracking-[0.15em]">
          Mobile preview
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center p-4 print:hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2 mb-3 bg-background border border-border rounded-full px-3 py-1.5 shadow-lg">
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

          {/* Phone frame */}
          <div
            className="relative bg-neutral-900 rounded-[2.5rem] p-3 shadow-2xl overflow-hidden"
            style={{
              maxHeight: "calc(100vh - 6rem)",
              maxWidth: "calc(100vw - 2rem)",
            }}
          >
            <iframe
              key={`${device}-${orientation}`}
              src={currentUrl}
              title="Mobile preview"
              className="bg-background rounded-[1.75rem] block"
              style={{
                width: frameW,
                height: frameH,
                maxHeight: "calc(100vh - 7rem)",
                maxWidth: "calc(100vw - 3rem)",
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default MobilePreviewShareButton;
