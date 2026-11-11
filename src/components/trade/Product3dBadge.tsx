import { Box } from "lucide-react";
import { has3dAsset } from "@/lib/visualiserCatalog";

/**
 * Top-left card badge that states whether a piece actually has 3D geometry.
 * Availability is read from the validated model URL (never the thumbnail),
 * so a card only ever promises a viewer it can open.
 */
export function productHas3dModel(glbUrl: string | null | undefined): boolean {
  return has3dAsset({ glb_url: glbUrl ?? null });
}

type Product3dBadgeProps = {
  glbUrl: string | null | undefined;
  productName?: string | null;
  /** Opens the materials/finishes workspace. Ignored when no model exists. */
  onOpen?: () => void;
  /** Extra positioning classes (e.g. `left-3 top-3`). */
  className?: string;
};

const BASE =
  "absolute inline-flex items-center gap-1.5 px-2.5 py-1.5 font-body text-[10px] uppercase tracking-[0.18em] backdrop-blur-sm";

export function Product3dBadge({ glbUrl, productName, onOpen, className = "left-2 top-2 z-10" }: Product3dBadgeProps) {
  const name = productName?.trim() || "product";

  if (!productHas3dModel(glbUrl)) {
    return (
      <span
        aria-label={`No 3D model available for ${name}`}
        onClick={(e) => e.stopPropagation()}
        className={`${BASE} ${className} cursor-default border border-border/40 bg-background/70 text-muted-foreground/70`}
      >
        <Box className="h-3.5 w-3.5 opacity-60" strokeWidth={1.5} /> 3D Unavailable
      </span>
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`3D View — materials and finishes for ${name}`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onOpen?.();
        }
      }}
      className={`${BASE} ${className} cursor-pointer border border-border/60 bg-background/85 text-foreground transition-colors hover:bg-background`}
    >
      <Box className="h-3.5 w-3.5" strokeWidth={1.5} /> 3D View
    </span>
  );
}
