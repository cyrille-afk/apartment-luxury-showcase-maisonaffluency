import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, X, Crown, Search, ChevronDown, ChevronRight, ChevronLeft, Calendar, MessageCircle, Mail, LayoutGrid, Image, Palette, Gem, Briefcase, BookOpen, Heart, Pin, User, LogIn, UserPlus, LogOut } from "lucide-react";
import { useCompare } from "@/contexts/CompareContext";
import { useAuth } from "@/hooks/useAuth";
import { trackCTA } from "@/lib/analytics";
import { deferHashScrollUntilSheetClosed } from "@/lib/mobileHashNavigation";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { useProgrammaticScrollActive } from "@/lib/programmaticScroll";
import { useStickyProductBarActive } from "@/lib/stickyProductBar";
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
import GalleryDetailsFloatingNav from "@/components/GalleryDetailsFloatingNav";

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

  // Smart scroll: hide the global nav while scrolling down past the hero,
  // reveal it again as soon as the user scrolls up.
  const { direction: scrollDirection, scrollY: navScrollY } = useScrollDirection();
  const stickyProductBarActive = useStickyProductBarActive();
  const programmaticScrollActive = useProgrammaticScrollActive();
  const navHidden =
    ((scrollDirection === "down" && navScrollY > 240 && !programmaticScrollActive) ||
      stickyProductBarActive) &&
    !isOpen &&
    !megaMenuOpen;

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
    const openCategories = () => {
      setIsOpen(true);
      setCategoryPanelOpen(true);
      setExpandedCategory(null);
    };
    window.addEventListener("open-main-menu", openMenu);
    window.addEventListener("open-all-categories", openCategories);
    return () => {
      window.removeEventListener("open-main-menu", openMenu);
      window.removeEventListener("open-all-categories", openCategories);
    };
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

  const renderCategoryBlock = (cat: string) => (
    <div key={cat} className="flex flex-col">
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
            const el = document.getElementById("designers") || document.getElementById("featured-designers");
            if (el instanceof HTMLElement) el.scrollIntoView({ behavior: "smooth", block: "start" });
          } else {
            navigate(target);
          }
        }}
        className={cn(
          "font-display text-[13px] uppercase tracking-[0.22em] font-light transition-colors duration-300 text-left w-full pb-2 border-b border-border/20 mb-2",
          activeMegaCat === cat && !activeMegaSub ? "text-foreground" : "text-foreground/90 hover:text-foreground"
        )}
      >
        {cat}
      </button>
      {SUBCATEGORY_MAP[cat] && (
        <div className="flex flex-col space-y-1 group/list">
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
              className={cn(
                "text-left text-[13px] font-serif font-normal tracking-[0.02em] leading-relaxed text-neutral-500 transition-all duration-300 group-hover/list:text-neutral-900 group-hover/list:opacity-60 hover:opacity-100",
                activeMegaSub === sub && activeMegaCat === cat ? "text-foreground opacity-100" : ""
              )}
            >
              {sub}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return <><nav className={cn(
      "fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top)] transform transition-all duration-300 ease-in-out will-change-transform",
      navHidden ? "-translate-y-full" : "translate-y-0",
      borderless
        ? "bg-[#FAFAFA] border-b border-transparent"
        : "bg-[#FAFAFA] border-b border-border/30"
    )}>

      <div className="mx-auto max-w-7xl md:max-w-[1300px] px-5 md:px-12">
        {/* Mobile: single row */}
          <div className="flex h-24 items-center md:hidden relative justify-between">
           <Sheet open={isOpen} onOpenChange={handleMobileMenuOpenChange}>
            {/* Burger — left edge, vertically centered with flag */}
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-12 w-12 -ml-2 text-primary" aria-label="Toggle menu">
                {isOpen ? <X className="h-8 w-8" strokeWidth={3} /> : <Menu className="h-8 w-8" strokeWidth={3} />}
              </Button>
            </SheetTrigger>

            {/* Brand — centered horizontally */}
            <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            <button onClick={scrollToTop} className="group cursor-pointer whitespace-nowrap">
              <span className="font-brand text-[1.9rem] font-bold tracking-widest text-foreground transition-all duration-300 group-hover:text-primary">
                <span className="group-hover:text-accent transition-colors duration-300">A</span>FFLUENCY
              </span>
            </button>
              <div className="flex items-center gap-2 -mt-0.5 brand-lockup">
                <span className="h-px w-5 bg-foreground" />
                <span className="font-body text-[7px] uppercase tracking-[0.3em] text-foreground font-bold">Est. 2017</span>
                <span className="h-px w-5 bg-foreground" />
              </div>
            </div>

            {/* Flag — right edge, vertically centered with burger */}
            <ShippingDestinationSwitcher compact showIso flagClassName="text-2xl" className="-mr-1" />



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
                <div className="flex-1 overflow-y-auto px-6 py-4 pb-24">
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
                  <div className="flex justify-end mt-6 mb-2">
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
                </div>

                {/* Floating quick-actions — bottom-right of the categories panel */}
                <GalleryDetailsFloatingNav
                  showImmediately
                  forceDisplay
                  azHref="/designers"
                  onAllCategoriesClick={closeMobileMenu}
                  className="md:hidden"
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop: two-row editorial header */}
        <div className="hidden md:flex flex-col items-stretch w-full">
          {/* ROW 1 — centered brand lockup with utilities */}
          <div className="relative flex items-center justify-between py-6 border-b border-zinc-100">
            {/* Left utilities */}
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-600">
              <ShippingDestinationSwitcher compact showIso className="min-h-8 justify-center" />
            </div>

            {/* Centered Brand Title */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-4 whitespace-nowrap">
              <button onClick={scrollToTop} className="group cursor-pointer">
                <span className="font-brand text-[2rem] lg:text-[2.25rem] font-bold tracking-widest text-foreground uppercase transition-colors duration-300 group-hover:text-primary">
                  MAISON <span className="group-hover:text-accent transition-colors duration-300">A</span>FFLUENCY
                </span>
              </button>
              <span className="h-6 w-px bg-zinc-300" />
              <span className="font-body text-[10px] tracking-[0.3em] text-zinc-500 uppercase">Est. 2017</span>
            </div>


            {/* Right Side Icons */}
            <div className="flex items-center gap-6 text-zinc-700">
              <button
                onClick={() => { setMegaMenuOpen(false); handleNavClick("/contact"); }}
                className="text-xs uppercase tracking-[0.15em] hover:text-zinc-900 transition-colors"
              >
                Contact Us
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger className="relative group p-1 outline-none">
                  <User className="w-[16px] h-[16px] text-zinc-600 group-hover:text-zinc-900 transition-colors" strokeWidth={1.25} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="bg-background border border-border shadow-lg z-50 min-w-[200px]">
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
                  className="relative group p-1 transition-colors hover:text-zinc-900"
                >
                  <Heart className="w-[16px] h-[16px] text-zinc-600" strokeWidth={1.25} />
                  {favCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] leading-none px-1">
                      {favCount}
                    </span>
                  )}
                </button>
              </FavoritesHoverPreview>
            </div>
          </div>

          {/* Sub Navigation Bar */}
          <nav className="w-full border-t border-zinc-50 py-4">
            <div className="flex justify-center gap-10 text-[11px] font-normal uppercase tracking-[0.25em] text-zinc-500">
              <button
                onClick={() => { setMegaMenuOpen(false); handleNavClick("/new-in"); }}
                className={cn(
                  "hover:text-zinc-900 transition-colors",
                  isRouteActive("/new-in") && "text-zinc-900 border-b border-zinc-900 pb-1"
                )}
              >
                New In
              </button>

              <button
                onClick={() => { setMegaMenuOpen(!megaMenuOpen); setMegaMenuHoverCat(null); }}
                className={cn(
                  "hover:text-zinc-900 transition-colors flex items-center gap-1 outline-none",
                  (megaMenuOpen || isOnCategoryRoute) && "text-zinc-900 border-b border-zinc-900 pb-1"
                )}
              >
                Categories
                <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${megaMenuOpen ? "rotate-180" : ""}`} strokeWidth={1.5} />
              </button>

              <button
                onClick={() => { setMegaMenuOpen(false); handleNavClick("/designers"); }}
                className={cn(
                  "hover:text-zinc-900 transition-colors",
                  (activeSection === "/designers" || isRouteActive("/designers")) && "text-zinc-900 border-b border-zinc-900 pb-1"
                )}
              >
                Designers
              </button>

              <button
                onClick={() => { setMegaMenuOpen(false); handleNavClick("/gallery"); }}
                className={cn(
                  "hover:text-zinc-900 transition-colors",
                  (activeSection === "/gallery" || isRouteActive("/gallery")) && "text-zinc-900 border-b border-zinc-900 pb-1"
                )}
              >
                Interactive Gallery
              </button>

              <button
                onClick={() => { setMegaMenuOpen(false); handleNavClick("/journal"); }}
                className={cn(
                  "hover:text-zinc-900 transition-colors",
                  (activeSection === "/journal" || isRouteActive("/journal")) && "text-zinc-900 border-b border-zinc-900 pb-1"
                )}
              >
                Journal
              </button>

              <button
                onClick={() => { setMegaMenuOpen(false); handleNavClick("/trade-program"); }}
                className={cn(
                  "hover:text-zinc-900 transition-colors",
                  (activeSection === "/trade-program" || isRouteActive("/trade-program")) && "text-zinc-900 border-b border-zinc-900 pb-1"
                )}
              >
                Trade Program
              </button>

              {isTradeUser && (
                <button
                  onClick={() => { setMegaMenuOpen(false); handleNavClick("/collectibles"); }}
                  className={cn(
                    "hover:text-zinc-900 transition-colors",
                    (activeSection === "/collectibles" || isRouteActive("/collectibles")) && "text-zinc-900 border-b border-zinc-900 pb-1"
                  )}
                >
                  Collectibles
                </button>
              )}
            </div>
          </nav>
        </div>


        {/* Horizontal mega menu */}
        {megaMenuOpen && (
          <div
            ref={megaMenuRef}
            className="w-[68vw] max-w-5xl mx-auto border-t border-border/20 bg-background/95 backdrop-blur-xl shadow-[0_20px_60px_-15px_hsl(var(--foreground)/0.12)] py-10 px-8 lg:px-12"
            style={{ animation: "megaMenuReveal 520ms cubic-bezier(0.22, 1, 0.36, 1) forwards" }}
          >
            <style>{`
              @keyframes megaMenuReveal {
                from { opacity: 0; filter: blur(10px); transform: translateY(-10px); }
                to { opacity: 1; filter: blur(0); transform: translateY(0); }
              }
            `}</style>
            <div className="w-full grid grid-cols-4 gap-x-12 items-start">
              {/* Column 1 */}
              <div className="min-w-0">
                {renderCategoryBlock("Seating")}
                <div className="mt-6">{renderCategoryBlock("Lighting")}</div>
              </div>
              {/* Column 2 */}
              <div className="min-w-0">
                {renderCategoryBlock("Tables")}
                <div className="mt-6">{renderCategoryBlock("Bedroom")}</div>
              </div>
              {/* Column 3 */}
              <div className="min-w-0">
                {renderCategoryBlock("Storage")}
              </div>
              {/* Column 4 */}
              <div className="min-w-0">
                {renderCategoryBlock("Rugs")}
                <div className="mt-6">{renderCategoryBlock("Décor")}</div>
              </div>
            </div>

          </div>
        )}
      </div>
    </nav>
    <AuthGateDialog open={authGateOpen} onClose={() => setAuthGateOpen(false)} action="access your account" initialMode={authGateMode} />
    </>;
};
export default Navigation;