import { useState, useRef, useEffect } from "react";
import { Share2, Copy, MessageCircle, Share as ShareIos, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

interface ShareMenuProps {
  url: string;
  message: string;
  /**
   * Layout-only escape hatch (positioning/margins). The share control's own
   * appearance is fixed platform-wide and cannot be overridden.
   */
  className?: string;
  /** @deprecated The share UI is now uniform platform-wide. Ignored. */
  iconSize?: string;
  /** @deprecated The share UI is now uniform platform-wide. Ignored. */
  showLabel?: boolean;
  /** @deprecated The share UI is now uniform platform-wide. Ignored. */
  labelSize?: string;
  /** @deprecated The share UI is now uniform platform-wide. Ignored. */
  iconVariant?: "share2" | "ios";
  /**
   * High-resolution, uncropped image exported through the native share sheet
   * (AirDrop, Messages, Keynote, Canva…) alongside the referral link.
   */
  imageUrl?: string;
  /** File name used for the exported image. */
  imageName?: string;
}

/**
 * Canonical share control — the glass pill used at the bottom-right of the
 * product photography. This exact UI is used for every share affordance
 * across the platform; per-call-site styling is intentionally ignored.
 */
const SHARE_BUTTON_CLASS =
  "flex items-center justify-center w-9 h-9 rounded-full bg-background/25 backdrop-blur-md border border-border/25 text-foreground/80 transition-colors hover:text-foreground";

const ShareMenu = ({ url, message, imageUrl, imageName }: ShareMenuProps) => {

  const Icon: LucideIcon = ShareIos;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Strip cache-busting query params for the human-readable share text.
  // The full cache-busted url is still used for copy/link previews.
  const cleanUrl = url.split("?")[0];

  // Extract a body line without the trailing URL so native share sheets don't
  // duplicate the link (iOS appends the separate `url` field to `text`).
  const bodyText = message
    .replace(url, cleanUrl)
    .replace(new RegExp(`\\s*[:—-]\\s*${cleanUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`), "")
    .trim();

  const copyLink = () => {
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
    setOpen(false);
  };

  const openWhatsApp = () => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(`${bodyText} ${cleanUrl}`)}`;
    window.location.href = waUrl;
    setOpen(false);
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMobile && navigator.share) {
      const title = message.split(":")[0] || "Share";
      // Try a high-resolution image export first so the piece lands in
      // AirDrop / Messages / Keynote at full fidelity, link included.
      if (imageUrl) {
        try {
          const res = await fetch(imageUrl, { mode: "cors" });
          const blob = await res.blob();
          const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
          const file = new File([blob], `${(imageName || title).replace(/[^\w\-]+/g, "-")}.${ext}`, { type: blob.type });
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ title, text: bodyText, url: cleanUrl, files: [file] });
            return;
          }
        } catch {
          /* fall through to link-only share */
        }
      }
      try {
        await navigator.share({ title, text: bodyText, url: cleanUrl });
      } catch {}
    } else if (isMobile) {
      copyLink();
    } else {
      setOpen(!open);
    }
  };


  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleClick}
        className={className}
        aria-label="Share"
      >
        <Icon className={iconSize} />
        {showLabel && <span className={`font-body ${labelSize} uppercase tracking-[0.15em]`}>Share</span>}
      </button>
      {open && !isMobile && (
        <div
          className="absolute top-full left-0 mt-2 flex flex-col gap-1 bg-black/80 backdrop-blur-md rounded-lg p-1.5 shadow-xl border border-white/10 z-50 min-w-[140px]"
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
