import { useEffect, useState } from "react";
import { ArrowUp, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  /** Optional path for the menu button. Defaults to /designers */
  menuHref?: string;
  /** If true, the menu button opens the main site navigation menu instead of navigating. */
  openMainMenu?: boolean;
  /** ARIA label for the menu button. */
  menuLabel?: string;
  /** Optional callback before menu navigation. */
  onMenuClick?: () => void;
  /** Show after scrolling this many px. */
  threshold?: number;
}

/**
 * Mobile/PWA-only floating helpers: scroll-to-top + quick nav / menu.
 */
export default function FloatingScrollNav({
  menuHref = "/designers",
  openMainMenu = false,
  menuLabel,
  onMenuClick: beforeMenuClick,
  threshold = 600,
}: Props) {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  if (!visible) return null;

  const handleMenuClick = () => {
    beforeMenuClick?.();
    if (openMainMenu) {
      window.dispatchEvent(new Event("open-main-menu"));
    } else {
      navigate(menuHref);
    }
  };

  return (
    <div
      className="fixed z-[10000] right-3 md:hidden flex flex-col gap-2 print:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
    >
      <button
        onClick={handleMenuClick}
        aria-label={menuLabel ?? (openMainMenu ? "Open menu" : "Back to designers")}
        className="h-11 w-11 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      >
        <Menu className="h-5 w-5" />
      </button>
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        className="h-11 w-11 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </div>
  );
}
