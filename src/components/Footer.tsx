import { Instagram } from "lucide-react";
import { trackCTA } from "@/lib/analytics";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { scrollToSection } from "@/lib/scrollToSection";
const affluencyLogo = cloudinaryUrl("affluency-footer-logo_gvpt4u", { width: 800, quality: "auto", crop: "fill" });
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-border bg-background px-6 py-12 md:px-12 lg:px-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center gap-6">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={scrollToTop} className="group cursor-pointer" aria-label="Scroll to top">
                  <img 
                    alt="Affluency - Unique by Design" 
                    className="h-14 md:h-16 w-auto transition-all duration-300 group-hover:scale-105 group-hover:[filter:drop-shadow(0_0_8px_hsl(var(--primary)/0.4))_drop-shadow(0_0_20px_hsl(var(--primary)/0.2))]" 
                    src={affluencyLogo} 
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Back to top</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <div className="flex gap-8 items-center">
            <button onClick={() => scrollToSection("curating-team")} className="font-body text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
              About Us
            </button>
            <a href="/journal" className="font-body text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
              Journal
            </a>
            <a href="https://www.instagram.com/myaffluency/?hl=en" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Maison Affluency on Instagram" onClick={() => trackCTA.instagram("Footer", "Maison Affluency")}>
              <Instagram size={20} />
            </a>
            <button onClick={() => scrollToSection("contact")} className="font-body text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
              Contact
            </button>
          </div>
        </div>
        
        <div className="mt-8 border-t border-border pt-8 text-center">
          <p className="font-body text-xs text-muted-foreground">© 2026 Affluency ETC Pte Ltd. All rights reserved. For professional use only.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
