import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Home, 
  Image, 
  Users, 
  Palette, 
  Building2, 
  FileText, 
  Mail,
  Menu,
  X,
  ChevronUp,
  Gem
} from "lucide-react";
import { scrollToSection as scrollToSectionUtil } from "@/lib/scrollToSection";

const sections = [
  { id: "home", label: "Home", icon: Home },
  { id: "overview", label: "Overview", icon: FileText },
  { id: "gallery", label: "Gallery", icon: Image },
  { id: "curating-team", label: "Team", icon: Users },
  { id: "designers", label: "Designers", icon: Palette },
  { id: "collectibles", label: "Collectible Design", icon: Gem },
  { id: "brands", label: "Ateliers", icon: Building2 },
  { id: "details", label: "Trade", icon: FileText },
  { id: "contact", label: "Contact", icon: Mail },
];

// Map active section to a desktop vertical position (CSS top value)
const sectionPositionMap: Record<string, string> = {
  gallery: "75%",
  "sociable-environment": "75%",
};
const defaultDesktopTop = "75%";

const QuickJumpMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [isVisible, setIsVisible] = useState(false);
  

  // Use IntersectionObserver for active section tracking (no forced reflow)
  useEffect(() => {
    const visibleSections = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleSections.set(entry.target.id, entry.intersectionRatio);
          } else {
            visibleSections.delete(entry.target.id);
          }
        });

        // Pick the last visible section in page order
        let current: string | undefined;
        for (const s of sections) {
          if (visibleSections.has(s.id)) current = s.id;
        }
        if (current) setActiveSection(current);
      },
      { rootMargin: "-20% 0px -50% 0px", threshold: 0 }
    );

    // Show FAB after a slight scroll (~150px) instead of waiting for entire hero to pass
    const handleScroll = () => {
      setIsVisible(window.scrollY > 150);
    };
    handleScroll(); // check initial position
    window.addEventListener("scroll", handleScroll, { passive: true });

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });


    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleScrollTo = (sectionId: string) => {
    // Trigger haptic feedback on mobile
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    scrollToSectionUtil(sectionId);
    setIsOpen(false);
  };

  const desktopTop = sectionPositionMap[activeSection] || defaultDesktopTop;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed right-6 bottom-auto z-50 hidden md:block"
          data-quick-jump
        >
          {/* Desktop dynamic positioning via inline style */}
          <style>{`
            @media (min-width: 768px) {
              [data-quick-jump] {
                top: ${desktopTop} !important;
                bottom: auto !important;
                transform: translateY(-50%);
                transition: top 0.4s ease;
              }
            }
          `}</style>
          <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-12 right-0 mb-2 bg-card/95 backdrop-blur-md border border-border/40 rounded-xl shadow-lg overflow-hidden min-w-[130px]"
          >
            <div className="py-2">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => handleScrollTo(section.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-body transition-colors duration-200 touch-manipulation ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{section.label}</span>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative group">
        
        {/* Glow effect */}
        <div className={`absolute inset-0 rounded-full transition-all duration-300 ${
          isOpen 
            ? 'bg-primary/30 blur-xl scale-150' 
            : 'bg-primary/20 blur-lg scale-125 group-hover:bg-primary/30 group-hover:scale-150'
        }`} />
        
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          className={`relative flex items-center justify-center w-[52px] h-[52px] rounded-full shadow-2xl transition-all duration-300 touch-manipulation ${
            isOpen
              ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-primary/30"
              : "bg-gradient-to-br from-card to-card/90 backdrop-blur-md border border-primary/30 text-primary hover:border-primary/50 hover:shadow-primary/20"
          }`}
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <X className="h-4 w-4" />
            </motion.div>
          ) : (
            <motion.div
              key="menu"
              initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex flex-col items-center gap-0.5"
            >
              <span className="w-4 h-0.5 bg-current rounded-full" />
              <span className="w-3 h-0.5 bg-current rounded-full" />
              <span className="w-4 h-0.5 bg-current rounded-full" />
            </motion.div>
          )}
        </AnimatePresence>
        </motion.button>
      </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default QuickJumpMenu;
