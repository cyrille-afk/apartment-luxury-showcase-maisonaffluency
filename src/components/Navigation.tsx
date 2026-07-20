import React, { useState, useEffect, useRef } from "react";
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
// useFeaturedPublicDocument import removed — AD free-download flow discontinued.
import FavoritesHoverPreview from "@/components/FavoritesHoverPreview";
import ShippingDestinationSwitcher from "@/components/ShippingDestinationSwitcher";
const logoIcon = cloudinaryUrl("affluency-logo-icon_mpchum", { width: 200, quality: "auto", crop: "fill" });

const leftNavItems = [{
  label: "Designers",
  mobileLabel: "Designers & Makers",
  href: "/designers",
  icon: Palette,
}, {
  label: "Interactive Gallery",
  mobileLabel: "Interactive Gallery",
  href: "/gallery",
  icon: Image,
}, {
  label: "Collectibles",
  mobileLabel: "Collectibles",
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
  const { user, isTradeUser } = useAuth();
  // Trade-only visibility: hide the "Collectibles" nav item from public visitors.
  const visibleLeftNavItems = isTradeUser
    ? leftNavItems
    : leftNavItems.filter((item) => item.href !== "/collectibles");
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
  // featuredDoc removed — AD free-download flow discontinued.

  // ── Transparent floating header over the home hero ─────────────────────
  // On "/" while the user is still within the hero (scroll < ~85vh), the
  // nav floats transparently over the hero image. Past the hero it condenses
  // into a frosted white bar for legibility on category content.
  const isHomeRoute = location.pathname === "/";
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  useEffect(() => {
    if (!isHomeRoute) { setScrolledPastHero(false); return; }
    const onScroll = () => {
      // Trigger a bit before the hero ends so the frosted state locks in
      // before content collides with the header.
      setScrolledPastHero(window.scrollY > window.innerHeight * 0.75);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHomeRoute]);
  const isOverHero = isHomeRoute && !scrolledPastHero && !megaMenuOpen;

  const resetMobilePanels = () => {
    setCategoryPanelOpen(false);
    setExpandedCategory(null);
    setContactExpanded(false);
  };

  const closeMobileMenu = () => {
    resetMobilePanels();
    setIsOpen(false);
  };

  const handleMobileMenuOpenChange = (open: boolean) => {
    resetMobilePanels();
    setIsOpen(open);
  };

  // Allow other components (e.g. FloatingScrollNav on Gallery) to open the
  // mobile menu via a custom event.
  useEffect(() => {
    const openMenu = () => setIsOpen(true);
    window.addEventListener("open-main-menu", openMenu);
    return () => window.removeEventListener("open-main-menu", openMenu);
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
      if (href === "/gallery") {
        sessionStorage.removeItem('openGalleryIndex');
        sessionStorage.removeItem('gallerySourceId');
        sessionStorage.removeItem('galleryFilterDesigner');
        sessionStorage.removeItem('galleryOpenIntentAt');
      }
      closeMobileMenu();
      // Soften top-level menu transitions with an opt-in smooth scroll-to-top.
      navigate(href, { state: { smoothScroll: true } });
      return;
    }

    const id = href.replace(/^#/, "");

    // If not on the homepage, navigate there first with the hash
    if (window.location.pathname !== "/") {
      closeMobileMenu();
      navigate(`/${href}`);
      return;
    }

    if (isMobileSheetNav) {
      setPendingSection(id);
      closeMobileMenu();
      return;
    }

    closeMobileMenu();
    scrollToSection(id);
  };

  return <><nav className={cn(
      "fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top)] transition-colors duration-500",
      isOverHero
        ? "bg-white backdrop-blur-sm border-b border-border/50 shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
        : borderless
          ? "bg-background border-b border-transparent"
          : "bg-white backdrop-blur-sm border-b border-border/50 shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
    )}>
      <div className="mx-auto max-w-7xl px-5 md:px-14 lg:px-24">
        {/* Mobile: single row */}
          <div className="flex h-28 items-center md:hidden relative justify-between px-6 py-3">
           <Sheet open={isOpen} onOpenChange={handleMobileMenuOpenChange}>
            {/* Burger — left edge, vertically centered with wordmark */}
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11 text-primary self-center -translate-y-1.5" aria-label="Toggle menu">
                {isOpen ? <X className="h-9 w-9" strokeWidth={2.75} /> : <Menu className="h-9 w-9" strokeWidth={2.75} />}
              </Button>
            </SheetTrigger>

            {/* Brand — centered horizontally; Est.2017 floats below wordmark so
                the wordmark itself is the vertical anchor for burger and flag */}
            <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center leading-none">
            <button onClick={scrollToTop} className="group cursor-pointer whitespace-nowrap leading-none">
              <span className="font-brand text-[2.25rem] font-bold tracking-widest text-foreground transition-all duration-300 group-hover:text-primary leading-none">
                <span className="group-hover:text-accent transition-colors duration-300">A</span>FFLUENCY
              </span>
            </button>
              <div className="flex items-center gap-2 mt-1 brand-lockup">
                <span className="h-px w-5 bg-foreground" />
                <span className="font-body text-[7px] uppercase tracking-[0.3em] text-foreground font-bold">Est. 2017</span>
                <span className="h-px w-5 bg-foreground" />
              </div>
            </div>

            {/* Flag — right edge, vertically centered with wordmark */}
            <div className="self-center">
              <ShippingDestinationSwitcher compact flagClassName="text-2xl" />
            </div>




            <SheetContent side="left" className="w-full overflow-y-auto flex flex-col" aria-describedby={undefined}>
              <div className="sr-only">
                <h2>Navigation Menu</h2>
              </div>
              {/* Header branding visible in menu */}
              <div className="flex flex-col items-center pt-2 pb-4 border-b border-border/30 mb-6">
                <button onClick={() => { closeMobileMenu(); scrollToTop(); }} className="group cursor-pointer whitespace-nowrap">
                  <span className="font-brand text-[1.4rem] font-bold tracking-widest text-foreground transition-all duration-300 group-hover:text-primary">
                    MAISON <span className="group-hover:text-accent transition-colors duration-300">A</span>FFLUENCY
                  </span>
                </button>
                <div className="flex items-center gap-2 mt-0.5 brand-lockup">
                  <span className="h-px w-6 bg-foreground" />
                  <span className="font-body text-[8px] md:text-[7px] uppercase tracking-[0.3em] text-foreground font-bold">Est. 2017</span>
                  <span className="h-px w-6 bg-foreground" />
                </div>
              </div>
              <div className="flex flex-col gap-0 pb-40">
                {/* New In — first */}
                <button
                  onClick={() => handleNavClick("/new-in")}
                  className="font-body text-[15px] uppercase tracking-wide text-left transition-colors py-2.5 w-full flex items-center justify-between text-[hsl(var(--gold))] hover:text-primary font-bold animate-fade-in opacity-0"
                  style={{ animationDelay: `0ms`, animationFillMode: 'forwards' }}
                >
                  New In
                  <ChevronRight className="h-4 w-4" />
                </button>

                {/* All Categories — second */}
                <div 
                  className="animate-fade-in opacity-0 border-t border-border/30 pt-2 mb-2"
                  style={{ animationDelay: `120ms`, animationFillMode: 'forwards' }}
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

                {visibleLeftNavItems.map((item, index) => (
                  <button 
                    key={item.href}
                    onClick={() => handleNavClick(item.href)}
                    className="font-body text-[15px] uppercase tracking-wide text-left transition-colors py-2.5 w-full flex items-center justify-between text-foreground hover:text-primary font-semibold animate-fade-in opacity-0"
                    style={{ animationDelay: `${(index + 2) * 120}ms`, animationFillMode: 'forwards' }}
                  >
                    {item.mobileLabel}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ))}
                
                {/* Journal */}
                <button
                  onClick={() => handleNavClick("/journal")}
                  className="font-body text-[15px] uppercase tracking-wide text-left transition-colors py-2.5 w-full flex items-center justify-between text-foreground hover:text-primary font-semibold animate-fade-in opacity-0"
                  style={{ animationDelay: `${(visibleLeftNavItems.length + 2) * 120}ms`, animationFillMode: 'forwards' }}
                >
                  Journal
                  <ChevronRight className="h-4 w-4" />
                </button>

                {/* Favorites & Selection */}
                <div
                  className="mt-6 pt-4 border-t border-border/50 space-y-0 animate-fade-in opacity-0"
                  style={{ animationDelay: `${(visibleLeftNavItems.length + 2) * 120}ms`, animationFillMode: 'forwards' }}
                >
                  <button
                    onClick={() => { closeMobileMenu(); navigate("/favorites"); }}
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
                      onClick={() => { closeMobileMenu(); setIsComparing(true); }}
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
                  style={{ animationDelay: `${(visibleLeftNavItems.length + 3) * 120}ms`, animationFillMode: 'forwards' }}
                >
                  {rightNavItems.map((item) => (
                    <button 
                      key={item.href} 
                      onClick={() => handleNavClick(item.href)}
                      className="font-body text-[15px] uppercase tracking-wide text-left transition-colors py-2.5 w-full flex items-center justify-between text-accent-foreground hover:bg-accent/80 font-bold bg-accent px-3 rounded-lg"
                    >
                      {item.label}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ))}
                </div>

                {/* Contact Us — separate section */}
                <div 
                  className="mt-4 pt-4 border-t border-border/50 animate-fade-in opacity-0"
                  style={{ animationDelay: `${(visibleLeftNavItems.length + 4) * 120}ms`, animationFillMode: 'forwards' }}
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
                          onClick={() => { closeMobileMenu(); option.action(); }}
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
                  onClick={() => { closeMobileMenu(); user ? navigate("/trade") : setAuthGateOpen(true); }}
                  className="flex flex-col items-center gap-1 text-foreground hover:text-primary transition-colors"
                >
                  <User className="h-5 w-5" />
                  <span className="font-body text-[9px] uppercase tracking-[0.15em] font-semibold">My Account</span>
                </button>
                <button
                  onClick={() => { closeMobileMenu(); navigate("/favorites"); }}
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
                  onClick={() => { closeMobileMenu(); trackCTA.whatsapp("Mobile Menu"); }}
                  className="flex flex-col items-center gap-1 text-foreground hover:text-primary transition-colors"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span className="font-body text-[9px] uppercase tracking-[0.15em] font-semibold">WhatsApp</span>
                </a>
              </div>

              {/* Category overlay panel — slides over the menu */}
              <div
                className={`absolute inset-0 bg-background z-10 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${categoryPanelOpen ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none"}`}
              >
                {/* Dark header bar */}
                <div className="bg-foreground text-background flex items-center px-4 py-3.5">
                  <button
                    onClick={() => {
                      setCategoryPanelOpen(false);
                      setExpandedCategory(null);
                    }}
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
                        closeMobileMenu();
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
                              closeMobileMenu();
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
                                closeMobileMenu();
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
          <div className="w-full grid grid-cols-[1fr_auto_1fr] items-start pt-6 pb-1">
            <div className="flex justify-start pt-1 pl-2">
              <ShippingDestinationSwitcher />
            </div>
            <div className="flex flex-col items-center">
              <button onClick={scrollToTop} className="group cursor-pointer whitespace-nowrap">
                <span className="font-brand text-3xl lg:text-4xl font-bold tracking-[0.25em] text-foreground transition-all duration-300 group-hover:text-primary">
                  MAISON <span className="group-hover:text-accent transition-colors duration-300">A</span>FFLUENCY
                </span>
              </button>
              <div className="flex items-center gap-3 mt-1 mb-2 brand-lockup">
                <span className="h-px w-10 bg-foreground" aria-hidden="true" />
                <span className="font-body text-[10px] uppercase tracking-[0.3em] text-foreground font-bold">Est. 2017</span>
                <span className="h-px w-10 bg-foreground" aria-hidden="true" />
              </div>
            </div>
            <div className="flex flex-col items-end pr-2">
              {/* Contact Us — aligned to right edge (matches Trade Program below) */}
              <div className="pt-1">
                <DropdownMenu>
                  <DropdownMenuTrigger className="font-body text-sm uppercase tracking-[0.18em] transition-all duration-300 text-foreground data-[state=open]:text-foreground data-[state=open]:[text-shadow:none] flex items-center gap-1.5 whitespace-nowrap outline-none relative group font-semibold">
                    Contact Us
                    <ChevronDown className="h-4 w-4" />
                    <span className="absolute -bottom-1 left-0 h-0.5 bg-[hsl(var(--gold))] transition-all duration-300 w-0 group-hover:w-full" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="bottom" sideOffset={88} className="bg-background border border-border shadow-lg z-50 min-w-[220px]">
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
              {/* Icons aligned to right edge */}
              <div className="flex items-center gap-5 mt-3">
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

                <FavoritesHoverPreview favCount={favCount}>
                  <button
                    onClick={() => navigate("/favorites")}
                    aria-label="Wishlist"
                    className="relative group p-1 transition-colors"
                  >
                    <Heart className="w-6 h-6 text-foreground group-hover:text-primary transition-colors" />
                    {favCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none px-1">
                        {favCount}
                      </span>
                    )}
                  </button>
                </FavoritesHoverPreview>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between w-full pb-3">
            <div className="flex items-center gap-6 lg:gap-10">
              {/* New In — first in the left nav */}
              <button
                onClick={() => { setMegaMenuOpen(false); handleNavClick("/new-in"); }}
                className="font-body text-sm uppercase tracking-[0.18em] font-bold transition-all duration-300 relative group whitespace-nowrap flex items-center gap-1.5 text-[hsl(var(--gold))] hover:text-foreground after:absolute after:-bottom-1 after:left-0 after:w-full after:h-0.5 after:bg-[hsl(var(--gold))] after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300 after:origin-left"
              >
                New In
              </button>

              {/* All Categories — second in the left nav */}
              <button
                onClick={() => { setMegaMenuOpen(!megaMenuOpen); setMegaMenuHoverCat(null); }}
                className={cn(
                  "font-body text-sm uppercase tracking-[0.18em] font-semibold transition-all duration-300 flex items-center gap-1.5 whitespace-nowrap outline-none relative group text-foreground",
                  (megaMenuOpen || isOnCategoryRoute) && "text-[hsl(var(--gold))]"
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
                All Categories
                <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${megaMenuOpen ? "rotate-180" : ""}`} />
                <span className={cn(
                  "absolute -bottom-1 left-0 h-0.5 bg-[hsl(var(--gold))] transition-all duration-300",
                  (megaMenuOpen || isOnCategoryRoute) ? "w-full" : "w-0 group-hover:w-full"
                )} />
              </button>

              {visibleLeftNavItems.map((item) => (
                <button 
                  key={item.href}
                  onClick={() => { setMegaMenuOpen(false); handleNavClick(item.href); }} 
                  className={cn(
                    "font-body text-sm uppercase tracking-[0.18em] font-semibold transition-all duration-300 relative group whitespace-nowrap flex items-center gap-1.5 text-foreground",
                    (activeSection === item.href || isRouteActive(item.href)) && "text-[hsl(var(--gold))]"
                  )}
                >
                  {item.label}
                  <span className={cn(
                    "absolute -bottom-1 left-0 h-0.5 bg-[hsl(var(--gold))] transition-all duration-300",
                    (activeSection === item.href || isRouteActive(item.href)) ? "w-full" : "w-0 group-hover:w-full"
                  )} />
                </button>
              ))}
            </div>

            <span className="w-px h-3 bg-border/60 mx-6 lg:mx-10" aria-hidden="true" />

            <div className="flex items-center gap-6 lg:gap-10">
              {/* Journal */}
              <button
                onClick={() => { setMegaMenuOpen(false); handleNavClick("/journal"); }}
                className={cn(
                  "font-body text-sm uppercase tracking-[0.18em] font-semibold transition-all duration-300 relative group whitespace-nowrap flex items-center gap-1.5 text-foreground",
                  (activeSection === "/journal" || isRouteActive("/journal")) && "text-[hsl(var(--gold))]"
                )}
              >
                Journal
                <span className={cn(
                  "absolute -bottom-1 left-0 h-0.5 bg-[hsl(var(--gold))] transition-all duration-300",
                  (activeSection === "/journal" || isRouteActive("/journal")) ? "w-full" : "w-0 group-hover:w-full"
                )} />
              </button>

              {/* Trade Program — elegant underline */}
              {rightNavItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => {
                    setMegaMenuOpen(false);
                    handleNavClick(item.href);
                  }}
                  className={cn(
                    "font-body text-sm uppercase tracking-[0.18em] font-semibold transition-all duration-300 relative group whitespace-nowrap flex items-center gap-1.5 text-foreground",
                    (activeSection === item.href || isRouteActive(item.href)) && "text-[hsl(var(--gold))]"
                  )}
                >
                  {item.label}
                  <span className={cn(
                    "absolute -bottom-1 left-0 h-px bg-[hsl(var(--gold))] transition-all duration-300",
                    (activeSection === item.href || isRouteActive(item.href)) ? "w-full" : "w-full group-hover:w-full"
                  )} />
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