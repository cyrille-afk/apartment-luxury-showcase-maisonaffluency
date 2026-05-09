import { useState } from "react";
import { Smartphone, Check } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

/**
 * Floating one-click button that generates a shareable mobile preview link
 * for the user's current page state (path + query + hash).
 *
 * - On mobile: triggers the native share sheet.
 * - On desktop: copies the link to clipboard and shows a QR code popover
 *   so the user can scan it with their phone instantly.
 */
const MobilePreviewShareButton = () => {
  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const buildShareUrl = () => {
    const { pathname, search, hash } = window.location;
    return `${window.location.origin}${pathname}${search}${hash}`;
  };

  const isMobile = typeof navigator !== "undefined"
    && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const handleClick = async () => {
    const url = buildShareUrl();

    if (isMobile && navigator.share) {
      try {
        await navigator.share({ title: document.title, url });
      } catch {
        /* user cancelled */
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success("Link copied — scan the QR with your phone");
    } catch {
      toast.error("Could not copy link");
    }

    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 220,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
      setQrDataUrl(dataUrl);
      setOpen(true);
    } catch {
      /* QR generation failed silently */
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 print:hidden">
      {open && qrDataUrl && (
        <div className="absolute bottom-14 left-0 bg-background border border-border rounded-lg shadow-xl p-4 w-[260px] animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-3">
            <span className="font-display text-xs uppercase tracking-[0.15em] text-foreground">
              Open on phone
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground text-xs"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <img
            src={qrDataUrl}
            alt="Scan to open this page on your phone"
            className="w-full h-auto rounded"
          />
          <p className="font-body text-[10px] text-muted-foreground mt-2 leading-relaxed">
            Scan with your phone camera. Link is also copied to your clipboard.
          </p>
        </div>
      )}
      <button
        onClick={handleClick}
        className="flex items-center gap-2 px-3 h-10 rounded-full bg-foreground text-background shadow-lg hover:opacity-90 transition-opacity"
        aria-label="Share mobile preview link"
      >
        {copied ? <Check className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
        <span className="font-body text-[10px] uppercase tracking-[0.15em]">
          {copied ? "Copied" : "Mobile preview"}
        </span>
      </button>
    </div>
  );
};

export default MobilePreviewShareButton;
