import { scrollToSection } from "@/lib/scrollToSection";
import InstallAppDialog from "@/components/InstallAppDialog";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer
      className="relative z-0 mb-0 bg-background px-4 pb-0 pt-12 md:px-8 md:pb-0 md:pt-16"
    >
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="px-2 py-1 text-center">
          <span className="font-body text-[9px] font-light uppercase tracking-[0.18em] text-muted-foreground">
            By using this site you agree to our{" "}
            <a href="/privacy" className="underline decoration-border underline-offset-2 transition-colors hover:text-foreground">Privacy Policy</a>
            {" "}&{" "}
            <a href="/terms" className="underline decoration-border underline-offset-2 transition-colors hover:text-foreground">Terms of Service</a>
            {" "}·{" "}
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent("ma-open-consent"));
              }}
              className="underline decoration-border underline-offset-2 transition-colors hover:text-foreground"
            >
              Cookie Settings
            </button>
          </span>
        </div>

        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between md:items-center">
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

        <div className="border-t border-border pt-8 flex flex-col items-center gap-3">
          <p className="mb-0 font-body text-xs text-muted-foreground text-center">
            <span className="block">© {currentYear} Affluency ETC Pte Ltd.</span>
            <span className="block">All rights reserved.</span>
            <span className="block">For professional use only.</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
