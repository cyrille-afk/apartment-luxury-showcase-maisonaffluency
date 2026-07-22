import { useEffect, useRef, useState } from "react";
import { ArrowUp, Share2, MessageCircle, ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";

const WHATSAPP_URL = "https://wa.me/6591393850";

interface Props {
  /** Element id to observe — nav appears once this scrolls into view */
  targetId: string;
}

/**
 * Floating action panel that appears when the user scrolls into the last
 * gallery section. Manual chevron toggles between expanded row (top • share • whatsapp)
 * and a single collapsed FAB at the bottom-right.
 */
export default function GalleryDetailsFloatingNav({ targetId }: Props) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const autoCollapsedRef = useRef(false);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            // First reveal: keep expanded so the user notices the affordances,
            // then leave collapse control to them.
          } else {
            // Only hide entirely when the section has fully left the viewport upward.
            if (e.boundingClientRect.top > 0) setVisible(false);
          }
        }
      },
      { rootMargin: "0px 0px -20% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [targetId]);

  // Auto-collapse to FAB once user starts scrolling within the section
  useEffect(() => {
    if (!visible || autoCollapsedRef.current) return;
    const onScroll = () => {
      autoCollapsedRef.current = true;
      setExpanded(false);
      window.removeEventListener("scroll", onScroll);
    };
    const t = window.setTimeout(() => {
      window.addEventListener("scroll", onScroll, { passive: true });
    }, 2500);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
    };
  }, [visible]);

  if (!visible) return null;

  const handleShare = async () => {
    const url = `${window.location.origin}/gallery`;
    const text = "The Details Make The Design — Maison Affluency";
    try {
      if (navigator.share) {
        await navigator.share({ title: text, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* user dismissed */
    }
  };

  const handleTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const handleWhatsApp = () =>
    window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer");

  return (
    <div
      className="fixed right-4 z-[60] print:hidden"
      style={{
        // Sit above iOS safe-area and above the mobile StickyBottomNav (~64px)
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)",
      }}
    >
      {expanded ? (
        <div
          className="flex items-center gap-2 rounded-full bg-foreground/95 backdrop-blur-md text-background shadow-2xl pl-2 pr-1 py-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300"
          role="toolbar"
          aria-label="Gallery quick actions"
        >
          <button
            onClick={handleTop}
            aria-label="Back to top"
            className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-background/10 transition-colors active:scale-95"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            onClick={handleShare}
            aria-label="Share gallery"
            className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-background/10 transition-colors active:scale-95"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleWhatsApp}
            aria-label="Contact via WhatsApp"
            className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-background/10 transition-colors active:scale-95"
          >
            <MessageCircle className="h-4 w-4" />
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
          className="h-12 w-12 rounded-full bg-foreground text-background shadow-2xl flex items-center justify-center active:scale-95 transition-transform animate-in fade-in duration-200"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
