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

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed right-4 bottom-20 md:right-6 md:bottom-24 z-50"
        >
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
          className={`relative flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all duration-300 touch-manipulation ${
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
              <X className="h-5 w-5" />
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
