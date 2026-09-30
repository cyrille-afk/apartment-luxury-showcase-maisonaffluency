import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, X, Crown, Search, ChevronDown, ChevronRight, ChevronLeft, Calendar, MessageCircle, Mail, LayoutGrid, Image, Palette, Gem, Briefcase, BookOpen, Heart, Pin, User, LogIn, UserPlus, LogOut } from "lucide-react";
import TradeServicesRequestModal from "@/components/trade/TradeServicesRequestModal";
import { useWishlist } from "@/contexts/WishlistContext";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import livingRoomAmbient from "@/assets/living-room-hero.jpg";
import diningRoomAmbient from "@/assets/dining-room.jpg";
import intimateDiningAmbient from "@/assets/intimate-dining.jpg";
import calmingBedroomAmbient from "@/assets/master-suite.jpg";
import { useRoomPreviewScene } from "@/hooks/useRoomPreviewScene";
import { preloadImage } from "@/lib/curatorPickPreload";
// Interaction-only surfaces: loaded on demand so the header does not drag the
// auth/OAuth + hover-preview code into the first-paint bundle.
const AuthGateDialog = React.lazy(() => import("@/components/AuthGateDialog"));
const GalleryDetailsFloatingNav = React.lazy(() => import("@/components/GalleryDetailsFloatingNav"));

// useFeaturedPublicDocument import removed — AD free-download flow discontinued.
const FavoritesHoverPreview = React.lazy(() => import("@/components/FavoritesHoverPreview"));
import ShippingDestinationSwitcher from "@/components/ShippingDestinationSwitcher";
import CartNavButton from "@/components/CartNavButton";
const logoIcon = cloudinaryUrl("affluency-logo-icon_mpchum", { width: 200, quality: "auto", crop: "fill" });

type RoomNavKey = "living" | "dining" | "bedroom" | "lighting" | "decor";

interface RoomNavCategory {
  label: string;
  category: string;
  subcategories: string[];
}

const roomNavigation: Record<RoomNavKey, RoomNavCategory[]> = {
  living: [
    { label: "Seating", category: "Seating", subcategories: ["Sofas", "Armchairs", "Chairs", "Daybeds & Benches", "Ottomans & Stools"] },
    { label: "Tables", category: "Tables", subcategories: ["Coffee Tables", "Side Tables", "Consoles"] },
    { label: "Storage", category: "Storage", subcategories: ["Buffets, Cabinets And Sideboards", "Bookcases", "Bars"] },
    { label: "Lighting", category: "Lighting", subcategories: ["Floor Lights", "Table Lights", "Wall Lights", "Ceiling Lights"] },
    { label: "Rugs", category: "Rugs", subcategories: ["Hand-Knotted Rugs", "Hand-Tufted Rugs", "Hand-Woven Rugs"] },
    { label: "Décor", category: "Décor", subcategories: ["Mirrors", "Decorative Objects", "Cushions & Throws", "Vases & Vessels"] },
  ],
  dining: [
    { label: "Dining Tables", category: "Tables", subcategories: ["Dining Tables"] },
    { label: "Dining Seating", category: "Seating", subcategories: ["Chairs", "Ottomans & Stools"] },
    { label: "Sideboards & Bars", category: "Storage", subcategories: ["Buffets, Cabinets And Sideboards", "Bars"] },
    { label: "Lighting", category: "Lighting", subcategories: ["Ceiling Lights", "Wall Lights", "Table Lights"] },
    { label: "Tableware", category: "Décor", subcategories: ["Tableware & Linens", "Candle Holders", "Vases & Vessels"] },
    { label: "Rugs", category: "Rugs", subcategories: ["Hand-Knotted Rugs", "Hand-Tufted Rugs", "Hand-Woven Rugs"] },
  ],
  bedroom: [
    { label: "Beds", category: "Bedroom", subcategories: ["Beds", "Bedding", "Sofa-Beds"] },
    { label: "Bedside Tables", category: "Bedroom", subcategories: ["Bedside Tables"] },
    { label: "Bedroom Seating", category: "Seating", subcategories: ["Armchairs", "Daybeds & Benches", "Ottomans & Stools"] },
    { label: "Storage", category: "Storage", subcategories: ["Buffets, Cabinets And Sideboards", "Bookcases"] },
    { label: "Lighting", category: "Lighting", subcategories: ["Table Lights", "Wall Lights", "Floor Lights"] },
    { label: "Textiles & Décor", category: "Décor", subcategories: ["Cushions & Throws", "Mirrors", "Decorative Objects"] },
  ],
  lighting: [
    { label: "Ceiling Lights", category: "Lighting", subcategories: ["Ceiling Lights"] },
    { label: "Wall Lights", category: "Lighting", subcategories: ["Wall Lights"] },
    { label: "Table Lights", category: "Lighting", subcategories: ["Table Lights"] },
    { label: "Floor Lights", category: "Lighting", subcategories: ["Floor Lights"] },
    { label: "Bathroom Lights", category: "Lighting", subcategories: ["Bathroom Lights"] },
    { label: "Outdoor Lights", category: "Lighting", subcategories: ["Outdoor Lights"] },
  ],
  decor: [],
};

// Decor mega-menu reads the canonical Décor subcategories (13) from the shared taxonomy.
const DECOR_SUBCATEGORIES = SUBCATEGORY_MAP["Décor"] ?? [];
const DECOR_COLUMNS: string[][] = (() => {
  // Balanced 7 / 6 split for 13 items (2 columns beside the photo panel).
  const cols = 2;
  const base = Math.floor(DECOR_SUBCATEGORIES.length / cols);
  const extra = DECOR_SUBCATEGORIES.length % cols;
  const out: string[][] = [];
  let i = 0;
  for (let c = 0; c < cols; c++) {
    const n = base + (c < extra ? 1 : 0);
    out.push(DECOR_SUBCATEGORIES.slice(i, i + n));
    i += n;
  }
  return out;
})();

const roomFlyouts: Partial<Record<RoomNavKey, { label: string; slug: string }[]>> = {
  living: [{ label: "Living Rooms", slug: "living-room" }, { label: "Office", slug: "office" }],
  dining: [{ label: "Dining", slug: "dining-room" }],
  bedroom: [{ label: "Bedroom", slug: "bedroom" }],
};

const officeNavigation: RoomNavCategory[] = [
  { label: "Desks", category: "Tables", subcategories: ["Desks"] },
  { label: "Office Seating", category: "Seating", subcategories: ["Office Chairs", "Armchairs"] },
  { label: "Storage", category: "Storage", subcategories: ["Bookcases", "Buffets, Cabinets And Sideboards"] },
  { label: "Lighting", category: "Lighting", subcategories: ["Table Lights", "Floor Lights"] },
  { label: "Rugs", category: "Rugs", subcategories: ["Hand-Knotted Rugs", "Hand-Woven Rugs"] },
];

const roomAmbientImages: Record<RoomNavKey, { src: string; alt: string }> = {
  living: { src: livingRoomAmbient, alt: "Sculptural furniture in an architectural living room" },
  dining: { src: intimateDiningAmbient, alt: "Intimate dining setting with collectible furniture" },
  bedroom: { src: calmingBedroomAmbient, alt: "Calming bedroom with layered natural materials" },
  lighting: { src: diningRoomAmbient, alt: "Refined dining room with collectible furniture and sculptural lighting" },
  decor: { src: "https://res.cloudinary.com/dif1oamtj/image/upload/v1774842687/IMG_2397-resized_rufbef.jpg", alt: "Curated décor objects and wall art" },
};

// Download the three room photographs together, rather than waiting for each
// dropdown to mount its own image after the visitor moves across the nav.
const preloadRoomMenuPhotos = () => {
  void Promise.all(
    (["living", "dining", "bedroom"] as const).map((room) =>
      preloadImage(roomAmbientImages[room].src, "low"),
    ),
  );
};

// Coordinates are percentages of the displayed, centre-cropped preview frame.
// Scene data is shared with the Room Experience landing page via
// src/lib/roomPreviewScenes.ts so menu and page never drift apart.
const RoomVisualPreview = ({ room, selectedRoomSlug }: { room: RoomNavKey; selectedRoomSlug?: string }) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(false);
  const [photoReady, setPhotoReady] = useState(false);
  const scene = useRoomPreviewScene(selectedRoomSlug);
  const pieceSources = scene.pieces.map((piece) => piece.src).join("|");
  const [readyPieceSources, setReadyPieceSources] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.all(scene.pieces.map((piece) => preloadImage(piece.src, "auto"))).then(() => {
      if (active) setReadyPieceSources(pieceSources);
    });
    return () => { active = false; };
  }, [pieceSources]);
  const previewImage = selectedRoomSlug === "office" || selectedRoomSlug === "living-room" || selectedRoomSlug === "dining-room" || selectedRoomSlug === "bedroom" ? scene.previewImage : roomAmbientImages[room];
  return (
  <div data-room-preview className="flex min-w-0 flex-1 flex-col items-center justify-center bg-[hsl(var(--collection-card-canvas))] px-7 py-7">
    <div className="w-full max-w-[380px] border border-border/60 bg-background p-2 shadow-sm">
      <div className="relative h-[190px] bg-muted">
          <img src={previewImage.src} alt={previewImage.alt} onLoad={() => setPhotoReady(true)} className={cn("h-full w-full object-cover transition-opacity duration-300", photoReady ? "opacity-100" : "opacity-0")} />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
             <Button type="button" variant="ghost" size="icon" aria-label={`Shop this look: ${scene.hotspot.label}; highlight curated alternatives`} aria-expanded={open}
              onPointerEnter={(event) => { if (event.pointerType === "mouse") setOpen(true); }}
              onPointerLeave={(event) => { if (event.pointerType === "mouse") setOpen(false); }}
              onClick={() => { setSelected(true); setOpen(true); }}
               style={{ left: `${scene.hotspot.left}%`, top: `${scene.hotspot.top}%` }}
               className="group absolute z-10 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full p-0 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring">
               <span className="relative block size-3.5 rounded-full border border-background/90 bg-foreground shadow-lg transition-transform group-hover:scale-110">
                 <span className="absolute left-1/2 top-1/2 h-px w-1.5 -translate-x-1/2 -translate-y-1/2 bg-background" />
                 <span className="absolute left-1/2 top-1/2 h-1.5 w-px -translate-x-1/2 -translate-y-1/2 bg-background" />
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="center" sideOffset={2} onOpenAutoFocus={(event) => event.preventDefault()} className="pointer-events-none w-auto rounded-none border-border bg-background/95 px-3 py-1.5 font-body text-xs text-foreground shadow-sm">Shop this Look</PopoverContent>
        </Popover>
      </div>
      <div className="px-1 pb-1 pt-3">
        <div className="mb-2 font-body text-[9px] uppercase text-muted-foreground">Curated alternatives</div>
            <div className={cn("grid grid-cols-3 gap-2 transition-all duration-300", readyPieceSources === pieceSources ? "opacity-100" : "opacity-0", selected && "ring-1 ring-primary ring-offset-2 ring-offset-background")}>
            {scene.pieces.map((piece, index) => (
              <div key={piece.src} className={cn("overflow-hidden border-2 bg-muted transition-all duration-300", selected && index === scene.highlightIndex ? "border-primary opacity-100" : "border-transparent opacity-80")}>
                <div className="aspect-[4/3] overflow-hidden bg-[hsl(var(--collection-card-canvas))]">
                  <img src={piece.src} alt={piece.alt} className="h-full w-full object-contain" />
               </div>
               {"name" in piece && (
                 <div className="bg-background px-1.5 py-1.5">
                   <div className="truncate font-body text-[10px] font-semibold leading-tight text-foreground">{piece.name}</div>
                   <div className="truncate font-body text-[9px] leading-tight text-muted-foreground">{piece.designer}</div>
                 </div>
               )}
            </div>
          ))}
        </div>
      </div>
    </div>
    <p className="mt-6 w-full max-w-[354px] text-center font-body text-[13px] font-bold leading-relaxed text-crimson-black">
      Leverage our global designers network and sourcing capabilities to elevate your portfolio of projects
    </p>
  </div>
  );
};

interface RoomDropdownPanelProps {
  room: "living" | "dining" | "bedroom";
  activeCategory: number | null;
  onSelectCategory: (index: number) => void;
  onCategoryNavigate: (roomSlug: string, category: string, subcategory?: string) => void;
  onRoomNavigate: (slug: string) => void;
}

const RoomDropdownPanel = ({ room, activeCategory, onSelectCategory, onCategoryNavigate, onRoomNavigate }: RoomDropdownPanelProps) => {
  const [selectedRoom, setSelectedRoom] = useState(0);
  const categories = room === "living" && selectedRoom === 1 ? officeNavigation : roomNavigation[room];
  return (
  <div className="flex min-h-[470px] items-stretch overflow-hidden">
    <div className="w-[310px] shrink-0 border-r border-border/60 px-8 py-7">
      <div className="flex flex-col">
        <div className="font-body text-[13px] font-bold text-foreground">Shop By Room</div>
        <div className="mt-3 flex flex-col gap-1">
          {roomFlyouts[room]?.map((link, index) => (
            <Button key={link.slug} type="button" variant="ghost" onMouseEnter={() => { setSelectedRoom(index); onSelectCategory(null); }} onFocus={() => { setSelectedRoom(index); onSelectCategory(null); }} onClick={() => onRoomNavigate(link.slug)} className={cn("h-8 w-full justify-start gap-2 rounded-none px-0 font-body text-[13px] hover:bg-transparent hover:text-foreground", selectedRoom === index ? "font-semibold text-foreground" : "font-normal text-muted-foreground")}>
              <ChevronRight className="size-3 shrink-0" strokeWidth={1.25} />{link.label}
            </Button>
          ))}
        </div>
        <div className="mt-5 border-t border-border/60 pt-3">
        {categories.map((item, index) => (
          <div key={item.label} onMouseEnter={() => onSelectCategory(index)}>
            <Button
              type="button" variant="ghost"
              onFocus={() => onSelectCategory(index)}
              onClick={() => onCategoryNavigate(roomFlyouts[room]?.[selectedRoom]?.slug ?? "living-room", item.category)}
              aria-expanded={activeCategory === index}
              className={cn("flex h-9 w-full justify-between rounded-none p-0 font-body text-[13px] font-normal hover:bg-transparent hover:text-foreground", activeCategory === index ? "text-foreground" : "text-muted-foreground")}
            >
              {item.label}
              <ChevronRight className={cn("size-3 transition-transform", activeCategory === index && "rotate-90")} strokeWidth={1.25} />
            </Button>
            {activeCategory === index && (
              <div className="mb-2 flex flex-col border-l border-border pl-4">
                {item.subcategories.map((subcategory) => (
                  <Button key={subcategory} type="button" variant="ghost" onClick={() => onCategoryNavigate(roomFlyouts[room]?.[selectedRoom]?.slug ?? "living-room", item.category, subcategory)} className="min-h-7 h-auto w-full justify-start whitespace-normal rounded-none px-0 py-1 text-left font-body text-xs font-normal leading-snug text-muted-foreground hover:bg-transparent hover:text-foreground">
                    {subcategory}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ))}
        </div>
      </div>
    </div>
     <RoomVisualPreview key={roomFlyouts[room]?.[selectedRoom]?.slug ?? room} room={room} selectedRoomSlug={roomFlyouts[room]?.[selectedRoom]?.slug} />
  </div>
  );
};

const leftNavItems = [{
  label: "Designers",
  mobileLabel: "Designers & Makers",
  href: "/designers",
  icon: Palette,
}, {
  label: "Our Gallery",
  mobileLabel: "Our Gallery",
  href: "/gallery",
  icon: Image,
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
  alwaysVisible?: boolean;
}

const Navigation = ({ borderless = false, alwaysVisible = false }: NavigationProps) => {
  useEffect(() => {
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    // Leave first paint to the page, then warm all three menu photos in parallel.
    // Hover starts them immediately if the visitor reaches the nav first.
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(preloadRoomMenuPhotos, { timeout: 1800 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(preloadRoomMenuPhotos, 400);
    return () => window.clearTimeout(id);
  }, []);
  const { user, isTradeUser } = useAuth();
  const visibleLeftNavItems = leftNavItems;
  const { items: pinItems, setIsComparing } = useCompare();
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [authGateMounted, setAuthGateMounted] = useState(false);
  useEffect(() => {
    if (authGateOpen) setAuthGateMounted(true);
  }, [authGateOpen]);
  const [authGateMode, setAuthGateMode] = useState<"prompt" | "signup" | "login">("prompt");
  // Global wishlist state (localStorage-backed, shared via WishlistProvider)
  const { count: favCount } = useWishlist();
  // Rendered both as the Suspense fallback and as the hover-preview trigger so
  // the wishlist icon is never missing while its preview chunk loads.
  const favoritesButton = (
    <button
      onClick={() => navigate("/favorites")}
      aria-label="Wishlist"
      className="relative group p-1 transition-colors hover:text-foreground"
    >
      <Heart className="w-[16px] h-[16px] text-muted-foreground" strokeWidth={1.25} />
      {favCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] leading-none px-1">
          {favCount}
        </span>
      )}
    </button>
  );
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
  const [tradeMenuOpen, setTradeMenuOpen] = useState(false);
  // Delayed close so a stray cursor movement doesn't instantly kill the TRADE dropdown
  const tradeMenuCloseTimer = useRef<number | null>(null);
  const openTradeMenu = () => {
    if (tradeMenuCloseTimer.current !== null) {
      window.clearTimeout(tradeMenuCloseTimer.current);
      tradeMenuCloseTimer.current = null;
    }
    setTradeMenuOpen(true);
  };
  const scheduleTradeMenuClose = () => {
    if (tradeMenuCloseTimer.current !== null) window.clearTimeout(tradeMenuCloseTimer.current);
    tradeMenuCloseTimer.current = window.setTimeout(() => setTradeMenuOpen(false), 200);
  };
  useEffect(() => () => {
    if (tradeMenuCloseTimer.current !== null) window.clearTimeout(tradeMenuCloseTimer.current);
  }, []);
  // Keeps the desktop TRADE link's left edge flush with JOURNAL's left edge
  // in the nav tier below (offset shifts the utility cluster horizontally).
  const utilityClusterRef = useRef<HTMLDivElement>(null);
  const [utilityAlignOffset, setUtilityAlignOffset] = useState(0);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [mobileTradeExpanded, setMobileTradeExpanded] = useState(false);
  const [activeRoomMenu, setActiveRoomMenu] = useState<RoomNavKey | null>(null);
  const [activeRoomCategory, setActiveRoomCategory] = useState<number | null>(null);
  const [roomMenuOverflow, setRoomMenuOverflow] = useState(0);
  const [activeMegaCat, setActiveMegaCat] = useState<string | null>(null);
  const [activeMegaSub, setActiveMegaSub] = useState<string | null>(null);
  const megaMenuRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!megaMenuOpen || !activeRoomMenu || !megaMenuRef.current) return;
    const measure = () => {
      const menu = megaMenuRef.current;
      if (!menu) return;
      // Undo the prior shift before measuring so switching between rooms never compounds it.
      const naturalRight = menu.getBoundingClientRect().right + roomMenuOverflow;
      setRoomMenuOverflow(Math.max(0, Math.ceil(naturalRight - window.innerWidth + 24)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [megaMenuOpen, activeRoomMenu, roomMenuOverflow]);

  // Align the desktop TRADE utility link's left edge with the JOURNAL nav
  // link's left edge. The nav row is centered while the utility cluster is
  // right-anchored, so the exact offset is measured and applied on
  // mount, resize and after web fonts settle.
  useEffect(() => {
    const align = () => {
      const tradeEl = utilityClusterRef.current?.querySelector<HTMLElement>("[data-utility-trade]");
      const journalEl = document.querySelector<HTMLElement>("[data-nav-journal]");
      if (!tradeEl || !journalEl || !tradeEl.offsetWidth || !journalEl.offsetWidth) {
        setUtilityAlignOffset(0);
        return;
      }
      const tradeLeft = tradeEl.getBoundingClientRect().left;
      const journalLeft = journalEl.getBoundingClientRect().left;
      setUtilityAlignOffset((prev) => Math.round((prev + (tradeLeft - journalLeft)) * 100) / 100);
    };
    align();
    window.addEventListener("resize", align);
    if (typeof document !== "undefined" && "fonts" in document) {
      (document as Document & { fonts: FontFaceSet }).fonts.ready.then(() => align()).catch(() => {});
    }
    const t = window.setTimeout(align, 400);
    return () => {
      window.removeEventListener("resize", align);
      window.clearTimeout(t);
    };
  }, []);
  const roomMenuCloseTimer = useRef<number | null>(null);
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
  // The contact view is a destination form — the header must stay pinned
  // there so the user always has a way back out.
  const isContactRoute = location.pathname === "/contact";
  const closeContactView = () => {
    // "default" key = this page is the first entry of the SPA session, so
    // there is nothing in-app to go back to — send the visitor home.
    if (location.key !== "default" && window.history.length > 1) navigate(-1);
    else navigate("/");
  };
  const navHidden =
    !alwaysVisible &&
    location.pathname !== "/trade-program" &&
    !isContactRoute &&
    // While the product mini bar is docked below the header, the header
    // stays pinned so the bar never floats in empty space.
    !stickyProductBarActive &&
    scrollDirection === "down" &&
    navScrollY > 240 &&
    !programmaticScrollActive &&
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
      // Trade Program: force the 3-step application form back to a clean step 1,
      // even when already on the page after a "Thank You" submission.
      if (href.startsWith("/trade-program")) {
        localStorage.removeItem("tradeProgramApplication");
        navigate(href, { state: { smoothScroll: true, resetApplication: Date.now() } });
        return;
      }
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

  const navigateFromMegaMenu = (category: string, subcategory: string | null = null) => {
    setActiveMegaCat(category);
    setActiveMegaSub(subcategory);
    setMegaMenuOpen(false);
    navigate(categoryUrl(category, subcategory));
  };

  const openRoomMenu = (room: RoomNavKey) => {
    if (roomMenuCloseTimer.current !== null) window.clearTimeout(roomMenuCloseTimer.current);
    if (activeRoomMenu !== room || !megaMenuOpen) setActiveRoomCategory(null);
    setActiveRoomMenu(room);
    setMegaMenuOpen(true);
  };

  const navigateToRoom = (room: string) => {
    setMegaMenuOpen(false);
    setActiveRoomMenu(null);
    navigate(`/search?room=${room}&view=grid`);
  };

  const navigateToRoomCategory = (room: string, category: string, subcategory?: string) => {
    setMegaMenuOpen(false);
    setActiveRoomMenu(null);
    const params = new URLSearchParams({ room, view: "grid", category });
    if (subcategory) params.set("subcategory", subcategory);
    navigate(`/search?${params.toString()}`);
  };

  const scheduleRoomMenuClose = () => {
    if (roomMenuCloseTimer.current !== null) window.clearTimeout(roomMenuCloseTimer.current);
    roomMenuCloseTimer.current = window.setTimeout(() => {
      setMegaMenuOpen(false);
      setActiveRoomMenu(null);
    }, 140);
  };

  const keepRoomMenuOpen = () => {
    if (roomMenuCloseTimer.current !== null) window.clearTimeout(roomMenuCloseTimer.current);
  };

  return <><nav className={cn(
      "fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top)] transform transition-all duration-300 ease-in-out will-change-transform",
      navHidden ? "-translate-y-full" : "translate-y-0",
      location.pathname === "/trade-program"
        ? "bg-background/90 backdrop-blur-md border-b border-border/30"
        : borderless
        ? "bg-[#FAFAFA] border-b border-transparent md:bg-white md:border-b md:border-zinc-100"
        : "bg-[#FAFAFA] border-b border-border/30 md:bg-white md:border-b md:border-zinc-100"
    )}>

      <div className="mx-auto w-full max-w-[1500px] px-6">
        {/* Mobile: single row */}
        <div className="relative flex h-20 xsp:h-24 items-center justify-between md:hidden">
          <Sheet open={isOpen} onOpenChange={handleMobileMenuOpenChange}>
            {/* Left-side group: burger + flag; fixed width to mirror right group so the logo stays dead-center */}
            <div className="relative z-10 flex items-center gap-0 w-[88px] xsp:w-[96px] shrink-0 -ml-2 xsp:-ml-1">
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-12 w-12 text-primary" aria-label="Toggle menu">
                  {isOpen ? <X className="h-8 w-8" strokeWidth={3} /> : <Menu className="h-8 w-8" strokeWidth={3} />}
                </Button>
              </SheetTrigger>

              {/* Currency / shipping-destination flag — between burger and the centered logo */}
              <ShippingDestinationSwitcher compact className="flex min-h-10 min-w-10 px-0 shrink-0" flagClassName="text-lg" />
            </div>

            {/* Brand — absolutely centered in the viewport; side groups reserve equal space */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center max-w-[calc(100%-176px)] xsp:max-w-[calc(100%-192px)] pointer-events-auto">
                <button onClick={scrollToTop} className="group flex min-h-[44px] cursor-pointer items-center whitespace-nowrap">
                  <span data-testid="mobile-brand-logo" className="font-brand text-[1.1rem] xs:text-[1.45rem] xsp:text-[1.65rem] font-bold tracking-widest text-foreground transition-all duration-300 group-hover:text-primary">
                    <span className="group-hover:text-accent transition-colors duration-300">A</span>FFLUENCY
                  </span>
                </button>
                <div className="flex items-center gap-2 -mt-0.5 brand-lockup">
                  <span className="h-px w-5 bg-foreground" />
                  <span className="font-body text-[7px] uppercase tracking-[0.3em] text-foreground font-bold">Est. 2017</span>
                  <span className="h-px w-5 bg-foreground" />
                </div>
              </div>
            </div>

            {/* Right-side group: sign-in + cart; fixed width to mirror left group so the logo stays dead-center */}
            <div
              className={cn(
                "relative z-10 flex items-center justify-end gap-1 w-[88px] xsp:w-[96px] shrink-0"
              )}
            >
              <button
                type="button"
                onClick={() => {
                  if (user) {
                    navigate("/trade");
                  } else {
                    setAuthGateMode("login");
                    setAuthGateOpen(true);
                  }
                }}
                aria-label={user ? "My account" : "Sign in"}
                className="relative flex items-center justify-center w-10 h-10 text-foreground hover:text-primary transition-colors"
              >
                <User className="w-[20px] h-[20px]" strokeWidth={1.5} />
              </button>
              <CartNavButton iconClassName="w-[20px] h-[20px] text-foreground" />
              {isContactRoute && (
                <button
                  type="button"
                  onClick={closeContactView}
                  aria-label="Close contact view and go back"
                  className="relative flex items-center justify-center w-10 h-10 text-foreground hover:text-primary transition-colors"
                >
                  <X className="w-[20px] h-[20px]" strokeWidth={1.5} />
                </button>
              )}
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

                {/* Trade — expandable accordion */}
                <div
                  className="mt-6 pt-4 border-t border-border/50 animate-fade-in opacity-0"
                  style={{ animationDelay: `${(visibleLeftNavItems.length + 3) * 120}ms`, animationFillMode: 'forwards' }}
                >
                  <button
                    onClick={() => setMobileTradeExpanded((o) => !o)}
                    aria-expanded={mobileTradeExpanded}
                    className="font-body text-[15px] uppercase tracking-wide text-left transition-colors py-2.5 w-full flex items-center justify-between text-foreground hover:text-primary font-semibold"
                  >
                    Trade
                    <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${mobileTradeExpanded ? "rotate-90" : ""}`} />
                  </button>
                  {mobileTradeExpanded && (
                    <div className="ml-4 mb-1 border-l border-border/30 pl-4 flex flex-col">
                      <button onClick={() => { closeMobileMenu(); handleNavClick("/trade/login"); }} className="text-left font-body text-[12px] uppercase tracking-[0.15em] text-muted-foreground hover:text-primary transition-colors py-2 font-semibold">Sign-In</button>
                      <button onClick={() => { closeMobileMenu(); handleNavClick("/trade-program?intent=apply"); }} className="text-left font-body text-[12px] uppercase tracking-[0.15em] text-muted-foreground hover:text-primary transition-colors py-2 font-semibold">Join</button>
                      <button onClick={() => { closeMobileMenu(); setServicesOpen(true); }} className="text-left font-body text-[12px] uppercase tracking-[0.15em] text-muted-foreground hover:text-primary transition-colors py-2 font-semibold">Request Services</button>
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
                <React.Suspense fallback={null}>
                  <GalleryDetailsFloatingNav
                    showImmediately
                    forceDisplay
                    azHref="/designers"
                    onAllCategoriesClick={closeMobileMenu}
                    className="md:hidden"
                  />
                </React.Suspense>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop: single-row symmetrical luxury header */}
        <div className="hidden md:flex flex-col items-stretch w-full">
          {/* ROW 1 — wordmark centered independently of its date badge */}
          <div className="relative grid min-h-16 grid-cols-3 items-center justify-items-center border-b border-neutral-100 py-3">
            <div className="flex items-center justify-self-start">
              <ShippingDestinationSwitcher compact showIso className="min-h-8 justify-center" />
            </div>

            <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap">
              <button onClick={scrollToTop} className="group cursor-pointer">
                <span className="font-brand text-2xl lg:text-3xl font-normal tracking-[0.18em] text-foreground transition-opacity duration-300 group-hover:opacity-70">
                  MAISON AFFLUENCY
                </span>
              </button>
              <span className="absolute left-full top-1/2 ml-5 flex -translate-y-1/2 items-center gap-5 lg:ml-6 lg:gap-6">
                <span aria-hidden="true" className="h-3.5 w-px bg-foreground/25" />
                <span className="font-body text-[7px] uppercase tracking-[0.3em] font-light text-foreground">Est. 2017</span>
              </span>
            </div>

            <div
              ref={utilityClusterRef}
              className="relative flex items-center gap-5 justify-self-end"
              style={utilityAlignOffset ? { marginRight: `${utilityAlignOffset}px` } : undefined}
            >
              {isContactRoute ? (
                <button
                  type="button"
                  onClick={closeContactView}
                  aria-label="Close contact view and go back"
                  className="group p-1 outline-none"
                >
                  <X className="w-[16px] h-[16px] text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.25} />
                </button>
              ) : (
                <div
                  className="flex items-center"
                  onMouseEnter={openTradeMenu}
                  onMouseLeave={scheduleTradeMenuClose}
                >
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={tradeMenuOpen}
                    data-utility-trade
                    onClick={() => setTradeMenuOpen((o) => !o)}
                    className="font-body text-[12px] uppercase tracking-[0.2em] font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap py-2"
                  >
                    <span className="link-underline-grow">Trade</span>
                  </button>
                  <div
                    role="menu"
                    className={cn(
                      // Invisible hover bridge above the card keeps the menu open while the
                      // cursor travels from the TRADE link down into the panel.
                      "absolute right-0 top-full z-[60] pt-[61px] transition-opacity duration-200",
                      "before:absolute before:-top-4 before:left-0 before:h-4 before:w-full before:content-['']",
                      tradeMenuOpen ? "opacity-100 visible" : "opacity-0 invisible"
                    )}
                  >
                    <div className="w-[300px] border border-border bg-background py-6 px-8 shadow-lg flex flex-col gap-4">
                      <button role="menuitem" onClick={() => { setTradeMenuOpen(false); setMegaMenuOpen(false); handleNavClick("/trade/login"); }} className="text-left font-body text-sm text-foreground hover:text-muted-foreground transition-colors">
                        Affluency Trade Program Sign-In
                      </button>
                      <button role="menuitem" onClick={() => { setTradeMenuOpen(false); setMegaMenuOpen(false); handleNavClick("/trade-program?intent=apply"); }} className="text-left font-body text-sm text-foreground hover:text-muted-foreground transition-colors">
                        Join The Affluency Trade Program
                      </button>
                      <button role="menuitem" onClick={() => { setTradeMenuOpen(false); setServicesOpen(true); }} className="text-left font-body text-sm text-foreground hover:text-muted-foreground transition-colors">
                        Request Affluency Trade Services
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger aria-label="Account menu" title="Account" className="relative group p-1 outline-none">
                  <span className="sr-only">Account menu</span>
                  <User className="w-[16px] h-[16px] text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.25} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={122} className="bg-background border border-border shadow-lg z-50 min-w-[200px] translate-x-[44px]">
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
                        onClick={async () => { const { supabase } = await import("@/integrations/supabase/client"); await supabase.auth.signOut(); window.location.reload(); }}
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
                        onClick={() => handleNavClick("/trade-program")}
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted transition-colors"
                      >
                        <Briefcase className="h-4 w-4 text-[hsl(var(--gold))]" />
                        <span className="font-body text-sm">Trade Program</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <React.Suspense fallback={favoritesButton}>
                <FavoritesHoverPreview favCount={favCount}>
                  {favoritesButton}
                </FavoritesHoverPreview>
              </React.Suspense>

              <CartNavButton />
            </div>
          </div>

          {/* ROW 2 — primary navigation bar */}
          <nav className="mx-auto flex min-h-12 w-full max-w-[1400px] items-center justify-center gap-10 px-2 py-2 lg:gap-14 lg:px-6 xl:gap-20 xl:px-0">
              <button
                onClick={() => { setMegaMenuOpen(false); handleNavClick("/gallery"); }}
                className={cn(
                  "group relative font-body text-[12px] uppercase tracking-[0.2em] font-normal text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap",
                  (activeSection === "/gallery" || isRouteActive("/gallery")) && "text-foreground"
                )}
              >
                <span className="link-underline-grow">Our Gallery</span>
              </button>

              <button
                onClick={() => { setMegaMenuOpen(false); handleNavClick("/designers"); }}
                className={cn(
                  "group relative font-body text-[12px] uppercase tracking-[0.2em] font-normal text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap",
                  (activeSection === "/designers" || isRouteActive("/designers")) && "text-foreground"
                )}
              >
                <span className="link-underline-grow">Designers</span>
              </button>

              {(Object.keys(roomNavigation) as RoomNavKey[]).map((room) => (
                <div
                  key={room}
                  className="relative"
                  onMouseEnter={keepRoomMenuOpen}
                  onMouseLeave={scheduleRoomMenuClose}
                >
                  <Button
                    type="button"
                    variant="ghost"
                     onMouseEnter={() => { if (room === "living" || room === "dining" || room === "bedroom") preloadRoomMenuPhotos(); openRoomMenu(room); }}
                    onFocus={() => openRoomMenu(room)}
                    onClick={() => openRoomMenu(room)}
                    aria-expanded={megaMenuOpen && activeRoomMenu === room}
                    className={cn(
                      "group relative h-auto rounded-none p-0 font-body text-[12px] uppercase tracking-[0.2em] font-normal text-muted-foreground hover:bg-transparent hover:text-foreground whitespace-nowrap",
                      megaMenuOpen && activeRoomMenu === room && "text-foreground"
                    )}
                  >
                    <span className="link-underline-grow">{room}</span>
                  </Button>

                  {room !== "decor" && room !== "lighting" && megaMenuOpen && activeRoomMenu === room && (
                    <div ref={megaMenuRef} data-room-menu={room} className="absolute left-0 top-full z-50 mt-3 w-[min(800px,calc(100vw-48px))] bg-background shadow-xl" style={{ translate: `-${roomMenuOverflow}px 0` }}>
                      <RoomDropdownPanel room={room} activeCategory={activeRoomCategory} onSelectCategory={setActiveRoomCategory} onCategoryNavigate={navigateToRoomCategory} onRoomNavigate={navigateToRoom} />
                    </div>
                  )}

                  {room === "decor" && megaMenuOpen && activeRoomMenu === "decor" && (
                    <div
                      ref={megaMenuRef}
                      data-room-menu="decor"
                      className="absolute right-0 top-full z-50 mt-3 h-auto w-[min(650px,calc(100vw-48px))] overflow-visible bg-background shadow-xl"
                      style={{ animation: "megaMenuReveal 240ms cubic-bezier(0.22, 1, 0.36, 1) forwards" }}
                    >
                      <style>{`
                        @keyframes megaMenuReveal {
                          from { opacity: 0; transform: translateY(-6px); }
                          to { opacity: 1; transform: translateY(0); }
                        }
                      `}</style>
                      <div className="flex min-h-96 items-stretch overflow-hidden">
                        <div className="min-h-full w-1/2 shrink-0 border-r border-border/60 px-9 py-8">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => navigateFromMegaMenu("Décor")}
                            className="mb-4 flex h-8 w-auto justify-start rounded-none p-0 font-body text-[13px] font-semibold tracking-normal text-foreground hover:bg-transparent hover:text-foreground"
                          >
                            Décor Collections
                          </Button>
                          <div className="grid grid-cols-2 gap-x-10">
                            {DECOR_COLUMNS.map((col, ci) => (
                              <div key={ci} className="flex flex-col">
                                {col.map((subcategory) => (
                                  <Button
                                    key={subcategory}
                                    type="button"
                                    variant="ghost"
                                    onClick={() => navigateFromMegaMenu("Décor", subcategory)}
                                    className="mb-3 block h-auto w-full whitespace-normal rounded-none p-0 text-left font-body text-[13px] font-normal tracking-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
                                  >
                                    {subcategory}
                                  </Button>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="relative min-h-full w-1/2 shrink-0 overflow-hidden bg-[hsl(var(--collection-card-canvas))] p-6">
                          <img
                            src={roomAmbientImages.decor.src}
                            alt={roomAmbientImages.decor.alt}
                            className="size-full object-contain object-center"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {room === "lighting" && megaMenuOpen && activeRoomMenu === room && (
                    <div ref={megaMenuRef} data-room-menu={room} className="absolute left-0 top-full z-50 mt-3 w-[min(650px,calc(100vw-48px))] bg-background shadow-xl">
                      <div className="flex min-h-96 items-stretch overflow-hidden">
                        <div className="w-1/2 shrink-0 border-r border-border/60 px-9 py-8">
                          {roomNavigation.lighting.map((item) => (
                            <Button key={item.label} type="button" variant="ghost" onClick={() => navigateFromMegaMenu(item.category, item.subcategories[0])} className="flex h-10 w-full justify-start rounded-none p-0 font-body text-[13px] font-normal text-muted-foreground hover:bg-transparent hover:text-foreground">{item.label}</Button>
                          ))}
                        </div>
                        <div className="min-w-0 flex-1 bg-[hsl(var(--collection-card-canvas))] p-6">
                          <img src={roomAmbientImages.lighting.src} alt={roomAmbientImages.lighting.alt} className="size-full object-contain object-center" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <button
                data-nav-journal
                onClick={() => { setMegaMenuOpen(false); handleNavClick("/journal"); }}
                className={cn(
                  "group relative font-body text-[12px] uppercase tracking-[0.2em] font-normal text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap",
                  (activeSection === "/journal" || isRouteActive("/journal")) && "text-foreground"
                )}
              >
                <span className="link-underline-grow">Journal</span>
              </button>

            </nav>
        </div>
      </div>
    </nav>
    <TradeServicesRequestModal open={servicesOpen} onOpenChange={setServicesOpen} />
    {authGateMounted && (
      <React.Suspense fallback={null}>
        <AuthGateDialog open={authGateOpen} onClose={() => setAuthGateOpen(false)} action="access your account" initialMode={authGateMode} />
      </React.Suspense>
    )}
    </>;
};
export default Navigation;