import { cn } from "@/lib/utils";

/**
 * DotCircleLoader — 8 dots arranged in a circle with varying sizes,
 * rotating around the center. Uses the theme `foreground` color via currentColor.
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

const DOTS = [
  // [angle deg, dot scale 0..1]
  [0, 1.0],
  [45, 0.55],
  [90, 0.7],
  [135, 0.45],
  [180, 0.85],
  [225, 0.5],
  [270, 0.65],
  [315, 0.4],
] as const;

export function DotCircleLoader({ size = "md", className, label = "Loading" }: DotCircleLoaderProps) {
  const px = SIZE_PX[size];
  const radius = px * 0.38;
  const baseDot = px * 0.16;

  return (
    <div
      role="status"
      aria-label={label}
      className={cn("inline-flex text-foreground", className)}
      style={{ width: px, height: px }}
    >
      <div
        className="relative w-full h-full animate-spin"
        style={{ animationDuration: "1.4s", animationTimingFunction: "linear" }}
      >
        {DOTS.map(([angle, scale], i) => {
          const rad = (angle * Math.PI) / 180;
          const x = Math.cos(rad) * radius;
          const y = Math.sin(rad) * radius;
          const d = baseDot * scale;
          return (
            <span
              key={i}
              className="absolute rounded-full bg-current"
              style={{
                width: d,
                height: d,
                left: `calc(50% + ${x}px - ${d / 2}px)`,
                top: `calc(50% + ${y}px - ${d / 2}px)`,
              }}
            />
          );
        })}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export default DotCircleLoader;
