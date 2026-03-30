import { useState, useRef, useEffect } from "react";
import { Share2, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface ShareMenuProps {
  url: string;
  message: string;
  className?: string;
  iconSize?: string;
  showLabel?: boolean;
  labelSize?: string;
}

const ShareMenu = ({ url, message, className = "", iconSize = "w-3.5 h-3.5", showLabel = true, labelSize = "text-[9px]" }: ShareMenuProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const copyLink = () => {
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
    setOpen(false);
  };

  const openWhatsApp = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={className}
        aria-label="Share"
      >
        <Share2 className={iconSize} />
        {showLabel && <span className={`font-body ${labelSize} uppercase tracking-[0.15em]`}>Share</span>}
      </button>
      {open && (
        <div
          className="absolute bottom-full left-0 mb-2 flex flex-col gap-1 bg-black/80 backdrop-blur-md rounded-lg p-1.5 shadow-xl border border-white/10 z-50 min-w-[140px]"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={copyLink} className="flex items-center gap-2 px-3 py-1.5 text-white/90 hover:text-white hover:bg-white/10 rounded text-[11px] font-body tracking-wide transition-colors">
            <Copy className="w-3.5 h-3.5" /> Copy Link
          </button>
          <button onClick={openWhatsApp} className="flex items-center gap-2 px-3 py-1.5 text-white/90 hover:text-white hover:bg-white/10 rounded text-[11px] font-body tracking-wide transition-colors">
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </button>
        </div>
      )}
    </div>
  );
};

export default ShareMenu;
