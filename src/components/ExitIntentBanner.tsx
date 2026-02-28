import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { trackCTA } from "@/lib/analytics";

const WHATSAPP_URL = "https://wa.me/6591393850?text=Hi%2C%20I%27d%20like%20to%20learn%20more%20about%20your%20furniture%20collection";
const INACTIVITY_DELAY = 18000; // 18 seconds

const ExitIntentBanner = () => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

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
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="fixed bottom-0 inset-x-0 z-[60] p-3 md:p-4"
        >
          <div className="mx-auto max-w-lg flex items-center gap-3 rounded-xl bg-card/95 backdrop-blur-md border border-border/40 px-4 py-3 shadow-lg">
            <div
              className="flex-shrink-0 w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center cursor-pointer"
              onClick={handleClick}
              role="button"
              aria-label="Chat on WhatsApp"
            >
              <MessageCircle className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-serif text-foreground">
                Have questions?{" "}
                <button
                  onClick={handleClick}
                  className="underline underline-offset-2 hover:text-primary transition-colors"
                >
                  Chat with us on WhatsApp
                </button>
              </p>
            </div>
            <button
              onClick={dismiss}
              className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExitIntentBanner;
