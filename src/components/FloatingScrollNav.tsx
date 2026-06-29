import { useEffect, useState } from "react";
import { ArrowUp, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  /** Optional path for the menu button. Defaults to /designers */
  menuHref?: string;
  /** Show after scrolling this many px. */
  threshold?: number;
}

/**
 * Mobile/PWA-only floating helpers: scroll-to-top + quick nav back.
 * Useful on long curator-pick pages.
 */
export default function FloatingScrollNav({ menuHref = "/designers", threshold = 600 }: Props) {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  if (!visible) return null;

  return (
    <div
      className="fixed z-40 right-3 md:hidden flex flex-col gap-2 print:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
    >
      <button
        onClick={() => navigate(menuHref)}
        aria-label="Back to designers"
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
