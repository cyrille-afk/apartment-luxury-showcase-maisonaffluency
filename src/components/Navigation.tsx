import React, { useState, useEffect, useRef, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X, Crown, Search, ChevronDown, ChevronRight, Calendar, MessageCircle, Mail, LayoutGrid, Image, Palette, Gem, Briefcase, BookOpen, Heart, Pin, User, LogIn, UserPlus, LogOut } from "lucide-react";
import { useCompare } from "@/contexts/CompareContext";
import { useAuth } from "@/hooks/useAuth";
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { CATEGORY_ORDER, SUBCATEGORY_MAP } from "@/lib/productTaxonomy";
import AuthGateDialog from "@/components/AuthGateDialog";
import { supabase } from "@/integrations/supabase/client";
const logoIcon = cloudinaryUrl("affluency-logo-icon_mpchum", { width: 200, quality: "auto", crop: "fill" });

const leftNavItems = [{
  label: "Gallery",
  mobileLabel: "Gallery",
  href: "#overview",
  icon: Image,
}, {
  label: "Designers",
  mobileLabel: "Designers & Makers",
  mobileSubtitle: "On View",
  href: "#designers",
  icon: Palette,
}, {
  label: "Collectible Design",
  mobileLabel: "Collectible Design",
  mobileSubtitle: "On View",
  href: "#collectibles",
  icon: Gem,
}];

const rightNavItems = [{
  label: "Trade Program",
  href: "/trade/program",
  icon: Briefcase,
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


const navItems = [...leftNavItems, ...rightNavItems];

const Navigation = () => {
  const { user } = useAuth();
  const { items: pinItems, setIsComparing } = useCompare();
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [authGateMode, setAuthGateMode] = useState<"prompt" | "signup" | "login">("prompt");
  // localStorage-backed favorite count
  const [favCount, setFavCount] = useState(0);
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem("public_favorites");
        setFavCount(raw ? JSON.parse(raw).length : 0);
      } catch { setFavCount(0); }
    };
    read();
    const onStorage = (e: StorageEvent) => { if (e.key === "public_favorites") read(); };
    window.addEventListener("storage", onStorage);
    // Also listen for same-tab changes via a custom event
    const onLocal = () => read();
    window.addEventListener("public_favorites_changed", onLocal);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("public_favorites_changed", onLocal); };
  }, []);
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("#home");
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [contactExpanded, setContactExpanded] = useState(false);
  const [megaMenuHoverCat, setMegaMenuHoverCat] = useState<string | null>(null);
  const [activeMegaCat, setActiveMegaCat] = useState<string | null>(null);
  const [activeMegaSub, setActiveMegaSub] = useState<string | null>(null);
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
      
      details: "/trade/program",
      contact: "/trade/program",
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

  // Sync mega-menu highlight when filter is cleared externally (e.g. ProductGrid "Clear Filter")
  useEffect(() => {
    const handleExternalClear = (e: CustomEvent) => {
      const { category: cat, subcategory: sub } = e.detail || {};
      setActiveMegaCat(cat || null);
      setActiveMegaSub(sub || null);
    };
    window.addEventListener('setDesignerCategory', handleExternalClear as EventListener);
    return () => window.removeEventListener('setDesignerCategory', handleExternalClear as EventListener);
  }, []);

  const scrollToTop = () => {
    sessionStorage.removeItem("__scroll_y");
    if (window.location.pathname !== "/") {
      navigate("/");
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNavClick = (href: string) => {
    setIsOpen(false);
    if (href.startsWith("/")) {
      navigate(href);
      return;
    }
    const id = href.replace(/^#/, "");
    // If not on the homepage, navigate there first with the hash
    if (window.location.pathname !== "/") {
      navigate(`/${href}`);
      return;
    }
    // Delay scroll to allow Sheet close animation to complete and banner to be measurable
    setTimeout(() => scrollToSection(id), 450);
  };

  return <><nav className="fixed top-0 left-0 right-0 z-50 bg-white backdrop-blur-sm border-b border-border/50">
      <div className="mx-auto max-w-7xl px-4 md:px-12 lg:px-20">
        {/* Mobile: single row */}
        <div className="flex h-24 items-center justify-center md:hidden relative">
          <div className="flex flex-col items-center ml-6">
            <button onClick={scrollToTop} className="group cursor-pointer whitespace-nowrap">
              <span className="font-brand text-[1.6rem] font-bold tracking-widest text-foreground transition-all duration-300 group-hover:text-primary">
                MAISON <span className="group-hover:text-accent transition-colors duration-300">A</span>FFLUENCY
              </span>
            </button>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="h-px w-6 bg-foreground" aria-hidden="true" />
              <span className="font-body text-[8px] md:text-[7px] uppercase tracking-[0.3em] text-foreground font-bold">Since 2017</span>
              <span className="h-px w-6 bg-foreground" aria-hidden="true" />
            </div>
          </div>

          {/* Mobile account icon — right side */}
          <button
            onClick={() => user ? navigate("/trade") : setAuthGateOpen(true)}
            className="absolute right-0 p-2 text-foreground hover:text-primary transition-colors"
            aria-label={user ? "My Account" : "Sign In"}
          >
            <User className="h-5 w-5" />
          </button>

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
                    MAISON <span className="group-hover:text-accent transition-colors duration-300">A</span>FFLUENCY
                  </span>
                </button>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="h-px w-6 bg-foreground" />
                  <span className="font-body text-[8px] md:text-[7px] uppercase tracking-[0.3em] text-foreground font-bold">Since 2017</span>
                  <span className="h-px w-6 bg-foreground" />
                </div>
              </div>
              <div className="flex flex-col gap-0 pb-40">
                {leftNavItems.map((item, index) => (
                  <Fragment key={item.href}>
                    <button 
                      onClick={() => handleNavClick(item.href)}
                      className="font-body text-[15px] uppercase tracking-wide text-left transition-colors py-2.5 w-full flex items-center justify-between text-foreground hover:text-primary font-semibold animate-fade-in opacity-0"
                      style={{ animationDelay: `${index * 120}ms`, animationFillMode: 'forwards' }}
                    >
                      <span className="flex flex-col">
                        <span>{item.mobileLabel}</span>
                        {item.mobileSubtitle && (
                          <span className="text-[10px] tracking-[0.2em] text-[hsl(var(--gold))] font-normal normal-case italic">{item.mobileSubtitle}</span>
                        )}
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </button>

                    {/* Insert All Categories right after Gallery (index 0) */}
                    {index === 0 && (
                      <div 
                        className="animate-fade-in opacity-0 border-t border-border/30 pt-2 mb-2"
                        style={{ animationDelay: `${(index + 1) * 120}ms`, animationFillMode: 'forwards' }}
                      >
                        <button
                          onClick={() => setCategoriesExpanded(!categoriesExpanded)}
                          className="font-body text-[15px] uppercase tracking-wide text-left transition-colors py-2.5 w-full flex items-center justify-between text-foreground hover:text-primary font-semibold"
                        >
                          <span className="flex items-center gap-1.5">
                            <LayoutGrid className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
                            All Categories
                          </span>
                          <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${categoriesExpanded ? "rotate-90" : ""}`} />
                        </button>
                        {categoriesExpanded && (
                          <div className="mt-2">
                            <div className="flex justify-end mb-3">
                              <button
                                onClick={() => {
                                  window.dispatchEvent(new CustomEvent('setDesignerCategory', { detail: { category: null, subcategory: null } }));
                                }}
                                className="font-body text-[10px] uppercase tracking-[0.15em] transition-all duration-300 px-4 py-1 rounded-full bg-white border border-[hsl(var(--gold))] shadow-[0_0_0_1px_hsl(var(--gold)/0.3)] hover:shadow-[0_0_0_2px_hsl(var(--gold)/0.5)] text-foreground"
                              >
                                Clear All
                              </button>
                            </div>
                            <div className="flex flex-col gap-0 ml-4 border-l border-border/30 pl-4">
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
                                        className="block text-[12px] tracking-[0.15em] font-body text-foreground hover:text-primary transition-colors py-1.5 font-semibold"
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
                                          className="block text-[12px] tracking-[0.15em] font-body text-foreground hover:text-[hsl(var(--accent))] transition-colors py-1.5 font-semibold"
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
                    )}
                  </Fragment>
                ))}
                
                {/* Journal */}
                <button
                  onClick={() => handleNavClick("/journal")}
                  className="font-body text-[15px] uppercase tracking-wide text-left transition-colors py-2.5 w-full flex items-center justify-between text-foreground hover:text-primary font-semibold animate-fade-in opacity-0"
                  style={{ animationDelay: `${leftNavItems.length * 120}ms`, animationFillMode: 'forwards' }}
                >
                  Journal
                  <ChevronRight className="h-4 w-4" />
                </button>

                {/* Favorites & Selection */}
                <div
                  className="mt-6 pt-4 border-t border-border/50 space-y-0 animate-fade-in opacity-0"
                  style={{ animationDelay: `${(leftNavItems.length + 1) * 120}ms`, animationFillMode: 'forwards' }}
                >
                  <button
                    onClick={() => { setIsOpen(false); navigate("/favorites"); }}
                    className="font-body text-[15px] uppercase tracking-wide text-left transition-colors py-2.5 w-full flex items-center justify-between text-foreground hover:text-primary font-semibold"
                  >
                    <span className="flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      My Favorites
                      {favCount > 0 && (
                        <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none px-1">
                          {favCount}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {pinItems.length > 0 && (
                    <button
                      onClick={() => { setIsOpen(false); setIsComparing(true); }}
                      className="font-body text-[15px] uppercase tracking-wide text-left transition-colors py-2.5 w-full flex items-center justify-between text-foreground hover:text-primary font-semibold"
                    >
                      <span className="flex items-center gap-2">
                        <Pin className="h-4 w-4" />
                        My Selection
                        <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none px-1">
                          {pinItems.length}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Trade Program & Contact — visually separated */}
                <div 
                  className="mt-6 pt-4 border-t border-border/50 space-y-0 animate-fade-in opacity-0"
                  style={{ animationDelay: `${(leftNavItems.length + 2) * 120}ms`, animationFillMode: 'forwards' }}
                >
                  {rightNavItems.map((item) => (
                    <button 
                      key={item.href} 
                      onClick={() => handleNavClick(item.href)}
                      className="font-body text-[15px] uppercase tracking-wide text-left transition-colors py-2.5 w-full flex items-center justify-between text-foreground hover:text-primary font-semibold"
                    >
                      {item.label}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ))}

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
                          onTouchEnd={undefined}
                          onClick={() => { setIsOpen(false); option.action(); }}
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
          <div className="w-full grid grid-cols-[1fr_auto_1fr] items-start pt-5 pb-1">
            <div className="flex justify-start gap-6 lg:gap-8 pt-1">
              {rightNavItems.map((item) => (
                <button 
                  key={item.href} 
                  onClick={() => handleNavClick(item.href)} 
                  className="font-body text-xs uppercase tracking-[0.2em] transition-all duration-300 whitespace-nowrap relative group text-foreground flex items-center gap-1.5"
                >
                  {item.label}
                  <span className="absolute -bottom-1 left-0 h-0.5 bg-[hsl(var(--accent))] transition-all duration-300 w-0 group-hover:w-full" />
                </button>
              ))}
            </div>
            <div className="flex flex-col items-center">
              <button onClick={scrollToTop} className="group cursor-pointer whitespace-nowrap">
                <span className="font-brand text-3xl lg:text-4xl font-bold tracking-[0.25em] text-foreground transition-all duration-300 group-hover:text-primary">
                  MAISON <span className="group-hover:text-accent transition-colors duration-300">A</span>FFLUENCY
                </span>
              </button>
              <div className="flex items-center gap-3 mt-1 mb-2">
                <span className="h-px w-10 bg-foreground" aria-hidden="true" />
                <span className="font-body text-[10px] uppercase tracking-[0.3em] text-foreground font-bold">Since 2017</span>
                <span className="h-px w-10 bg-foreground" aria-hidden="true" />
              </div>
            </div>
            <div className="flex flex-col items-end">
              {/* Contact Us — aligned with Trade Program */}
              <div className="pt-1">
                <DropdownMenu>
                  <DropdownMenuTrigger className="font-body text-xs uppercase tracking-[0.2em] transition-all duration-300 text-foreground data-[state=open]:text-foreground data-[state=open]:[text-shadow:none] flex items-center gap-1 whitespace-nowrap outline-none relative group">
                    Contact Us
                    <ChevronDown className="h-4 w-4" />
                    <span className="absolute -bottom-1 left-0 h-0.5 bg-[hsl(var(--accent))] transition-all duration-300 w-0 group-hover:w-full" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="left" sideOffset={8} className="bg-background border border-border shadow-lg z-50 min-w-[220px]">
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
              {/* Icons centered under Contact Us, 1 line below */}
              <div className="flex items-center justify-center gap-5 mt-3 self-end pr-8">
                <DropdownMenu>
                  <DropdownMenuTrigger className="relative group p-1 transition-colors outline-none">
                    <User className="w-6 h-6 text-foreground group-hover:text-primary transition-colors" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background border border-border shadow-lg z-50 min-w-[200px]">
                    {user ? (
                      <>
                        <div className="px-4 py-2.5 border-b border-border">
                          <p className="font-body text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <DropdownMenuItem
                          onClick={() => navigate("/trade")}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted transition-colors"
                        >
                          <User className="h-4 w-4 text-primary" />
                          <span className="font-body text-sm">My Account</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted transition-colors text-destructive"
                        >
                          <LogOut className="h-4 w-4" />
                          <span className="font-body text-sm">Sign Out</span>
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuItem
                          onClick={() => { setAuthGateMode("signup"); setAuthGateOpen(true); }}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted transition-colors"
                        >
                          <UserPlus className="h-4 w-4 text-primary" />
                          <span className="font-body text-sm">Sign Up</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => { setAuthGateMode("login"); setAuthGateOpen(true); }}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted transition-colors"
                        >
                          <LogIn className="h-4 w-4 text-primary" />
                          <span className="font-body text-sm">Log In</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => navigate("/trade/program#apply")}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted transition-colors"
                        >
                          <Briefcase className="h-4 w-4 text-[hsl(var(--gold))]" />
                          <span className="font-body text-sm">Trade Program</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => navigate("/favorites")}
                        className="relative group p-1 transition-colors"
                      >
                        <Heart className="w-6 h-6 text-foreground group-hover:text-primary transition-colors" />
                        {favCount > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none px-1">
                            {favCount}
                          </span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="font-body text-xs uppercase tracking-wider">
                      Wishlist
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between w-full pb-3">
            <div className="flex items-center gap-6 lg:gap-10">
              {leftNavItems.map((item, index) => (
                <React.Fragment key={item.href}>
                  <button 
                    onClick={() => { setMegaMenuOpen(false); handleNavClick(item.href); }} 
                    className={cn(
                      "font-body text-xs uppercase tracking-[0.2em] transition-all duration-300 relative group whitespace-nowrap flex items-center gap-1.5 text-foreground",
                      activeSection === item.href && "font-medium"
                    )}
                  >
                    {item.label}
                    <span className={cn(
                      "absolute -bottom-1 left-0 h-0.5 bg-[hsl(var(--accent))] transition-all duration-300",
                      activeSection === item.href ? "w-full" : "w-0 group-hover:w-full"
                    )} />
                  </button>

                  {/* Insert All Categories after Gallery (index 0) */}
                  {index === 0 && (
                    <button
                      onClick={() => { setMegaMenuOpen(!megaMenuOpen); setMegaMenuHoverCat(null); }}
                      className={cn(
                        "font-body text-xs uppercase tracking-[0.2em] transition-all duration-300 flex items-center gap-1.5 whitespace-nowrap outline-none relative group text-foreground",
                        megaMenuOpen && "font-medium"
                      )}
                    >
                      <LayoutGrid className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
                      All Categories
                      <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${megaMenuOpen ? "rotate-180" : ""}`} />
                      <span className={cn(
                        "absolute -bottom-1 left-0 h-0.5 bg-[hsl(var(--accent))] transition-all duration-300",
                        megaMenuOpen ? "w-full" : "w-0 group-hover:w-full"
                      )} />
                    </button>
                  )}
                </React.Fragment>
              ))}
            </div>

            <div className="flex items-center gap-6 lg:gap-10">
              {/* Journal */}
              <button
                onClick={() => { setMegaMenuOpen(false); handleNavClick("/journal"); }}
                className="font-body text-xs uppercase tracking-[0.2em] transition-all duration-300 relative group whitespace-nowrap flex items-center gap-1.5 text-foreground"
              >
                Journal
                <span className="absolute -bottom-1 left-0 h-0.5 bg-[hsl(var(--accent))] transition-all duration-300 w-0 group-hover:w-full" />
              </button>

              {/* Trade Program */}
              {rightNavItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => { setMegaMenuOpen(false); handleNavClick(item.href); }}
                  className="font-body text-xs uppercase tracking-[0.2em] transition-all duration-300 relative group whitespace-nowrap flex items-center gap-1.5 text-foreground"
                >
                  {item.label}
                  <span className="absolute -bottom-1 left-0 h-0.5 bg-[hsl(var(--accent))] transition-all duration-300 w-0 group-hover:w-full" />
                </button>
              ))}
            </div>
          </div>

          {/* Horizontal mega menu */}
          {megaMenuOpen && (
            <div
              ref={megaMenuRef}
              className="w-full border-t border-border/30 bg-background shadow-[0_8px_30px_rgba(0,0,0,0.08)] py-4 animate-in slide-in-from-top-1 duration-200"
            >
              <div className="flex justify-center gap-8 lg:gap-12 relative">
                {CATEGORY_ORDER.map(cat => (
                  <div key={cat} className="flex flex-col">
                    <button
                      onClick={() => {
                         window.dispatchEvent(new CustomEvent('setDesignerCategory', { detail: { category: cat, subcategory: null } }));
                        setActiveMegaCat(cat);
                        setActiveMegaSub(null);
                        setMegaMenuOpen(false);
                        setTimeout(() => scrollToSection('designers'), 120);
                      }}
                      className={cn("font-body text-[11px] uppercase tracking-[0.2em] transition-all duration-300 text-left w-full", activeMegaCat === cat && !activeMegaSub ? "text-[hsl(var(--accent))] font-bold" : "text-foreground font-semibold hover:text-primary")}
                    >
                      {cat}
                    </button>
                    {SUBCATEGORY_MAP[cat] && (
                      <div className="flex flex-col gap-1 mt-1.5 ml-0">
                        {SUBCATEGORY_MAP[cat].map(sub => (
                          <button
                            key={sub}
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('setDesignerCategory', { detail: { category: cat, subcategory: sub } }));
                              setActiveMegaCat(cat);
                              setActiveMegaSub(sub);
                              setMegaMenuOpen(false);
                              setTimeout(() => scrollToSection('designers'), 120);
                            }}
                            className={cn("text-left text-[10px] tracking-[0.15em] font-body transition-colors py-1", activeMegaSub === sub && activeMegaCat === cat ? "text-[hsl(var(--accent))] font-semibold" : "text-foreground hover:text-primary")}
                          >
                            {sub}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex flex-col justify-start">
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('setDesignerCategory', { detail: { category: null, subcategory: null } }));
                      setActiveMegaCat(null);
                      setActiveMegaSub(null);
                      setMegaMenuOpen(false);
                    }}
                    className="font-body text-[11px] uppercase tracking-[0.2em] transition-all duration-300 px-5 py-1.5 rounded-full bg-white border border-[hsl(var(--gold))] shadow-[0_0_0_1px_hsl(var(--gold)/0.3)] hover:shadow-[0_0_0_2px_hsl(var(--gold)/0.5)] text-foreground"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
    <AuthGateDialog open={authGateOpen} onClose={() => setAuthGateOpen(false)} action="access your account" initialMode={authGateMode} />
    </>;
};
export default Navigation;