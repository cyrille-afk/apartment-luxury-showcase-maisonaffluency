import { useState, useEffect, useRef } from "react";
import { Menu, X, Crown, Search, ChevronDown, ChevronRight, Calendar, MessageCircle, Mail } from "lucide-react";
import { trackCTA } from "@/lib/analytics";
import { scrollToSection } from "@/lib/scrollToSection";
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
import { cloudinaryUrl } from "@/lib/cloudinary";
const logoIcon = cloudinaryUrl("affluency-logo-icon_mpchum", { width: 200, quality: "auto", crop: "fill" });

const leftNavItems = [{
  label: "Gallery",
  mobileLabel: "Gallery",
  href: "#overview"
}, {
  label: "Designers",
  mobileLabel: "Designers & Makers",
  mobileSubtitle: "in situ",
  href: "#designers"
}, {
  label: "Collectible Design",
  mobileLabel: "Collectible Design",
  mobileSubtitle: "in situ",
  href: "#collectibles"
}, {
  label: "Ateliers",
  mobileLabel: "Ateliers & Partners",
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
      trackCTA.bookAppointment("Navigation");
      scrollToSection("contact");
    }
  },
  { 
    label: "WhatsApp", 
    icon: MessageCircle,
    action: () => {
      trackCTA.whatsapp("Navigation");
      window.open('https://wa.me/6591393850', '_blank');
    }
  },
  { 
    label: "concierge@myaffluency.com", 
    icon: Mail,
    action: () => {
      trackCTA.email("Navigation");
      window.location.href = 'mailto:concierge@myaffluency.com';
    }
  },
];

const CATEGORY_ORDER = ["Seating", "Tables", "Lighting", "Storage", "Rugs", "Décor"];

const SUBCATEGORY_MAP: Record<string, string[]> = {
  "Seating": ["Sofas", "Armchairs", "Chairs", "Daybeds & Benches", "Ottomans & Stools", "Bar Stools"],
  "Tables": ["Consoles", "Coffee Tables", "Desks", "Dining Tables", "Side Tables"],
  "Storage": ["Bookcases", "Cabinets"],
  "Lighting": ["Wall Lights", "Ceiling Lights", "Floor Lights", "Table Lights"],
  "Rugs": ["Hand-Knotted Rugs", "Hand-Tufted Rugs", "Hand-Woven Rugs"],
  "Décor": ["Vases & Vessels", "Mirrors", "Books", "Candle Holders", "Decorative Objects"],
};

const navItems = [...leftNavItems, ...rightNavItems];

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("#home");
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [contactExpanded, setContactExpanded] = useState(false);
  const [megaMenuHoverCat, setMegaMenuHoverCat] = useState<string | null>(null);
  const megaMenuRef = useRef<HTMLDivElement>(null);

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

        // Pick the bottommost visible section (last in page order) so the
        // section you just scrolled into takes priority
        let current: string | undefined;
        for (const id of allSectionIds) {
          if (visibleSections.has(id)) current = id;
        }
        if (current) {
          setActiveSection(sectionToNav[current] ?? `#${current}`);
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

  // Close mega menu on outside click
  useEffect(() => {
    if (!megaMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      const nav = document.querySelector('nav');
      if (nav && !nav.contains(e.target as Node)) {
        setMegaMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [megaMenuOpen]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavClick = (href: string) => {
    setIsOpen(false);
    const id = href.replace(/^#/, "");
    // Delay scroll to allow Sheet close animation to complete
    setTimeout(() => scrollToSection(id), 350);
  };

  return <nav className="fixed top-0 left-0 right-0 z-50 bg-background backdrop-blur-sm border-b border-border/50">
      <div className="mx-auto max-w-7xl px-4 md:px-12 lg:px-20">
        {/* Mobile: single row */}
        <div className="flex h-24 items-center justify-center md:hidden relative">
          <div className="flex flex-col items-center ml-6">
            <button onClick={scrollToTop} className="group cursor-pointer whitespace-nowrap">
              <span className="font-brand text-[1.6rem] font-bold tracking-widest text-foreground transition-all duration-300 group-hover:text-primary">
                MAISON AFFLUENCY
              </span>
            </button>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="h-px w-6 bg-foreground" aria-hidden="true" />
              <span className="font-body text-[7px] uppercase tracking-[0.3em] text-foreground font-bold">Since 2017</span>
              <span className="h-px w-6 bg-foreground" aria-hidden="true" />
            </div>
          </div>

          {/* Mobile Hamburger Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-12 w-12 absolute left-0 text-primary" aria-label="Toggle menu">
                {isOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
              </Button>
            </SheetTrigger>
            
            <SheetContent side="left" className="w-full overflow-y-auto" aria-describedby={undefined}>
              <div className="sr-only">
                <h2>Navigation Menu</h2>
              </div>
              {/* Header branding visible in menu */}
              <div className="flex flex-col items-center pt-2 pb-4 border-b border-border/30 mb-6">
                <button onClick={() => { setIsOpen(false); scrollToTop(); }} className="group cursor-pointer whitespace-nowrap">
                  <span className="font-brand text-[1.4rem] font-bold tracking-widest text-foreground transition-all duration-300 group-hover:text-primary">
                    MAISON AFFLUENCY
                  </span>
                </button>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="h-px w-6 bg-foreground" />
                  <span className="font-body text-[7px] uppercase tracking-[0.3em] text-foreground font-bold">Since 2017</span>
                  <span className="h-px w-6 bg-foreground" />
                </div>
              </div>
              <div className="flex flex-col gap-0 pb-8">
                {leftNavItems.map((item, index) => (
                  <button 
                    key={item.href} 
                    onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleNavClick(item.href); }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleNavClick(item.href); }}
                    className="font-body text-[15px] uppercase tracking-wide text-left transition-colors py-2.5 w-full flex items-center justify-between text-foreground hover:text-primary font-semibold animate-fade-in opacity-0"
                    style={{ animationDelay: `${index * 120}ms`, animationFillMode: 'forwards' }}
                  >
                    <span className="flex flex-col">
                      <span>{item.mobileLabel}</span>
                      {item.mobileSubtitle && (
                        <span className="text-[10px] tracking-[0.2em] text-muted-foreground font-normal normal-case italic">{item.mobileSubtitle}</span>
                      )}
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ))}

                {/* Categories list — always visible, small font, left-aligned with > chevron */}
                <div 
                  className="animate-fade-in opacity-0 border-t border-border/30 pt-4"
                  style={{ animationDelay: `${leftNavItems.length * 120}ms`, animationFillMode: 'forwards' }}
                >
                  <p className="font-body text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-3 text-center font-semibold">All Categories</p>
                  <div className="flex flex-col gap-0">
                    {CATEGORY_ORDER.map(cat => (
                      <div key={cat} className="mb-3">
                        <button
                          onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)}
                          className="text-left font-body text-[15px] uppercase tracking-wide transition-colors py-1.5 w-full text-foreground hover:text-primary font-semibold flex items-center justify-between"
                        >
                          {cat}
                          <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${expandedCategory === cat ? "rotate-90" : ""}`} />
                        </button>
                        {expandedCategory === cat && SUBCATEGORY_MAP[cat]?.length > 0 && (
                          <div className="ml-4 space-y-0 border-l border-border/30 pl-4">
                            <button
                              onClick={() => {
                                setIsOpen(false);
                                window.dispatchEvent(new CustomEvent('setDesignerCategory', { detail: { category: cat, subcategory: null } }));
                                handleNavClick('#designers');
                              }}
                              className="block text-[12px] uppercase tracking-[0.15em] font-body text-muted-foreground hover:text-primary transition-colors py-1.5 font-semibold"
                            >
                              All {cat}
                            </button>
                            {SUBCATEGORY_MAP[cat].map(sub => (
                              <button
                                key={sub}
                                onClick={() => { 
                                  setIsOpen(false); 
                                  window.dispatchEvent(new CustomEvent('setDesignerCategory', { detail: { category: cat, subcategory: sub } })); 
                                  handleNavClick('#designers'); 
                                }}
                                className="block text-[12px] uppercase tracking-[0.15em] font-body text-muted-foreground hover:text-primary transition-colors py-1.5 font-semibold"
                              >
                                {sub}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
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
                      className="font-body text-[15px] uppercase tracking-wide text-left transition-colors py-2.5 w-full flex items-center justify-between text-foreground hover:text-primary font-semibold"
                    >
                      {item.label}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ))}
                </div>
                
                <div 
                  className="animate-fade-in opacity-0"
                  style={{ animationDelay: `${(leftNavItems.length + 1) * 120}ms`, animationFillMode: 'forwards' }}
                >
                  <button
                    onClick={() => setContactExpanded(!contactExpanded)}
                    className="font-body text-[15px] uppercase tracking-wide text-left transition-colors py-2.5 w-full flex items-center justify-between text-foreground hover:text-primary font-semibold"
                  >
                    Contact Us
                    <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${contactExpanded ? "rotate-90" : ""}`} />
                  </button>
                  {contactExpanded && (
                    <div className="ml-4 mb-1 space-y-0 border-l border-border/30 pl-4">
                      {contactOptions.map((option) => (
                        <button
                          key={option.label}
                          onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); option.action(); }}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); option.action(); }}
                          className="flex items-center gap-3 text-left font-body text-[12px] uppercase tracking-[0.15em] text-muted-foreground hover:text-primary transition-colors py-1.5 font-semibold"
                        >
                          <option.icon className="h-4 w-4 text-primary" />
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop: stacked layout */}
        <div className="hidden md:flex flex-col items-center">
          {/* Top row: Trade Program | MAISON AFFLUENCY | Contact Us */}
          <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center pt-5 pb-3">
            <div className="flex justify-start">
              {rightNavItems.map((item) => (
                <button 
                  key={item.href} 
                  onClick={() => handleNavClick(item.href)} 
                  className="font-body text-[10px] uppercase tracking-[0.2em] transition-all duration-300 whitespace-nowrap px-2.5 py-1 border border-accent rounded-sm bg-accent/10 text-accent hover:bg-accent hover:text-accent-foreground"
                >
                  
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col items-center">
              <button onClick={scrollToTop} className="group cursor-pointer whitespace-nowrap">
                <span className="font-brand text-3xl lg:text-4xl font-bold tracking-[0.25em] text-foreground transition-all duration-300 group-hover:text-primary">
                  MAISON AFFLUENCY
                </span>
              </button>
              <div className="flex items-center gap-3 mt-1">
                <span className="h-px w-10 bg-foreground" aria-hidden="true" />
                <span className="font-body text-[9px] uppercase tracking-[0.3em] text-foreground font-bold">Since 2017</span>
                <span className="h-px w-10 bg-foreground" aria-hidden="true" />
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

          <div className="flex items-center gap-8 lg:gap-14 pb-3">
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

            {/* Categories mega menu trigger */}
            <button
              onClick={() => { setMegaMenuOpen(!megaMenuOpen); setMegaMenuHoverCat(null); }}
              className={cn(
                "font-body text-xs uppercase tracking-[0.2em] transition-all duration-300 flex items-center gap-1 whitespace-nowrap outline-none relative group",
                megaMenuOpen
                  ? "text-primary font-medium"
                  : "text-foreground/70 hover:text-primary hover:[text-shadow:0_0_8px_hsl(var(--primary)/0.3)]"
              )}
            >
              All Categories
              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${megaMenuOpen ? "rotate-180" : ""}`} />
              <span className={cn(
                "absolute -bottom-1 left-0 h-0.5 bg-primary transition-all duration-300",
                megaMenuOpen ? "w-full" : "w-0 group-hover:w-full"
              )} />
            </button>
          </div>

          {/* Horizontal mega menu */}
          {megaMenuOpen && (
            <div
              ref={megaMenuRef}
              className="w-full border-t border-border/30 bg-background py-4 animate-in slide-in-from-top-1 duration-200"
            >
              <div className="flex justify-center gap-8 lg:gap-12">
                {CATEGORY_ORDER.map(cat => (
                  <div key={cat} className="flex flex-col">
                    <button
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('setDesignerCategory', { detail: { category: cat, subcategory: null } }));
                        setMegaMenuOpen(false);
                        handleNavClick('#designers');
                      }}
                      className="font-body text-[11px] uppercase tracking-[0.2em] transition-all duration-300 pb-2 text-foreground hover:text-primary font-semibold text-left"
                    >
                      {cat}
                    </button>
                    {SUBCATEGORY_MAP[cat]?.length > 0 && (
                      <div className="flex flex-col gap-0.5">
                        {SUBCATEGORY_MAP[cat].map(sub => (
                          <button
                            key={sub}
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('setDesignerCategory', { detail: { category: cat, subcategory: sub } }));
                              setMegaMenuOpen(false);
                              handleNavClick('#designers');
                            }}
                            className="text-left text-[10px] uppercase tracking-[0.15em] font-body text-muted-foreground hover:text-primary transition-colors py-1"
                          >
                            {sub}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>;
};
export default Navigation;