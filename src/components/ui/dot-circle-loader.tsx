import { cn } from "@/lib/utils";
import monogram from "@/assets/studio-monogram-a.png.asset.json";

/**
 * DotCircleLoader — app-wide loading indicator. Renders the studio "A"
 * monogram with a slow, continuous spin (name kept so every caller updates).
 *
 * Sizes: sm (24px), md (40px — default), lg (64px), xl (96px)
 */
type Size = "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<Size, number> = { sm: 24, md: 40, lg: 64, xl: 96 };

interface DotCircleLoaderProps {
  size?: Size;
  className?: string;
  label?: string;
}

export function DotCircleLoader({ size = "md", className, label = "Loading" }: DotCircleLoaderProps) {
  const px = SIZE_PX[size];
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("inline-flex items-center justify-center", className)}
      style={{ width: px, height: px }}
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
