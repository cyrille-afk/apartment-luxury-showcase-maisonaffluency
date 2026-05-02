import React, { useState, useEffect, useRef, Fragment } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, X, Crown, Search, ChevronDown, ChevronRight, ChevronLeft, Calendar, MessageCircle, Mail, LayoutGrid, Image, Palette, Gem, Briefcase, BookOpen, Heart, Pin, User, LogIn, UserPlus, LogOut } from "lucide-react";
import { useCompare } from "@/contexts/CompareContext";
import { useAuth } from "@/hooks/useAuth";
import { trackCTA } from "@/lib/analytics";
import { deferHashScrollUntilSheetClosed } from "@/lib/mobileHashNavigation";
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
import { categoryUrl } from "@/lib/categorySlugs";
import AuthGateDialog from "@/components/AuthGateDialog";
import { supabase } from "@/integrations/supabase/client";
const logoIcon = cloudinaryUrl("affluency-logo-icon_mpchum", { width: 200, quality: "auto", crop: "fill" });

const leftNavItems = [{
  label: "Gallery",
  mobileLabel: "Gallery",
  href: "/gallery",
  icon: Image,
}, {
  label: "Designers",
  mobileLabel: "Designers & Makers",
  href: "/designers",
  icon: Palette,
}, {
  label: "Collectible Design",
  mobileLabel: "Collectible Design",
  href: "/collectibles",
  icon: Gem,
}];

const rightNavItems = [{
  label: "Trade Program",
  href: "/trade-program",
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

interface NavigationProps {
  borderless?: boolean;
}

const Navigation = ({ borderless = false }: NavigationProps) => {
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
  const location = useLocation();
  const isOnCategoryRoute = location.pathname.startsWith("/products-category/");
  const isRouteActive = (href: string) => {
    if (!href.startsWith("/")) return false;
    if (href === "/") return location.pathname === "/";
    // Designers nav should NOT light up while browsing /products-category/*
    // — that's handled by the "All Categories" mega-menu trigger instead.
    if (href === "/designers" && isOnCategoryRoute) return false;
    return location.pathname === href || location.pathname.startsWith(href + "/");
  };
  const [isOpen, setIsOpen] = useState(false);
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("#home");
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [contactExpanded, setContactExpanded] = useState(false);
  const [megaMenuHoverCat, setMegaMenuHoverCat] = useState<string | null>(null);
  const [activeMegaCat, setActiveMegaCat] = useState<string | null>(null);
  const [activeMegaSub, setActiveMegaSub] = useState<string | null>(null);
  const megaMenuRef = useRef<HTMLDivElement>(null);
  const [featuredCatalogueTitle, setFeaturedCatalogueTitle] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("trade_documents")
      .select("title")
      .eq("id", "268efc74-9268-4a68-925a-c0de96500590")
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.title) setFeaturedCatalogueTitle(data.title);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // All page section IDs in order
    const allSectionIds = ["home", "overview", "gallery", "curating-team", "designers", "collectibles", "brands", "details", "contact"];

    // Map each nav item href to the section(s) it should highlight for
    const sectionToNav: Record<string, string> = {
      home: "#overview",
      overview: "#overview",
      gallery: "/gallery",
      "curating-team": "#overview",
      designers: "/designers",
      collectibles: "/collectibles",
      
      details: "/trade-program",
      contact: "/trade-program",
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
          // On /products-category/* the route owns the highlight (All Categories).
          // Don't let an in-page #designers section steal it.
          if (window.location.pathname.startsWith("/products-category/")) {
            setActiveSection("");
          } else {
            setActiveSection(sectionToNav[current] ?? `#${current}`);
          }
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

  useEffect(() => {
    if (isOpen || !pendingSection || window.location.pathname !== "/") return;

    return deferHashScrollUntilSheetClosed({
      id: pendingSection,
      onScroll: (id) => {
        setPendingSection((current) => (current === id ? null : current));
        scrollToSection(id);
      },
    });
  }, [isOpen, pendingSection]);

  const scrollToTop = () => {
    sessionStorage.removeItem("__scroll_y");
    if (window.location.pathname !== "/") {
      navigate("/");
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNavClick = (href: string) => {
    const isMobileSheetNav = isOpen && window.innerWidth < 768;

    if (href.startsWith("/")) {
      setIsOpen(false);
      navigate(href);
      return;
    }

    const id = href.replace(/^#/, "");

    // If not on the homepage, navigate there first with the hash
    if (window.location.pathname !== "/") {
      setIsOpen(false);
      navigate(`/${href}`);
      return;
    }

    if (isMobileSheetNav) {
      setPendingSection(id);
      setIsOpen(false);
      return;
    }

    setIsOpen(false);
    scrollToSection(id);
  };

  return <><nav className={cn(
      "fixed top-0 left-0 right-0 z-50",
      borderless
        ? "bg-background border-b border-transparent"
        : "bg-white backdrop-blur-sm border-b border-border/50"
    )}>
      <div className="mx-auto max-w-7xl px-4 md:px-12 lg:px-20">
        {/* Mobile: single row */}
        <div className="flex h-24 items-end pb-2.5 md:hidden relative justify-center">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            {/* Burger — absolute left */}
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-14 w-14 text-primary absolute left-0 bottom-2 -ml-3" aria-label="Toggle menu">
                {isOpen ? <X className="h-9 w-9" /> : <Menu className="h-9 w-9" />}
              </Button>
            </SheetTrigger>

            {/* Brand — centered */}
            <div className="flex flex-col items-center pb-0.5">
              <button onClick={scrollToTop} className="group cursor-pointer whitespace-nowrap">
                <span className="font-brand text-[2rem] font-bold tracking-widest text-foreground transition-all duration-300 group-hover:text-primary">
                  M <span className="group-hover:text-accent transition-colors duration-300">A</span>FFLUENCY
                </span>
              </button>
              <div className="flex items-center gap-2 -mt-0.5">
                <span className="h-px w-5 bg-foreground" />
                <span className="font-body text-[7px] uppercase tracking-[0.3em] text-foreground font-bold">Est. 2017</span>
                <span className="h-px w-5 bg-foreground" />
              </div>
            </div>

            <SheetContent side="left" className="w-full overflow-y-auto flex flex-col" aria-describedby={undefined}>
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
                  <span className="font-body text-[8px] md:text-[7px] uppercase tracking-[0.3em] text-foreground font-bold">Est. 2017</span>
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
                      {item.mobileLabel}
                      <ChevronRight className="h-4 w-4" />
                    </button>

                    {/* Insert All Categories right after Gallery (index 0) */}
                    {index === 0 && (
                      <div 
                        className="animate-fade-in opacity-0 border-t border-border/30 pt-2 mb-2"
                        style={{ animationDelay: `${index * 120}ms`, animationFillMode: 'forwards' }}
                      >
                        <button
                          onClick={() => { setCategoryPanelOpen(true); setExpandedCategory(null); }}
                          className="font-body text-[15px] uppercase tracking-wide text-left transition-colors py-2.5 w-full flex items-center justify-between text-foreground hover:text-primary font-semibold"
                        >
                          <span className="flex items-center gap-1.5">
                            <LayoutGrid className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
                            All Categories
                          </span>
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {/* Insert New In right after Collectible Design (index 2) */}
                    {index === 2 && (
                      <button
                        onClick={() => handleNavClick("/new-in")}
                        className="font-body text-[15px] uppercase tracking-wide text-left transition-colors py-2.5 w-full flex items-center justify-between text-[hsl(var(--gold))] hover:text-primary font-bold animate-fade-in opacity-0"
                        style={{ animationDelay: `${(index + 1) * 120}ms`, animationFillMode: 'forwards' }}
                      >
                        New In
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                  </Fragment>
                ))}
                
                {/* Journal */}
                <button
                  onClick={() => handleNavClick("/journal")}
                  className="font-body text-[15px] uppercase tracking-wide text-left transition-colors py-2.5 w-full flex items-center justify-between text-foreground hover:text-primary font-semibold animate-fade-in opacity-0"
                  style={{ animationDelay: `${(leftNavItems.length + 1) * 120}ms`, animationFillMode: 'forwards' }}
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

                {/* Trade Program — separated */}
                <div 
                  className="mt-6 pt-4 border-t border-border/50 animate-fade-in opacity-0"
                  style={{ animationDelay: `${(leftNavItems.length + 2) * 120}ms`, animationFillMode: 'forwards' }}
                >
                  {rightNavItems.map((item) => (
                    <button 
                      key={item.href} 
                      onClick={() => handleNavClick(item.href)}
                      className="font-body text-[15px] uppercase tracking-wide text-left transition-colors py-2.5 w-full flex items-center justify-between text-[hsl(var(--gold))] hover:text-white hover:bg-[hsl(var(--gold))] font-bold bg-[hsl(var(--gold)/0.1)] px-3 rounded-lg"
                    >
                      <span className="flex items-center gap-2">
                        {item.label}
                        <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--gold))] animate-pulse" />
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ))}
                </div>

                {/* Contact Us — separate section */}
                <div 
                  className="mt-4 pt-4 border-t border-border/50 animate-fade-in opacity-0"
                  style={{ animationDelay: `${(leftNavItems.length + 3) * 120}ms`, animationFillMode: 'forwards' }}
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

              {/* Sticky bottom toolbar — My Account / Wishlist / Contact Us */}
              <div className="mt-auto sticky bottom-0 border-t border-border bg-muted/50 backdrop-blur-sm grid grid-cols-3 py-3">
                <button
                  onClick={() => { setIsOpen(false); user ? navigate("/trade") : setAuthGateOpen(true); }}
                  className="flex flex-col items-center gap-1 text-foreground hover:text-primary transition-colors"
                >
                  <User className="h-5 w-5" />
                  <span className="font-body text-[9px] uppercase tracking-[0.15em] font-semibold">My Account</span>
                </button>
                <button
                  onClick={() => { setIsOpen(false); navigate("/favorites"); }}
                  className="relative flex flex-col items-center gap-1 text-foreground hover:text-primary transition-colors"
                >
                  <Heart className="h-5 w-5" />
                  {favCount > 0 && (
                    <span className="absolute -top-1 right-1/4 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold leading-none px-0.5">
                      {favCount}
                    </span>
                  )}
                  <span className="font-body text-[9px] uppercase tracking-[0.15em] font-semibold">Wishlist</span>
                </button>
                <a
                  href="https://wa.me/6591393850"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => { setIsOpen(false); trackCTA.whatsapp("Mobile Menu"); }}
                  className="flex flex-col items-center gap-1 text-foreground hover:text-primary transition-colors"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span className="font-body text-[9px] uppercase tracking-[0.15em] font-semibold">WhatsApp</span>
                </a>
              </div>

              {/* Category overlay panel — slides over the menu */}
              <div
                className={`absolute inset-0 bg-background z-10 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${categoryPanelOpen ? "translate-x-0" : "translate-x-full"}`}
              >
                {/* Dark header bar */}
                <div className="bg-foreground text-background flex items-center px-4 py-3.5">
                  <button
                    onClick={() => setCategoryPanelOpen(false)}
                    className="flex items-center gap-1 text-background/80 hover:text-background transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="flex-1 text-center font-body text-sm uppercase tracking-[0.2em] font-semibold">
                    All Categories
                  </span>
                  <div className="w-6" />
                </div>

                {/* Category list */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('setDesignerCategory', { detail: { category: null, subcategory: null } }));
                        setCategoryPanelOpen(false);
                        setIsOpen(false);
                      }}
                      className="font-body text-[10px] uppercase tracking-[0.15em] transition-all duration-300 px-4 py-1.5 rounded-full bg-background border border-border hover:border-foreground text-muted-foreground hover:text-foreground"
                    >
                      Clear All
                    </button>
                  </div>

                  {CATEGORY_ORDER.map(cat => (
                    <div key={cat} className="border-b border-border/30">
                      <button
                        onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)}
                        className="text-left font-body text-[15px] uppercase tracking-wide transition-colors py-3.5 w-full text-foreground hover:text-primary font-semibold flex items-center justify-between"
                      >
                        {cat}
                        <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${expandedCategory === cat ? "rotate-90" : ""}`} />
                      </button>
                      {expandedCategory === cat && SUBCATEGORY_MAP[cat]?.length > 0 && (
                        <div className="pb-3 space-y-0">
                          <button
                            onClick={() => {
                              setCategoryPanelOpen(false);
                              setIsOpen(false);
                              navigate(categoryUrl(cat, null));
                            }}
                            className="block w-full text-left text-[13px] tracking-[0.1em] font-body text-foreground hover:text-primary transition-colors py-2 pl-4 font-semibold"
                          >
                            All {cat}
                          </button>
                          {SUBCATEGORY_MAP[cat].map(sub => (
                            <button
                              key={sub}
                              onClick={() => {
                                setCategoryPanelOpen(false);
                                setIsOpen(false);
                                navigate(categoryUrl(cat, sub));
                              }}
                              className="block w-full text-left text-[13px] tracking-[0.1em] font-body text-muted-foreground hover:text-foreground transition-colors py-2 pl-4"
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
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop: stacked layout */}
        <div className="hidden md:flex flex-col items-center">
          {/* Top row: Trade Program | MAISON AFFLUENCY | Contact Us */}
          <div className="w-full grid grid-cols-[1fr_auto_1fr] items-start pt-5 pb-1">
            <div className="flex justify-start pt-1">
              {/* Left column kept for grid balance */}
            </div>
            <div className="flex flex-col items-center">
              <button onClick={scrollToTop} className="group cursor-pointer whitespace-nowrap">
                <span className="font-brand text-3xl lg:text-4xl font-bold tracking-[0.25em] text-foreground transition-all duration-300 group-hover:text-primary">
                  MAISON <span className="group-hover:text-accent transition-colors duration-300">A</span>FFLUENCY
                </span>
              </button>
              <div className="flex items-center gap-3 mt-1 mb-2">
                <span className="h-px w-10 bg-foreground" aria-hidden="true" />
                <span className="font-body text-[10px] uppercase tracking-[0.3em] text-foreground font-bold">Est. 2017</span>
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
                          onClick={() => navigate("/trade-program#apply")}
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
                      (activeSection === item.href || isRouteActive(item.href)) && "font-medium"
                    )}
                  >
                    {item.label}
                    <span className={cn(
                      "absolute -bottom-1 left-0 h-0.5 bg-[hsl(var(--accent))] transition-all duration-300",
                      (activeSection === item.href || isRouteActive(item.href)) ? "w-full" : "w-0 group-hover:w-full"
                    )} />
                  </button>

                  {/* Insert All Categories after Gallery (index 0) */}
                  {index === 0 && (
                    <button
                      onClick={() => { setMegaMenuOpen(!megaMenuOpen); setMegaMenuHoverCat(null); }}
                      className={cn(
                        "font-body text-xs uppercase tracking-[0.2em] transition-all duration-300 flex items-center gap-1.5 whitespace-nowrap outline-none relative group text-foreground",
                        (megaMenuOpen || isOnCategoryRoute) && "font-medium"
                      )}
                    >
                      <LayoutGrid className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
                      All Categories
                      <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${megaMenuOpen ? "rotate-180" : ""}`} />
                      <span className={cn(
                        "absolute -bottom-1 left-0 h-0.5 bg-[hsl(var(--accent))] transition-all duration-300",
                        (megaMenuOpen || isOnCategoryRoute) ? "w-full" : "w-0 group-hover:w-full"
                      )} />
                    </button>
                  )}
                </React.Fragment>
              ))}

              {/* New In — between Collectible Design and Journal */}
              <button
                onClick={() => { setMegaMenuOpen(false); handleNavClick("/new-in"); }}
                className="font-body text-xs uppercase tracking-[0.2em] font-bold transition-all duration-300 relative group whitespace-nowrap flex items-center gap-1.5 text-[hsl(var(--gold))] hover:text-foreground after:absolute after:bottom-0 after:left-0 after:w-full after:h-px after:bg-foreground after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300 after:origin-left pb-0.5"
              >
                New In
              </button>
            </div>

            <span className="w-px h-3 bg-border/60" aria-hidden="true" />

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
                <div key={item.href} className="relative group/trade">
                  <button
                    onClick={() => { setMegaMenuOpen(false); handleNavClick(item.href); }}
                    className="font-body text-xs uppercase tracking-[0.2em] font-bold transition-all duration-300 relative whitespace-nowrap flex items-center gap-1.5 text-[hsl(var(--gold))] hover:text-white bg-[hsl(var(--gold)/0.1)] hover:bg-[hsl(var(--gold))] px-3 py-1 rounded-full"
                  >
                    {item.label}
                    <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--gold))] animate-pulse" />
                  </button>
                  {/* Hover tooltip */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover/trade:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                    <div className="bg-foreground text-background px-3 py-1.5 rounded-md shadow-lg whitespace-nowrap">
                      <p className="font-body text-[10px] uppercase tracking-wider">New: Andrée Putman Art Paris</p>
                      <p className="font-body text-[9px] text-background/60">Free catalogue download</p>
                    </div>
                  </div>
                </div>
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
                        setActiveMegaCat(cat);
                        setActiveMegaSub(null);
                        setMegaMenuOpen(false);
                        const target = categoryUrl(cat, null);
                        // Always re-broadcast — handles the case where user clicks
                        // the same category again (navigate is a no-op so the
                        // CategoryRoute effect doesn't re-fire).
                        if (window.location.pathname === target) {
                          window.dispatchEvent(new CustomEvent("syncCategoryFilter", {
                            detail: { category: cat, subcategory: null, source: "designers" },
                          }));
                          const el = document.getElementById("designers") || document.getElementById("featured-designers");
                          if (el instanceof HTMLElement) el.scrollIntoView({ behavior: "smooth", block: "start" });
                        } else {
                          navigate(target);
                        }
                      }}
                      className={cn("font-body text-[11px] uppercase tracking-[0.2em] transition-all duration-300 text-left w-full", activeMegaCat === cat && !activeMegaSub ? "text-[hsl(var(--accent))] font-bold" : "text-foreground font-semibold hover:text-primary")}
                    >
                      {cat}
                    </button>
                    {SUBCATEGORY_MAP[cat] && (
                      <div className="flex flex-col gap-1 mt-1.5 ml-0">
                        <button
                          onClick={() => {
                            setActiveMegaCat(cat);
                            setActiveMegaSub(null);
                            setMegaMenuOpen(false);
                            const target = categoryUrl(cat, null);
                            if (window.location.pathname === target) {
                              window.dispatchEvent(new CustomEvent("syncCategoryFilter", {
                                detail: { category: cat, subcategory: null, source: "designers" },
                              }));
                              const el = document.getElementById("product-grid") || document.getElementById("designers");
                              if (el instanceof HTMLElement) el.scrollIntoView({ behavior: "smooth", block: "start" });
                            } else {
                              navigate(target);
                            }
                          }}
                          className="text-left text-[10px] tracking-[0.15em] font-body italic transition-colors py-1 text-[hsl(var(--gold))] hover:text-primary"
                        >
                          View all {cat}
                        </button>
                        {SUBCATEGORY_MAP[cat].map(sub => (
                          <button
                            key={sub}
                            onClick={() => {
                              setActiveMegaCat(cat);
                              setActiveMegaSub(sub);
                              setMegaMenuOpen(false);
                              const target = categoryUrl(cat, sub);
                              if (window.location.pathname === target) {
                                window.dispatchEvent(new CustomEvent("syncCategoryFilter", {
                                  detail: { category: cat, subcategory: sub, source: "designers" },
                                }));
                                const el = document.getElementById("product-grid") || document.getElementById("designers") || document.getElementById("featured-designers");
                                if (el instanceof HTMLElement) el.scrollIntoView({ behavior: "smooth", block: "start" });
                              } else {
                                navigate(target);
                              }
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
                      if (window.location.pathname.startsWith("/products-category/")) {
                        navigate("/");
                      }
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