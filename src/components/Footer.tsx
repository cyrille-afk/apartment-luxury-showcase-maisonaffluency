import { Instagram, Linkedin, Facebook } from "lucide-react";

const Footer = () => {
  return <footer className="border-t border-border bg-background px-6 py-12 md:px-12 lg:px-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-3">
              <img alt="Affluency" className="h-10 md:h-12 w-auto" src="/lovable-uploads/18ec40c0-d3d8-423e-bf58-8a0f98938aeb.jpg" />
              <span className="font-serif text-base font-bold text-foreground">
                Maison Affluency
              </span>
            </div>
            <p className="font-body text-sm text-muted-foreground text-center md:text-left">
              Professional Design Portfolio
            </p>
            <a href="tel:+6591393850" className="font-body text-sm text-primary hover:text-primary/80 transition-colors">
              +65 9139 3850
            </a>
            <div className="flex gap-4 mt-2">
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Instagram">
                <Instagram size={20} />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" aria-label="LinkedIn">
                <Linkedin size={20} />
              </a>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Facebook">
                <Facebook size={20} />
              </a>
            </div>
          </div>
          
          <div className="flex gap-8">
            <a href="#" className="font-body text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
              Specifications
            </a>
            <a className="font-body text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground" href="https://thierry-lemaire.fr/en/">
              Designers
            </a>
            <a href="#" className="font-body text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
              Contact
            </a>
          </div>
        </div>
        
        <div className="mt-8 border-t border-border pt-8 text-center">
          <p className="font-body text-xs text-muted-foreground">© 2026 Affluency ETC Pte Ltd. All rights reserved. For professional use only.</p>
        </div>
      </div>
    </footer>;
};
export default Footer;