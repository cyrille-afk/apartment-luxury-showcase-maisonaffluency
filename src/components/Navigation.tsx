import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import affluencyLogo from "@/assets/affluency-logo.png";
const navItems = [{
  label: "Home",
  href: "#home"
}, {
  label: "Overview",
  href: "#overview"
}, {
  label: "Gallery",
  href: "#gallery"
}, {
  label: "Design Details",
  href: "#details"
}, {
  label: "Contact",
  href: "#contact"
}];
const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const handleNavClick = (href: string) => {
    setIsOpen(false);
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  };
  return <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/50">
      <div className="mx-auto max-w-7xl px-4 md:px-12 lg:px-20">
        <div className="flex h-16 md:h-20 items-center justify-between">
          {/* Logo/Brand */}
          <button onClick={() => handleNavClick("#home")} className="hover:opacity-80 transition-opacity">
            <span className="font-serif text-base text-foreground font-extrabold md:text-xl text-center">
              Maison Affluency
            </span>
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map(item => <button key={item.href} onClick={() => handleNavClick(item.href)} className="font-body text-sm uppercase tracking-wider text-foreground/80 hover:text-primary transition-colors">
                {item.label}
              </button>)}
          </div>

          {/* Mobile Hamburger Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="h-12 w-12" aria-label="Toggle menu">
                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </SheetTrigger>
            
            <SheetContent side="right" className="w-[280px] sm:w-[320px]">
              <div className="flex flex-col gap-6 mt-8">
                {navItems.map(item => <button key={item.href} onClick={() => handleNavClick(item.href)} className="font-serif text-2xl text-left text-foreground hover:text-primary transition-colors py-3 border-b border-border/30">
                    {item.label}
                  </button>)}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>;
};
export default Navigation;