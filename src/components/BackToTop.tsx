import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const BackToTop = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // Show button after scrolling past the hero section (full viewport height)
      if (window.scrollY > window.innerHeight) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-8 right-8 md:bottom-10 md:right-10 z-50"
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={scrollToTop}
                  className="p-3 bg-primary text-primary-foreground rounded-full shadow-lg border-2 border-[hsl(var(--gold))] hover:bg-primary/90 hover:shadow-[0_0_0_2px_hsl(var(--gold)/0.5)] transition-all duration-300 group"
                  aria-label="Back to top"
                >
                  <ArrowUp className="h-5 w-5 group-hover:-translate-y-0.5 transition-transform duration-200" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-foreground text-background">
                <p>Back to top</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BackToTop;
