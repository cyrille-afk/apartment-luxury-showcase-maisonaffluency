import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Image, Users, Palette, Gem, Building2, Mail } from "lucide-react";
import { scrollToSection } from "@/lib/scrollToSection";

const navItems = [
  { id: "gallery", label: "Gallery", icon: Image },
  { id: "designers", label: "Designers", icon: Palette },
  { id: "collectibles", label: "Collectibles", icon: Gem },
  { id: "brands", label: "Ateliers", icon: Building2 },
  { id: "contact", label: "Contact", icon: Mail },
];

const SCROLL_THRESHOLD = 300;
const NAV_HEIGHT = 96;

const StickyBottomNav = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  // Show after scrolling past hero
  useEffect(() => {
    const onScroll = () => setIsVisible(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Track active section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );

    navItems.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => scrollToSection(id);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.nav
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
          aria-label="Section navigation"
        >
          {/* Backdrop */}
          <div className="bg-card/90 backdrop-blur-xl border-t border-border/30 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
            <div className="flex items-center justify-around px-1 pt-2 pb-[max(3.5rem,calc(env(safe-area-inset-bottom) + 2.75rem))]">
              {navItems.map(({ id, label, icon: Icon }, index) => {
                const isActive = activeSection === id;
                return (
                  <motion.button
                    key={id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 * index, duration: 0.35, ease: "easeOut" }}
                    onClick={() => id === "contact" ? window.location.href = "mailto:concierge@myaffluency.com" : scrollTo(id)}
                    className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors duration-200 touch-manipulation min-w-[3.5rem] ${
                      isActive
                        ? "text-[hsl(var(--accent))]"
                        : "text-foreground active:text-foreground"
                    }`}
                    aria-label={`Go to ${label}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4" strokeWidth={isActive ? 2.5 : 1.5} />
                    <span className={`text-[10px] leading-tight font-body ${isActive ? "font-medium" : ""}`}>
                      {label}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0.5 w-5 h-0.5 rounded-full bg-[hsl(var(--accent))]"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
};

export default StickyBottomNav;
