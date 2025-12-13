import { useState, useEffect } from "react";
import { Menu, X, Crown } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import logoIcon from "@/assets/affluency-logo-icon.jpeg";

const navItems = [{
  label: "Home",
  href: "#home"
}, {
  label: "Gallery",
  href: "#overview"
}, {
  label: "Designers",
  href: "#designers"
}, {
  label: "Collectibles",
  href: "/collectibles",
  isPage: true
}, {
  label: "Ateliers",
  href: "#brands"
}, {
  label: "Trade Program",
  href: "#details"
}, {
  label: "Contact",
  href: "#contact"
}];

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("#home");

  useEffect(() => {
    const sectionIds = navItems.filter(item => !item.isPage).map(item => item.href.replace("#", ""));
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(`#${entry.target.id}`);
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );

    sectionIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
        <div className="flex h-20 md:h-20 items-center justify-center md:justify-between relative">
          {/* Logo/Brand */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={scrollToTop} className="group cursor-pointer flex items-center gap-2 whitespace-nowrap">
                  <img src={logoIcon} alt="Affluency Logo" className="h-9 md:h-9 w-auto" />
                  <span className="font-serif text-lg md:text-xl font-extrabold text-foreground transition-all duration-300 group-hover:text-primary group-hover:[text-shadow:0_0_8px_hsl(var(--primary)/0.4),0_0_20px_hsl(var(--primary)/0.2)]">
                    Maison Affluency
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Back to top</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-5 ml-8">
            {navItems.map((item) => {
              const isTradeProgram = item.href === "#details";
              const isContact = item.href === "#contact";
              
              if (item.isPage) {
                return (
                  <Link 
                    key={item.href}
                    to={item.href}
                    className="font-body text-sm uppercase tracking-wider transition-all duration-300 relative group whitespace-nowrap text-foreground/80 hover:text-primary hover:[text-shadow:0_0_8px_hsl(var(--primary)/0.3)]"
                  >
                    {item.label}
                    <span className="absolute -bottom-1 left-0 h-0.5 bg-primary transition-all duration-300 w-0 group-hover:w-full" />
                  </Link>
                );
              }
              
              return (
                <button 
                  key={item.href} 
                  onClick={() => handleNavClick(item.href)} 
                  className={cn(
                    "font-body uppercase tracking-wider transition-all duration-300 relative group whitespace-nowrap",
                    isContact ? "text-xs" : "text-sm",
                    isTradeProgram && "px-3 py-1.5 border border-foreground rounded-sm bg-foreground text-background hover:bg-foreground/90",
                    activeSection === item.href 
                      ? isTradeProgram ? "text-background font-medium" : "text-primary font-medium"
                      : isTradeProgram
                        ? "text-background"
                        : "text-foreground/80 hover:text-primary hover:[text-shadow:0_0_8px_hsl(var(--primary)/0.3)]"
                  )}
                >
                  {isTradeProgram && <Crown className="inline-block w-3.5 h-3.5 mr-1.5" />}
                  {item.label}
                  {!isTradeProgram && (
                    <span className={cn(
                      "absolute -bottom-1 left-0 h-0.5 bg-primary transition-all duration-300",
                      activeSection === item.href 
                        ? "w-full" 
                        : "w-0 group-hover:w-full"
                    )} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Mobile Hamburger Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="h-12 w-12 absolute right-0" aria-label="Toggle menu">
                {isOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
              </Button>
            </SheetTrigger>
            
            <SheetContent side="right" className="w-[280px] sm:w-[320px]">
              <div className="flex flex-col gap-6 mt-8">
                {navItems.map((item) => {
                  const isTradeProgram = item.href === "#details";
                  
                  if (item.isPage) {
                    return (
                      <Link 
                        key={item.href}
                        to={item.href}
                        onClick={() => setIsOpen(false)}
                        className="font-serif text-2xl text-left transition-all duration-300 py-3 relative group border-b border-border/30 text-foreground hover:text-primary block"
                      >
                        {item.label}
                        <span className="absolute bottom-2 left-0 h-0.5 bg-primary transition-all duration-300 w-0 group-hover:w-full" />
                      </Link>
                    );
                  }
                  
                  return (
                    <button 
                      key={item.href} 
                      onClick={() => handleNavClick(item.href)} 
                      className={cn(
                        "font-serif text-2xl text-left transition-all duration-300 py-3 relative group",
                        !isTradeProgram && "border-b border-border/30",
                        isTradeProgram && "px-4 py-2 mt-2 border border-foreground rounded-sm bg-foreground text-background hover:bg-foreground/90",
                        activeSection === item.href 
                          ? isTradeProgram ? "text-background" : "text-primary"
                          : isTradeProgram
                            ? "text-background"
                            : "text-foreground hover:text-primary hover:[text-shadow:0_0_8px_hsl(var(--primary)/0.3)]"
                      )}
                    >
                      {isTradeProgram && <Crown className="inline-block w-5 h-5 mr-2" />}
                      {item.label}
                      {!isTradeProgram && (
                        <span className={cn(
                          "absolute bottom-2 left-0 h-0.5 bg-primary transition-all duration-300",
                          activeSection === item.href 
                            ? "w-full" 
                            : "w-0 group-hover:w-full"
                        )} />
                      )}
                    </button>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>;
};
export default Navigation;