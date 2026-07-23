import { Smartphone } from "lucide-react";

/**
 * Header pill that opens the Mobile Preview modal. Rendered globally in
 * TradeLayout (dev/sandbox only) so it never overlaps page content like the
 * console-warning toast or floating CTAs.
 *
 * It dispatches `open-mobile-preview` — handled by MobilePreviewShareButton.
 */
export function MobilePreviewHeaderButton() {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  const isLocalDev = import.meta.env.DEV && (host === "localhost" || host === "127.0.0.1");
  const isEditorSandbox =
    /(^|\.)lovableproject\.com$/.test(host) ||
    /(^|\.)lovableproject-dev\.com$/.test(host) ||
    host.startsWith("id-preview--");
  if (!isLocalDev && !isEditorSandbox) return null;

  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("open-mobile-preview"))}
      className="hidden md:flex items-center gap-2 rounded-full border border-border bg-background text-foreground px-3 py-1.5 shadow-sm hover:bg-muted transition-all"
      aria-label="Open mobile preview"
    >
      <Smartphone className="h-3.5 w-3.5" />
      <span className="font-body text-[11px] uppercase tracking-[0.15em]">Mobile</span>
    </button>
  );
}
