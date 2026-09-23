/** Keeps product descriptions in the document for indexing without a visual overlay. */
interface Props {
  description: string | null | undefined;
  className?: string;
}

const ProductCardDescriptionOverlay = ({ description, className }: Props) => {
  if (!description || !description.trim()) return null;

  return (
    <p hidden data-curator-description={className || undefined}>{description}</p>
  );
};

export default ProductCardDescriptionOverlay;
