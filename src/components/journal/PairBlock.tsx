interface PairImage {
  url: string;
  caption: string | null;
}

interface PairBlockProps {
  images: PairImage[];
  onImageClick?: (url: string, caption: string | null) => void;
}

/**
 * Side-by-side image pair for inline editorial use within journal articles.
 * Stacks to single column on mobile.
 */
const PairBlock = ({ images, onImageClick }: PairBlockProps) => {
  if (images.length === 0) return null;

  return (
    <figure className="my-8 md:my-12 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
      {images.map((img, i) => (
        <div key={i} className="flex flex-col">
          <button
            type="button"
            onClick={() => onImageClick?.(img.url, img.caption)}
            className="block w-full group cursor-zoom-in"
          >
            <img
              src={img.url}
              alt={img.caption || `Image ${i + 1}`}
              className="w-full h-auto rounded-sm object-cover transition-all duration-300 group-hover:shadow-lg group-hover:brightness-95"
              loading="lazy"
            />
          </button>
          {img.caption && (
            <figcaption className="mt-2 font-body text-[11px] tracking-wide text-muted-foreground italic text-center">
              {img.caption}
            </figcaption>
          )}
        </div>
      ))}
    </figure>
  );
};

export default PairBlock;
