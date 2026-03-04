import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Calendar, Briefcase, Mail } from "lucide-react";
import { trackCTA } from "@/lib/analytics";
import { scrollToSection } from "@/lib/scrollToSection";

const actions = [
  {
    label: "Book a Private Viewing",
    icon: Calendar,
    description: "Visit our District 9 showroom by appointment",
    onClick: () => {
      trackCTA.bookAppointment("ConversionCTA");
      scrollToSection("contact");
    },
  },
  {
    label: "Trade Programme",
    icon: Briefcase,
    description: "Exclusive services for design professionals",
    onClick: () => {
      scrollToSection("contact");
    },
  },
  {
    label: "Enquire Now",
    icon: Mail,
    description: "Speak with our concierge team",
    onClick: () => {
      trackCTA.email("ConversionCTA");
      window.location.href = "mailto:concierge@myaffluency.com";
    },
  },
] as const;

const ConversionCTAs = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <div
      ref={ref}
      className="relative py-8 md:py-12 px-4 md:px-12 lg:px-20 bg-background border-b border-border/40"
    >
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {actions.map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.15 * i }}
              onClick={action.onClick}
              className="group flex items-center gap-4 md:flex-col md:items-center md:text-center
                         px-5 py-4 md:px-6 md:py-6
                         bg-card hover:bg-muted/50
                         border border-border/60 hover:border-accent/50
                         rounded-sm
                         transition-all duration-300
                         shadow-sm hover:shadow-md"
            >
              <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full
                              bg-muted flex items-center justify-center
                              group-hover:bg-accent/15 transition-colors duration-300">
                <action.icon className="w-5 h-5 md:w-6 md:h-6 text-foreground/70 group-hover:text-accent transition-colors duration-300" />
              </div>
              <div className="flex flex-col items-start md:items-center gap-0.5">
                <span className="text-sm md:text-base font-serif font-semibold text-foreground tracking-wide">
                  {action.label}
                </span>
                <span className="text-xs text-muted-foreground font-sans">
                  {action.description}
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConversionCTAs;
