/** Keeps product descriptions in the document for indexing without a visual overlay. */
import { cn } from "@/lib/utils";

interface Props {
  description: string | null | undefined;
  className?: string;
}

const ProductCardDescriptionOverlay = ({ description, className }: Props) => {
  if (!description || !description.trim()) return null;

  return (
    <p className={cn("sr-only", className)}>{description}</p>
  );
};

export default ProductCardDescriptionOverlay;
