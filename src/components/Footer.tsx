import { Instagram } from "lucide-react";
import { trackCTA } from "@/lib/analytics";
import { scrollToSection } from "@/lib/scrollToSection";

const Footer = () => {
  return (
    <>
      <div className="border-t border-accent/20 bg-foreground/95 backdrop-blur-sm px-6 py-3 text-center">
        <span className="font-body text-xs uppercase tracking-[0.15em] text-background/80">
          By using this site you agree to our{" "}
          <a href="/privacy" className="text-background underline underline-offset-2 hover:text-accent transition-colors">Privacy Policy</a>
          {" "}&{" "}
          <a href="/terms" className="text-background underline underline-offset-2 hover:text-accent transition-colors">Terms of Service</a>
        </span>
      </div>
      <footer className="border-t border-border bg-background px-6 py-12 md:px-12 lg:px-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center gap-6">
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
        
        <div className="mt-8 border-t border-border pt-8 flex flex-col items-center gap-3">
          <p className="font-body text-xs text-muted-foreground">© 2026 Affluency ETC Pte Ltd. All rights reserved. For professional use only.</p>
        </div>
      </div>
    </footer>
    </>
  );
};

export default Footer;