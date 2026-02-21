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

const CATEGORY_ORDER = ["Lighting", "Seating", "Storage", "Tables", "Rugs", "Decorative Object"];

const SUBCATEGORY_MAP: Record<string, string[]> = {
  "Lighting": ["Chandelier", "Floor Lamp", "Lantern", "Pendant", "Sconce", "Table Lamp", "Wall Light"],
  "Seating": ["Bench", "Chair", "Sofa", "Stool"],
  "Storage": ["Cabinet", "Chest of Drawers", "Console", "Credenza", "Sideboard"],
  "Tables": ["Coffee Table", "Console Table", "Desk", "Dining Table", "Side Table"],
  "Rugs": ["Textile"],
  "Decorative Object": ["Mirror", "Sculpture", "Tableware", "Vase", "Vessel"],
};

const navItems = [...leftNavItems, ...rightNavItems];

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("#home");
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    // All page section IDs in order
    const allSectionIds = ["home", "overview", "gallery", "curating-team", "designers", "collectibles", "brands", "details", "contact"];

    // Map each nav item href to the section(s) it should highlight for
    const sectionToNav: Record<string, string> = {
      home: "#overview",
      overview: "#overview",
      gallery: "#overview",
      "curating-team": "#overview",
      designers: "#designers",
      collectibles: "#collectibles",
      brands: "#brands",
      details: "#details",
      contact: "#details",
    };

    const visibleSections = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleSections.add(entry.target.id);
          } else {
            visibleSections.delete(entry.target.id);
          }
        });

        // Pick the topmost visible section (first in page order)
        const topmost = allSectionIds.find((id) => visibleSections.has(id));
        if (topmost) {
          setActiveSection(sectionToNav[topmost] ?? `#${topmost}`);
        }
      },
      { rootMargin: "-10% 0px -60% 0px", threshold: 0 }
    );

    allSectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
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
        {/* Mobile: single row */}
        <div className="flex h-20 items-center justify-center md:hidden relative">
          <button onClick={scrollToTop} className="group cursor-pointer whitespace-nowrap">
            <span className="font-brand text-[1.4rem] font-medium tracking-widest text-foreground transition-all duration-300 group-hover:text-primary">
              MAISON AFFLUENCY
            </span>
          </button>

          {/* Mobile Hamburger Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-12 w-12 absolute right-0" aria-label="Toggle menu">
                {isOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
              </Button>
            </SheetTrigger>
            
            <SheetContent side="right" className="w-[280px] sm:w-[320px]" aria-describedby={undefined}>
              <div className="sr-only">
                <h2>Navigation Menu</h2>
              </div>
              <div className="flex flex-col gap-6 mt-8">
                {leftNavItems.map((item, index) => (
                  <button 
                    key={item.href} 
                    onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleNavClick(item.href); }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleNavClick(item.href); }}
                    className={cn(
                      "font-serif text-2xl text-left transition-all duration-300 py-3 relative group border-b border-border/30 animate-fade-in opacity-0",
                      activeSection === item.href ? "text-primary" : "text-foreground hover:text-primary hover:[text-shadow:0_0_8px_hsl(var(--primary)/0.3)]"
                    )}
                    style={{ animationDelay: `${index * 120}ms`, animationFillMode: 'forwards' }}
                  >
                    {item.label}
                    <span className={cn(
                      "absolute bottom-2 left-0 h-0.5 bg-primary transition-all duration-300",
                      activeSection === item.href ? "w-full" : "w-0 group-hover:w-full"
                    )} />
                  </button>
                ))}

                {/* Categories dropdown in mobile menu */}
                <div 
                  className="animate-fade-in opacity-0"
                  style={{ animationDelay: `${leftNavItems.length * 120}ms`, animationFillMode: 'forwards' }}
                >
                  <button
                    onClick={() => setCategoriesExpanded(!categoriesExpanded)}
                    className="font-serif text-2xl text-left transition-all duration-300 py-3 relative group border-b border-border/30 w-full flex items-center justify-between text-foreground hover:text-primary"
                  >
                    All Categories
                    <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${categoriesExpanded ? "rotate-180" : ""}`} />
                  </button>
                  {categoriesExpanded && (
                    <div className="flex flex-col gap-1 pl-4 pt-3 pb-2 bg-background border border-border/30 rounded-b-lg shadow-sm">
                      <button
                        onClick={() => { setIsOpen(false); setCategoriesExpanded(false); setExpandedCategory(null); window.dispatchEvent(new CustomEvent('setDesignerCategory', { detail: { category: null, subcategory: null } })); handleNavClick('#designers'); }}
                        className="text-left font-body text-base text-muted-foreground hover:text-primary transition-colors py-1"
                      >
                        All
                      </button>
                      {CATEGORY_ORDER.map(cat => (
                        <div key={cat}>
                          <button
                            onClick={() => {
                              if (expandedCategory === cat) {
                                setExpandedCategory(null);
                              } else {
                                setExpandedCategory(cat);
                              }
                            }}
                            className={`text-left font-body text-base transition-colors py-1.5 w-full flex items-center justify-between ${expandedCategory === cat ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                          >
                            {cat}
                            {SUBCATEGORY_MAP[cat]?.length > 0 && (
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${expandedCategory === cat ? "rotate-180" : ""}`} />
                            )}
                          </button>
                          {expandedCategory === cat && SUBCATEGORY_MAP[cat]?.length > 0 && (
                            <div className="ml-4 mb-2 space-y-0.5 border-l border-border/40 pl-3">
                              <button
                                onClick={() => { setIsOpen(false); setCategoriesExpanded(false); setExpandedCategory(null); window.dispatchEvent(new CustomEvent('setDesignerCategory', { detail: { category: cat, subcategory: null } })); handleNavClick('#designers'); }}
                                className="block text-[11px] uppercase tracking-[0.15em] font-body text-muted-foreground/60 hover:text-primary transition-all duration-300 py-1"
                              >
                                All {cat}
                              </button>
                              {SUBCATEGORY_MAP[cat].map(sub => (
                                <button
                                  key={sub}
                                  onClick={() => { setIsOpen(false); setCategoriesExpanded(false); setExpandedCategory(null); window.dispatchEvent(new CustomEvent('setDesignerCategory', { detail: { category: cat, subcategory: sub } })); handleNavClick('#designers'); }}
                                  className="block text-[11px] uppercase tracking-[0.15em] font-body text-muted-foreground/60 hover:text-primary transition-all duration-300 py-1"
                                >
                                  {sub}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div 
                  className="pt-4 border-t border-border/50 animate-fade-in opacity-0"
                  style={{ animationDelay: `${leftNavItems.length * 120}ms`, animationFillMode: 'forwards' }}
                >
                  {rightNavItems.map((item) => (
                    <button 
                      key={item.href} 
                      onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleNavClick(item.href); }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleNavClick(item.href); }}
                      className="font-serif text-2xl text-left transition-all duration-300 px-4 py-2 border border-foreground rounded-sm bg-foreground text-background hover:bg-foreground/90 w-full"
                    >
                      
                      {item.label}
                    </button>
                  ))}
                </div>
                
                <div 
                  className="pt-4 border-t border-border/30 animate-fade-in opacity-0"
                  style={{ animationDelay: `${(leftNavItems.length + 1) * 120}ms`, animationFillMode: 'forwards' }}
                >
                  <p className="font-serif text-xl text-foreground mb-4">Contact Us</p>
                  <div className="flex flex-col gap-3">
                    {contactOptions.map((option, index) => (
                      <button
                        key={option.label}
                        onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); option.action(); }}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); option.action(); }}
                        className="flex items-center gap-3 text-left font-body text-base text-muted-foreground hover:text-primary transition-colors animate-fade-in opacity-0"
                        style={{ animationDelay: `${(leftNavItems.length + 2 + index) * 120}ms`, animationFillMode: 'forwards' }}
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

        {/* Desktop: stacked layout */}
        <div className="hidden md:flex flex-col items-center">
          {/* Top row: Trade Program | MAISON AFFLUENCY | Contact Us */}
          <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center pt-4 pb-2">
            <div className="flex justify-start">
              {rightNavItems.map((item) => (
                <button 
                  key={item.href} 
                  onClick={() => handleNavClick(item.href)} 
                  className="font-body text-xs uppercase tracking-[0.2em] transition-all duration-300 whitespace-nowrap px-3 py-1.5 border border-foreground rounded-sm bg-foreground text-background hover:bg-foreground/90"
                >
                  
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col items-center">
              <button onClick={scrollToTop} className="group cursor-pointer whitespace-nowrap">
                <span className="font-brand text-3xl lg:text-4xl font-medium tracking-[0.25em] text-foreground transition-all duration-300 group-hover:text-primary">
                  MAISON AFFLUENCY
                </span>
              </button>
              <div className="flex items-center gap-3 mt-1">
                <span className="h-px w-10 bg-foreground/30" />
                <span className="font-body text-[9px] uppercase tracking-[0.3em] text-foreground/50">Since 2017</span>
                <span className="h-px w-10 bg-foreground/30" />
              </div>
            </div>
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger className="font-body text-xs uppercase tracking-[0.2em] transition-all duration-300 text-foreground/70 hover:text-primary hover:[text-shadow:0_0_8px_hsl(var(--primary)/0.3)] flex items-center gap-1 whitespace-nowrap outline-none">
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
          </div>

          <div className="flex items-center gap-5 lg:gap-8 pb-3">
            {leftNavItems.map((item) => (
              <button 
                key={item.href} 
                onClick={() => handleNavClick(item.href)} 
                className={cn(
                  "font-body text-xs uppercase tracking-[0.2em] transition-all duration-300 relative group whitespace-nowrap",
                  activeSection === item.href 
                    ? "text-primary font-medium"
                    : "text-foreground/70 hover:text-primary hover:[text-shadow:0_0_8px_hsl(var(--primary)/0.3)]"
                )}
              >
                {item.label}
                <span className={cn(
                  "absolute -bottom-1 left-0 h-0.5 bg-primary transition-all duration-300",
                  activeSection === item.href ? "w-full" : "w-0 group-hover:w-full"
                )} />
              </button>
            ))}

            {/* Categories dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="font-body text-xs uppercase tracking-[0.2em] transition-all duration-300 text-foreground/70 hover:text-primary hover:[text-shadow:0_0_8px_hsl(var(--primary)/0.3)] flex items-center gap-1 whitespace-nowrap outline-none relative group">
                Categories
                <ChevronDown className="h-3 w-3" />
                <span className="absolute -bottom-1 left-0 h-0.5 bg-primary transition-all duration-300 w-0 group-hover:w-full" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="bg-background border border-border shadow-lg z-50 min-w-[220px] max-h-[70vh] overflow-y-auto">
                <DropdownMenuItem
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('setDesignerCategory', { detail: { category: null, subcategory: null } }));
                    handleNavClick('#designers');
                  }}
                  className="px-4 py-2 cursor-pointer hover:bg-muted transition-colors font-body text-[10px] uppercase tracking-[0.2em]"
                >
                  All Categories
                </DropdownMenuItem>
                {CATEGORY_ORDER.map(cat => (
                  <div key={cat}>
                    <DropdownMenuItem
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('setDesignerCategory', { detail: { category: cat, subcategory: null } }));
                        handleNavClick('#designers');
                      }}
                      className="px-4 py-2 cursor-pointer hover:bg-muted transition-colors font-body text-[10px] uppercase tracking-[0.2em] font-medium"
                    >
                      {cat}
                    </DropdownMenuItem>
                    {SUBCATEGORY_MAP[cat]?.map(sub => (
                      <DropdownMenuItem
                        key={sub}
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('setDesignerCategory', { detail: { category: cat, subcategory: sub } }));
                          handleNavClick('#designers');
                        }}
                        className="pl-8 pr-4 py-1.5 cursor-pointer hover:bg-muted transition-colors font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
                      >
                        {sub}
                      </DropdownMenuItem>
                    ))}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>;
};
export default Navigation;