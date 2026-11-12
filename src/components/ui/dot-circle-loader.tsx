import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import monogram from "@/assets/studio-monogram-a.png.asset.json";

/**
 * DotCircleLoader — app-wide loading indicator. Renders the studio "A"
 * monogram with a slow, continuous spin (name kept so every caller updates).
 *
 * One fixed footprint for every loading logo; legacy size props are accepted
 * for compatibility but no longer change the rendered size.
 */
type Size = "sm" | "md" | "lg" | "xl";

const LOGO_PX = 96;

interface DotCircleLoaderProps {
  size?: Size;
  className?: string;
  label?: string;
}

export function DotCircleLoader({ className, label = "Loading" }: DotCircleLoaderProps) {
  const px = LOGO_PX;
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("inline-flex items-center justify-center", className)}
      style={{ width: px, height: px, minWidth: px, minHeight: px, maxWidth: px, maxHeight: px, flexShrink: 0 }}
    >
      <img
        src={monogram.url}
        alt=""
        aria-hidden="true"
        width={px}
        height={px}
        decoding="async"
        className="h-full w-full object-contain animate-[spin_2.5s_linear_infinite] motion-reduce:animate-[spin_6s_linear_infinite]"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export default DotCircleLoader;

/** Page-level loader: always pinned to the exact centre of the screen, so successive loading stages never jump. */
export function PageLoader({ label = "Loading" }: { label?: string }) {
  // Portal to <body> so a transformed ancestor can't turn "fixed" into "relative to the panel".
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const node = (
    <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none" data-page-loader>
      <DotCircleLoader label={label} />
    </div>
  );
  return mounted ? createPortal(node, document.body) : node;
}
