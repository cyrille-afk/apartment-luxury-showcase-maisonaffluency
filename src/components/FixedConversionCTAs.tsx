import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Briefcase, Mail, X } from "lucide-react";
import { trackCTA } from "@/lib/analytics";
import { scrollToSection } from "@/lib/scrollToSection";

const SCROLL_THRESHOLD = 400;

const actions = [
  {
    label: "Book a Viewing",
    icon: Calendar,
    onClick: () => {
      trackCTA.bookAppointment("FixedCTA");
      scrollToSection("contact");
    },
  },
  {
    label: "Trade Programme",
    icon: Briefcase,
    onClick: () => scrollToSection("contact"),
  },
  {
    label: "Enquire Now",
    icon: Mail,
    onClick: () => {
      trackCTA.email("FixedCTA");
      window.location.href = "mailto:concierge@myaffluency.com";
    },
  },
] as const;

const FixedConversionCTAs = () => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const show = visible && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 30 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed bottom-6 right-6 z-40 hidden md:flex flex-col items-end gap-2"
          style={{ marginBottom: "60px" }} /* clear chat widget */
        >
          <button
            onClick={() => setDismissed(true)}
            className="self-end mb-1 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label="Dismiss quick actions"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          {actions.map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.3 }}
              onClick={action.onClick}
              className="flex items-center gap-2.5 px-5 py-2.5
                         bg-card/95 hover:bg-muted/80 backdrop-blur-md
                         border border-border/60 hover:border-accent/50
                         rounded-full shadow-lg hover:shadow-xl
                         text-sm font-sans text-foreground tracking-wide
                         transition-all duration-300"
            >
              <action.icon className="w-4 h-4 text-foreground/70" />
              {action.label}
            </motion.button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FixedConversionCTAs;
