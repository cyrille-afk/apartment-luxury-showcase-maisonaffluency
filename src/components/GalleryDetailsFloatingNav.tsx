import { useState } from "react";
import { LayoutGrid, ArrowDownAZ, MessageCircle, ChevronDown, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";

const WHATSAPP_URL = "https://wa.me/6591393850";

/**
 * Inline quick-actions panel for the final gallery section. It lives below
 * the thumbnail strip, right-aligned, so it never covers the thumbnails.
 */
export default function GalleryDetailsFloatingNav() {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const handleAllCategories = () => {
    setExpanded(false);
    window.dispatchEvent(new CustomEvent("open-all-categories"));
  };
  const handleDesigners = () => {
    setExpanded(false);
    navigate("/designers");
  };
  const handleWhatsApp = () =>
    window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer");

  return (
    <div className="md:hidden mt-3 mb-2 flex justify-end pr-1 print:hidden">
      {expanded ? (
        <div
          className="flex items-center gap-2 rounded-full bg-foreground/95 backdrop-blur-md text-background shadow-xl pl-2 pr-1 py-1.5 animate-in fade-in slide-in-from-top-1 duration-300"
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
          className="h-12 w-12 rounded-full bg-foreground text-background shadow-xl flex items-center justify-center active:scale-95 transition-transform animate-in fade-in duration-200"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
