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
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 rounded-full bg-white pl-3 pr-2 py-2 shadow-lg cursor-pointer hover:bg-white/90 transition-colors border border-border/40"
          onClick={handleClick}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); } }}
          role="button"
          tabIndex={0}
          aria-label="Chat with us on WhatsApp"
        >
          <span className="text-foreground text-xs font-medium whitespace-nowrap">Chat with us</span>
          <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center" aria-hidden="true">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); dismiss(); }}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center shadow-sm"
            aria-label="Dismiss WhatsApp chat prompt"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExitIntentBanner;
