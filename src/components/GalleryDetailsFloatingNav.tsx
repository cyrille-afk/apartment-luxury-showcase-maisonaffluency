import { useEffect, useRef, useState } from "react";
import {
  LayoutGrid,
  ArrowDownAZ,
  MessageCircle,
  ChevronDown,
  MoreHorizontal,
  ArrowUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const WHATSAPP_URL = "https://wa.me/6591393850";

interface Props {
  /** Path used by the A–Z button. Defaults to /designers. */
  azHref?: string;
  /** Optional callback fired before A–Z navigation (e.g. remember letter). */
  onAzClick?: () => void;
  /** ARIA label for the A–Z button. */
  azLabel?: string;
  /** Scroll offset (px) after which the panel becomes visible. */
  threshold?: number;
  /** Show immediately, used on scroll-locked mobile/PWA landings. */
  showImmediately?: boolean;
  /** Show once this element reaches the viewport, used for gallery final-section entry. */
  showAfterElementId?: string;
  /** Bypass mobile/PWA viewport gating for routes that need this on wider previews. */
  forceDisplay?: boolean;
}

/**
 * Mobile/PWA-only floating quick-actions panel. Fixed to the bottom-right of
 * the viewport once the user scrolls past `threshold`. Used on the public
 * Gallery (final section) and Designer biography pages.
 */
export default function GalleryDetailsFloatingNav({
  azHref = "/designers",
  onAzClick,
  azLabel = "Browse designers A–Z",
  threshold = 600,
  showImmediately = false,
  showAfterElementId,
  forceDisplay = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(showImmediately);
  const [isMobileOrPwa, setIsMobileOrPwa] = useState(false);
  const revealedByElementRef = useRef(showImmediately);
  const navigate = useNavigate();

  useEffect(() => {
    const mobileMql = window.matchMedia("(max-width: 767px)");
    const standaloneMql = window.matchMedia?.("(display-mode: standalone)");
    const updateMode = () => {
      const isStandalone =
        standaloneMql?.matches ||
        (window.navigator as any).standalone === true ||
        new URLSearchParams(window.location.search).get("source") === "pwa";
      setIsMobileOrPwa(mobileMql.matches || isStandalone);
    };
    updateMode();
    mobileMql.addEventListener("change", updateMode);
    standaloneMql?.addEventListener?.("change", updateMode);
    return () => {
      mobileMql.removeEventListener("change", updateMode);
      standaloneMql?.removeEventListener?.("change", updateMode);
    };
  }, []);

  useEffect(() => {
    if (showImmediately) {
      setVisible(true);
      setExpanded(false);
      revealedByElementRef.current = true;
      return;
    }

    if (showAfterElementId) {
      const getTriggerElement = () => {
        const target = document.getElementById(showAfterElementId);
        const controller = document.querySelector<HTMLElement>(`[aria-controls="${showAfterElementId}"]`);
        const controllerRect = controller?.getBoundingClientRect();
        const controllerVisible =
          !!controller &&
          !!controllerRect &&
          controllerRect.width > 0 &&
          controllerRect.height > 0 &&
          window.getComputedStyle(controller).display !== "none";
        if (controllerVisible) return controller;
        if (!target) return null;

        const rects = target.getClientRects();
        const isRendered = rects.length > 0 && window.getComputedStyle(target).display !== "none";
        if (isRendered) return target;

        return controller ?? target;
      };

      const onScroll = () => {
        // Hide when back near the top of the page.
        if (window.scrollY < 200) {
          revealedByElementRef.current = false;
          setVisible(false);
          setExpanded(false);
          return;
        }
        const target = getTriggerElement();
        if (!target) {
          if (!revealedByElementRef.current) {
            setVisible(false);
            setExpanded(false);
          }
          return;
        }
        const rect = target.getBoundingClientRect();
        const bottomSafeArea = 112;
        const reachedTrigger = rect.top <= window.innerHeight - bottomSafeArea;
        const reachedPageEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - bottomSafeArea;
        const shouldShow = revealedByElementRef.current || reachedTrigger || reachedPageEnd;
        setVisible(shouldShow);
        if (shouldShow) {
          revealedByElementRef.current = true;
        } else {
          setExpanded(false);
        }
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      return () => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      };
    }

    const onScroll = () => {
      const shouldShow = window.scrollY > threshold;
      setVisible(shouldShow);
      if (!shouldShow) setExpanded(false);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showImmediately, showAfterElementId, threshold]);

  if (!forceDisplay && !showImmediately && !isMobileOrPwa) return null;
  if (!visible) return null;

  const isExpanded = expanded;


  const handleAllCategories = () => {
    setExpanded(false);
    window.dispatchEvent(new Event("open-main-menu"));
    window.dispatchEvent(new CustomEvent("open-all-categories"));
  };
  const handleAz = () => {
    setExpanded(false);
    onAzClick?.();
    navigate(azHref);
  };
  const handleWhatsApp = () => {
    setExpanded(false);
    window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer");
  };
  const handleTop = () => {
    setExpanded(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div
      className="fixed right-3 z-[10000] print:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.75rem)" }}
    >
      {isExpanded ? (
        <div
          className="flex items-center gap-2 rounded-full bg-foreground/95 backdrop-blur-md text-background shadow-xl pl-2 pr-1 py-1.5 animate-in fade-in slide-in-from-bottom-1 duration-300"
          role="toolbar"
          aria-label="Quick actions"
        >
          <button
            onClick={handleAllCategories}
            aria-label="Browse all categories"
            className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-background/10 transition-colors active:scale-95"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={handleAz}
            aria-label={azLabel}
            className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-background/10 transition-colors active:scale-95"
          >
            <ArrowDownAZ className="h-4 w-4" />
          </button>
          <button
            onClick={handleWhatsApp}
            aria-label="Contact via WhatsApp"
            className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-background/10 transition-colors active:scale-95"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
          <button
            onClick={handleTop}
            aria-label="Back to top"
            className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-background/10 transition-colors active:scale-95"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <span className="w-px h-6 bg-background/20 mx-0.5" aria-hidden />
          <button
            onClick={() => setExpanded(false)}
            aria-label="Collapse quick actions"
            className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-background/10 transition-colors active:scale-95"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          aria-label="Open quick actions"
          className="h-12 w-12 rounded-full bg-foreground text-background shadow-xl flex items-center justify-center active:scale-95 transition-transform animate-in fade-in duration-200"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
