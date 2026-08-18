import { scrollToSection } from "@/lib/scrollToSection";
import InstallAppDialog from "@/components/InstallAppDialog";

const Footer = () => {
  const currentYear = new Date().getFullYear();
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
    </>
  );
};

export default Footer;