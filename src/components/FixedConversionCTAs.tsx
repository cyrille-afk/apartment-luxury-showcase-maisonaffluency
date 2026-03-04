import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Briefcase, Mail } from "lucide-react";
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
    label: "Enquire",
    icon: Mail,
    onClick: () => {
      trackCTA.email("FixedCTA");
      window.location.href = "mailto:concierge@myaffluency.com";
    },
  },
] as const;

const FixedConversionCTAs = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed bottom-5 z-40 hidden md:flex items-center gap-2"
          style={{ right: "260px" }}
        >
          {actions.map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i, duration: 0.3 }}
              onClick={action.onClick}
              className="flex items-center gap-2 px-4 py-2.5
                         bg-white/95 hover:bg-white backdrop-blur-md
                         border border-[hsl(var(--accent))]/40 hover:border-[hsl(var(--accent))]/70
                         rounded-full shadow-lg hover:shadow-xl
                         text-xs font-sans text-foreground tracking-wide
                         transition-all duration-300"
            >
              <action.icon className="w-3.5 h-3.5 text-[hsl(var(--accent))]" />
              {action.label}
            </motion.button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FixedConversionCTAs;
