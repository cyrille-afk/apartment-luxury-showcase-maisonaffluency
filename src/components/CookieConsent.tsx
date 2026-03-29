import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/**
 * Minimal GDPR cookie consent banner.
 * Blocks GA4 until the user explicitly accepts.
 * Stores choice in localStorage as 'cookie_consent'.
 */
const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) {
      // Small delay so it doesn't flash during hero load
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem("cookie_consent", "accepted");
    setVisible(false);
    // Load GA4 immediately
    if (typeof (window as any).__loadGA4 === "function") {
      (window as any).__loadGA4();
    }
  };

  const decline = () => {
    localStorage.setItem("cookie_consent", "declined");
    localStorage.setItem("ga_optout", "1");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-0 left-0 right-0 z-[9999] p-4 md:p-6"
        >
          <div className="max-w-2xl mx-auto bg-card/95 backdrop-blur-md border border-border/50 rounded-lg shadow-2xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Close/decline via X */}
            <button
              onClick={decline}
              className="absolute top-3 right-3 sm:hidden text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Decline cookies"
            >
              <X className="w-4 h-4" />
            </button>

            <p className="text-sm text-muted-foreground leading-relaxed flex-1 font-serif pr-6 sm:pr-0">
              We use cookies to analyse site performance and personalise your experience.
              By accepting, you consent to analytics cookies.
            </p>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={decline}
                className="hidden sm:inline-flex text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
              >
                Decline
              </button>
              <button
                onClick={accept}
                className="text-xs uppercase tracking-[0.15em] bg-foreground text-background px-5 py-2.5 rounded hover:opacity-90 transition-opacity font-medium"
              >
                Accept
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieConsent;
