import { useState } from "react";
import { useLocation } from "react-router-dom";
import { scrollToSection } from "@/lib/scrollToSection";
import InstallAppDialog from "@/components/InstallAppDialog";
import PrivateTourDialog from "@/components/PrivateTourDialog";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const [tourOpen, setTourOpen] = useState(false);
  const location = useLocation();
  const isGallery = location.pathname === "/gallery";
  return (
    <>
      <div className="border-t border-accent/20 bg-foreground/95 backdrop-blur-sm px-6 py-3 text-center">
        <span className="font-body text-xs uppercase tracking-[0.15em] text-background/80">
          By using this site you agree to our{" "}
           <a href="/privacy" className="text-background underline underline-offset-2 hover:text-accent transition-colors">Privacy Policy</a>
           {" "}&{" "}
           <a href="/terms" className="text-background underline underline-offset-2 hover:text-accent transition-colors">Terms of Service</a>
           {" "}·{" "}
           <button
             onClick={() => {
               localStorage.removeItem("cookie_consent");
               localStorage.removeItem("ga_optout");
               window.location.reload();
             }}
             className="text-background underline underline-offset-2 hover:text-accent transition-colors"
           >
             Cookie Settings
           </button>
        </span>
      </div>
      <footer
        className="border-t border-border bg-background px-6 py-12 md:px-12 lg:px-20"
        style={{ paddingBottom: "calc(3rem + env(safe-area-inset-bottom))" }}
      >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center gap-6">
          {!isGallery && (
            <button
              onClick={() => setTourOpen(true)}
              className="min-h-12 px-8 py-3.5 bg-background text-foreground font-body text-sm uppercase tracking-[0.2em] border border-[hsl(var(--accent))] rounded-full shadow-[0_0_8px_hsl(var(--accent)/0.3)] hover:shadow-[0_0_14px_hsl(var(--accent)/0.5)] transition-all duration-300"
            >
              Request a Private Tour
            </button>
          )}
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-4 items-center">
            <button onClick={() => scrollToSection("curating-team")} className="font-body text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
              About Us
            </button>
            <a href="/journal" className="font-body text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
              Journal
            </a>
            <button onClick={() => scrollToSection("contact")} className="font-body text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
              Contact
            </button>
            <InstallAppDialog />
          </div>
        </div>
        
        <div className="mt-8 border-t border-border pt-8 flex flex-col items-center gap-3">
          <p className="font-body text-xs text-muted-foreground text-center">
            <span className="block">© {currentYear} Affluency ETC Pte Ltd.</span>
            <span className="block">All rights reserved.</span>
            <span className="block">For professional use only.</span>
          </p>
        </div>
      </div>
    </footer>
    <PrivateTourDialog open={tourOpen} onOpenChange={setTourOpen} />
    </>
  );
};

export default Footer;