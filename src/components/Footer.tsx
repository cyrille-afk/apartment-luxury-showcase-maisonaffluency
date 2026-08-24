import { scrollToSection } from "@/lib/scrollToSection";
import InstallAppDialog from "@/components/InstallAppDialog";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer
      className="bg-background px-4 md:px-8 py-12 md:py-16 pb-[calc(env(safe-area-inset-bottom)+2rem)]"
    >
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Floating privacy / cookie banner */}
        <div className="rounded-lg bg-foreground/95 backdrop-blur-sm px-6 py-4 shadow-lg text-center">
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

        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
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
          <p className="mb-8 font-body text-xs text-muted-foreground text-center">
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
