import { useState, useEffect } from "react";
import { Menu, X, Crown, Search, ChevronDown, Calendar, MessageCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logoIcon from "@/assets/affluency-logo-icon.jpeg";

const leftNavItems = [{
  label: "Gallery",
  href: "#overview"
}, {
  label: "Designers",
  href: "#designers"
}, {
  label: "Collectibles",
  href: "#collectibles"
}, {
  label: "Ateliers",
  href: "#brands"
}];

const rightNavItems = [{
  label: "Trade Program",
  href: "#details"
}];

const contactOptions = [
  { 
    label: "Book an Appointment", 
    icon: Calendar,
    action: () => {
      const contactSection = document.getElementById('contact');
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  },
  { 
    label: "WhatsApp", 
    icon: MessageCircle,
    action: () => {
      window.open('https://wa.me/6591393850', '_blank');
    }
  },
  { 
    label: "concierge@myaffluency.com", 
    icon: Mail,
    action: () => {
      window.location.href = 'mailto:concierge@myaffluency.com';
    }
  },
];

const navItems = [...leftNavItems, ...rightNavItems];

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("#home");

  useEffect(() => {
    const sectionIds = navItems.map(item => item.href.replace("#", ""));
    
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
          {/* Left Navigation Items */}
          <div className="hidden md:flex items-center gap-3 lg:gap-4 flex-1 justify-start">
            {leftNavItems.map((item) => (
              <button 
                key={item.href} 
                onClick={() => handleNavClick(item.href)} 
                className={cn(
                  "font-body text-sm uppercase tracking-wider transition-all duration-300 relative group whitespace-nowrap",
                  activeSection === item.href 
                    ? "text-primary font-medium"
                    : "text-foreground/80 hover:text-primary hover:[text-shadow:0_0_8px_hsl(var(--primary)/0.3)]"
                )}
              >
                {item.label}
                <span className={cn(
                  "absolute -bottom-1 left-0 h-0.5 bg-primary transition-all duration-300",
                  activeSection === item.href 
                    ? "w-full" 
                    : "w-0 group-hover:w-full"
                )} />
              </button>
            ))}
          </div>

          {/* Brand - Center (absolutely positioned on desktop for true centering) */}
          <div className="md:absolute md:left-1/2 md:-translate-x-1/2 z-10">
            <button onClick={scrollToTop} className="group cursor-pointer whitespace-nowrap">
              <span className="font-brand text-[1.4rem] md:text-2xl font-medium tracking-widest text-foreground transition-all duration-300 group-hover:text-primary">
                MAISON AFFLUENCY
              </span>
            </button>
          </div>

          {/* Right Navigation Items */}
          <div className="hidden md:flex items-center gap-3 lg:gap-4 flex-1 justify-end">
            {rightNavItems.map((item) => {
              const isTradeProgram = item.href === "#details";
              
              return (
                <button 
                  key={item.href} 
                  onClick={() => handleNavClick(item.href)} 
                  className={cn(
                    "font-body text-sm uppercase tracking-wider transition-all duration-300 relative group whitespace-nowrap",
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
            
            {/* Contact Us Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="font-body text-xs uppercase tracking-wider transition-all duration-300 text-foreground/80 hover:text-primary hover:[text-shadow:0_0_8px_hsl(var(--primary)/0.3)] flex items-center gap-1 whitespace-nowrap outline-none">
                Contact Us
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background border border-border shadow-lg z-50 min-w-[220px]">
                {contactOptions.map((option) => (
                  <DropdownMenuItem 
                    key={option.label}
                    onClick={option.action}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted transition-colors"
                  >
                    <option.icon className="h-4 w-4 text-primary" />
                    <span className="font-body text-sm">{option.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Hamburger Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="h-12 w-12 absolute right-0" aria-label="Toggle menu">
                {isOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
              </Button>
            </SheetTrigger>
            
            <SheetContent side="right" className="w-[280px] sm:w-[320px]" aria-describedby={undefined}>
              <div className="sr-only">
                <h2>Navigation Menu</h2>
              </div>
              <div className="flex flex-col gap-6 mt-8">
                {/* Main Navigation Items */}
                {leftNavItems.map((item, index) => (
                  <button 
                    key={item.href} 
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleNavClick(item.href);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleNavClick(item.href);
                    }}
                    className={cn(
                      "font-serif text-2xl text-left transition-all duration-300 py-3 relative group border-b border-border/30 animate-fade-in opacity-0",
                      activeSection === item.href 
                        ? "text-primary"
                        : "text-foreground hover:text-primary hover:[text-shadow:0_0_8px_hsl(var(--primary)/0.3)]"
                    )}
                    style={{ 
                      animationDelay: `${index * 120}ms`,
                      animationFillMode: 'forwards'
                    }}
                  >
                    {item.label}
                    <span className={cn(
                      "absolute bottom-2 left-0 h-0.5 bg-primary transition-all duration-300",
                      activeSection === item.href 
                        ? "w-full" 
                        : "w-0 group-hover:w-full"
                    )} />
                  </button>
                ))}
                
                {/* Trade Program Section */}
                <div 
                  className="pt-4 border-t border-border/50 animate-fade-in opacity-0"
                  style={{ 
                    animationDelay: `${leftNavItems.length * 120}ms`,
                    animationFillMode: 'forwards'
                  }}
                >
                  {rightNavItems.map((item) => (
                    <button 
                      key={item.href} 
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleNavClick(item.href);
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleNavClick(item.href);
                      }}
                      className="font-serif text-2xl text-left transition-all duration-300 px-4 py-2 border border-foreground rounded-sm bg-foreground text-background hover:bg-foreground/90 w-full"
                    >
                      <Crown className="inline-block w-5 h-5 mr-2" />
                      {item.label}
                    </button>
                  ))}
                </div>
                
                {/* Contact Us Section */}
                <div 
                  className="pt-4 border-t border-border/30 animate-fade-in opacity-0"
                  style={{ 
                    animationDelay: `${(leftNavItems.length + 1) * 120}ms`,
                    animationFillMode: 'forwards'
                  }}
                >
                  <p className="font-serif text-xl text-foreground mb-4">Contact Us</p>
                  <div className="flex flex-col gap-3">
                    {contactOptions.map((option, index) => (
                      <button
                        key={option.label}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsOpen(false);
                          option.action();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsOpen(false);
                          option.action();
                        }}
                        className="flex items-center gap-3 text-left font-body text-base text-muted-foreground hover:text-primary transition-colors animate-fade-in opacity-0"
                        style={{ 
                          animationDelay: `${(leftNavItems.length + 2 + index) * 120}ms`,
                          animationFillMode: 'forwards'
                        }}
                      >
                        <option.icon className="h-5 w-5 text-primary" />
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>;
};
export default Navigation;