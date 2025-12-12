import { Instagram } from "lucide-react";
import affluencyLogo from "@/assets/affluency-logo-new.jpg";
const Footer = () => {
  return <footer className="border-t border-border bg-background px-6 py-12 md:px-12 lg:px-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center gap-6">
          <a href="https://www.instagram.com/myaffluency/?hl=en" target="_blank" rel="noopener noreferrer" className="group">
            <img alt="Affluency - Unique by Design" className="h-10 md:h-12 w-auto transition-all duration-300 group-hover:scale-105 group-hover:[filter:drop-shadow(0_0_8px_hsl(var(--primary)/0.4))_drop-shadow(0_0_20px_hsl(var(--primary)/0.2))]" src={affluencyLogo} />
          </a>
          
          <div className="flex gap-8 items-center">
            <a href="#curating-team" className="font-body text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
              About Us
            </a>
            <a href="https://www.instagram.com/myaffluency/?hl=en" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" aria-label="Instagram">
              <Instagram size={20} />
            </a>
            <a href="#contact" className="font-body text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
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