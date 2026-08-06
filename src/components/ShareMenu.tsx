import { useState, useRef, useEffect } from "react";
import { Copy, MessageCircle, Share as ShareIos, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

const PinterestIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.165 1.776 2.165 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
  </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

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

  const openPinterest = () => {
    const pinUrl = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(cleanUrl)}&description=${encodeURIComponent(bodyText)}`;
    window.open(pinUrl, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const openFacebook = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(cleanUrl)}`;
    window.open(fbUrl, "_blank", "noopener,noreferrer");
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
        className={SHARE_BUTTON_CLASS}
        aria-label="Share"
      >
        <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
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
