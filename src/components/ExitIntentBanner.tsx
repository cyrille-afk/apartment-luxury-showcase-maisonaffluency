import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { trackCTA } from "@/lib/analytics";

const WHATSAPP_URL = "https://wa.me/6591393850?text=Hi%2C%20I%27d%20like%20to%20learn%20more%20about%20your%20furniture%20collection";
const INACTIVITY_DELAY = 18000; // 18 seconds

const WA_ICON_PATH =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";

const ExitIntentBanner = () => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Hide when any Radix Dialog overlay is open (lightboxes)
  // Debounced to avoid forced reflows on every DOM mutation
  useEffect(() => {
    let raf = 0;
    const check = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setDialogOpen(!!document.querySelector('[role="dialog"]'));
      });
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: false });
    check();
    return () => { observer.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  const show = useCallback(() => {
    if (!dismissed) setVisible(true);
  }, [dismissed]);

  useEffect(() => {
    if (dismissed) return;

    let timer = setTimeout(show, INACTIVITY_DELAY);

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(show, INACTIVITY_DELAY);
    };

    const events = ["scroll", "mousemove", "touchstart", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [dismissed, show]);

  const dismiss = () => {
    setDismissed(true);
    setVisible(false);
  };

  const handleClick = () => {
    trackCTA.whatsapp("exit_intent_banner");
    window.open(WHATSAPP_URL, "_blank", "noopener");
  };

  return (
    <AnimatePresence>
      {visible && !dialogOpen && (
        <div className="fixed bottom-[5.5rem] md:bottom-4 right-4 z-[60] flex items-end gap-1.5">
          {/* Mobile dismiss — small, to the left of the pill */}
          <button
            onClick={(e) => { e.stopPropagation(); dismiss(); }}
            className="w-6 h-6 md:hidden rounded-full bg-card/80 border border-border/50 flex items-center justify-center shadow-sm touch-manipulation mb-1"
            aria-label="Dismiss WhatsApp chat prompt"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
          <div className="relative">
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex items-center gap-2.5 rounded-full bg-white pl-3.5 pr-2.5 py-2 shadow-lg cursor-pointer hover:bg-white/90 transition-colors border border-border/40 min-h-[44px] touch-manipulation"
              onClick={handleClick}
              aria-label="Chat with us on WhatsApp"
            >
              <span className="text-muted-foreground text-xs font-medium font-body whitespace-nowrap">Chat with us</span>
              <span className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="white">
                  <path d={WA_ICON_PATH} />
                </svg>
              </span>
            </motion.button>
            {/* Desktop dismiss — top-right corner of pill */}
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(); }}
              className="hidden md:flex absolute -top-3 -right-3 w-6 h-6 rounded-full bg-card border border-border items-center justify-center shadow-md"
              aria-label="Dismiss WhatsApp chat prompt"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ExitIntentBanner;
