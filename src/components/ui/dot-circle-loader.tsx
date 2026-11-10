import { cn } from "@/lib/utils";
import monogram from "@/assets/studio-monogram-a.png.asset.json";

/**
 * DotCircleLoader — app-wide loading indicator. Renders the studio "A"
 * monogram with a slow, continuous spin (name kept so every caller updates).
 *
 * Sizes: sm (48px), md (96px — default), lg (144px), xl (192px)
 */
type Size = "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<Size, number> = { sm: 48, md: 96, lg: 144, xl: 192 };

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
