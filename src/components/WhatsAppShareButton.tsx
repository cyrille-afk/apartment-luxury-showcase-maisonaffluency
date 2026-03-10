import { memo } from "react";

/**
 * WhatsApp Share Button — best-practice implementation.
 *
 * Design decisions:
 * - Official WhatsApp brand green (#25D366) on the icon for instant recognition
 * - Minimal pill shape with subtle border — doesn't compete with primary content
 * - 44px minimum touch target on mobile (accessibility guideline)
 * - Two sizes: "sm" for compact contexts (card overlays), "default" for inline use
 * - "Share" label for clarity (didactical)
 * - Glass variant for use on image overlays
 */

const WA_ICON_PATH =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";

type WhatsAppShareButtonProps = {
  onClick: (e: React.MouseEvent) => void;
  label: string;
  /** "default" for inline sections, "sm" for card overlays */
  size?: "default" | "sm";
  /** Use "glass" on image overlays for translucent backdrop */
  variant?: "solid" | "glass" | "branded" | "prominent";
  /** Extra classes */
  className?: string;
  /** Hide on certain breakpoints */
  hideOn?: "mobile" | "desktop";
};

const sizeClasses = {
  default: {
    button: "gap-1.5 px-3 py-1.5 md:px-2.5 md:py-1 text-xs md:text-[11px] min-h-[44px] md:min-h-0",
    icon: "w-3.5 h-3.5 md:w-3 md:h-3",
  },
  sm: {
    button: "gap-1 px-2 py-1 text-[10px] min-h-[44px] md:min-h-0",
    icon: "w-3 h-3",
  },
} as const;

const variantClasses = {
  solid:
    "bg-white hover:bg-white/90 border border-border/30 text-muted-foreground",
  glass:
    "bg-white/20 hover:bg-white/35 border border-white/20 text-white backdrop-blur-sm",
  /** Green-branded variant — stands out on mobile inside accordion content */
  branded:
    "bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#25D366] md:bg-white md:hover:bg-white/90 md:border-border/30 md:text-muted-foreground",
  /** Prominent white variant with stronger contrast for mobile */
  prominent:
    "bg-white hover:bg-white/90 border border-foreground/20 text-foreground shadow-sm md:border-border/30 md:text-muted-foreground md:shadow-none",
} as const;

const WhatsAppShareButton = memo(function WhatsAppShareButton({
  onClick,
  label,
  size = "default",
  variant = "solid",
  className = "",
  hideOn,
}: WhatsAppShareButtonProps) {
  const s = sizeClasses[size];
  const v = variantClasses[variant];
  const visibility = hideOn === "mobile" ? "hidden md:inline-flex" : hideOn === "desktop" ? "md:hidden inline-flex" : "inline-flex";

  return (
    <button
      onClick={onClick}
      className={`${visibility} items-center ${s.button} font-body rounded-full transition-all duration-300 touch-manipulation ${v} ${className}`}
      aria-label={label}
    >
      <svg
        className={`${s.icon} flex-shrink-0`}
        viewBox="0 0 24 24"
        fill="#25D366"
      >
        <path d={WA_ICON_PATH} />
      </svg>
      <span className="font-medium">Share</span>
    </button>
  );
});

export default WhatsAppShareButton;
