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
  ChevronUp
} from "lucide-react";

const sections = [
  { id: "home", label: "Home", icon: Home },
  { id: "overview", label: "Overview", icon: FileText },
  { id: "gallery", label: "Gallery", icon: Image },
  { id: "curating-team", label: "Team", icon: Users },
  { id: "designers", label: "Designers", icon: Palette },
  { id: "brands", label: "Brands", icon: Building2 },
  { id: "details", label: "Trade", icon: FileText },
  { id: "contact", label: "Contact", icon: Mail },
];

const QuickJumpMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show menu only after scrolling past the hero section (full viewport height)
      // This keeps it hidden when the main navigation is most prominent
      setIsVisible(window.scrollY > window.innerHeight);

      // Determine active section
      const scrollPosition = window.scrollY + window.innerHeight / 3;
      
      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i].id);
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(sections[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      // Trigger haptic feedback on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
      element.scrollIntoView({ behavior: "smooth" });
      setIsOpen(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed right-4 bottom-6 md:right-6 md:bottom-24 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-14 right-0 mb-2 bg-card/95 backdrop-blur-md border border-border/40 rounded-xl shadow-lg overflow-hidden min-w-[140px]"
          >
            <div className="py-2">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-body transition-colors duration-200 touch-manipulation ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
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

      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.95 }}
        className={`flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-colors duration-300 touch-manipulation ${
          isOpen
            ? "bg-primary text-primary-foreground"
            : "bg-card/95 backdrop-blur-md border border-border/40 text-foreground hover:bg-card"
        }`}
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="h-5 w-5" />
            </motion.div>
          ) : (
            <motion.div
              key="menu"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <ChevronUp className="h-5 w-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
};

export default QuickJumpMenu;
