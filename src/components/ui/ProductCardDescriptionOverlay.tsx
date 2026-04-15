/**
 * In-card description overlay — renders inside the image box on hover.
 * Shows a brief description snippet at the bottom of the card image area.
 */
import { cn } from "@/lib/utils";

interface Props {
  description: string | null | undefined;
  className?: string;
}

const ProductCardDescriptionOverlay = ({ description, className }: Props) => {
  if (!description || !description.trim()) return null;

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-10 pointer-events-none",
        "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
        className
      )}
    >
      <div className="bg-gradient-to-t from-black/70 via-black/40 to-transparent px-3 pt-6 pb-2.5">
        <p className="font-body text-[10px] md:text-[11px] text-white/90 leading-relaxed line-clamp-2 drop-shadow-sm">
          {description}
        </p>
      </div>
    </div>
  );
};

export default ProductCardDescriptionOverlay;
