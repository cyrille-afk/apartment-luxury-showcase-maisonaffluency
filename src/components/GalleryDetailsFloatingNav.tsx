import { useEffect, useState } from "react";
import { LayoutGrid, ArrowDownAZ, MessageCircle, ChevronDown, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";

const WHATSAPP_URL = "https://wa.me/6591393850";

interface Props {
  /** Element id to observe — nav appears once this scrolls into view */
  targetId: string;
}

/**
 * Floating action panel that appears when the user scrolls into the last
 * gallery section. Starts collapsed (single FAB) so it never overlaps the
 * section thumbnails; user taps to expand the pill of quick actions.
 */
export default function GalleryDetailsFloatingNav({ targetId }: Props) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
          } else if (e.boundingClientRect.top > 0) {
            setVisible(false);
          }
        }
      },
      { rootMargin: "0px 0px -20% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [targetId]);

  if (!visible) return null;

  const handleAllCategories = () => {
    setExpanded(false);
    navigate("/collectibles");
  };
  const handleDesigners = () => {
    setExpanded(false);
    navigate("/designers");
  };
  const handleWhatsApp = () =>
    window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer");

  return (
    <div
      className="fixed right-4 z-[60] print:hidden"
      style={{
        // Sit above iOS safe-area, mobile StickyBottomNav (~64px), and the
        // gallery thumbnails row so it never overlaps the image tiles.
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 7.5rem)",
      }}
    >
      {expanded ? (
        <div
          className="flex items-center gap-2 rounded-full bg-foreground/95 backdrop-blur-md text-background shadow-2xl pl-2 pr-1 py-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300"
          role="toolbar"
          aria-label="Gallery quick actions"
        >
          <button
            onClick={handleAllCategories}
            aria-label="Browse all categories"
            className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-background/10 transition-colors active:scale-95"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={handleDesigners}
            aria-label="Browse designers A–Z"
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
