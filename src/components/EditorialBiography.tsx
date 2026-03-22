import { motion } from "framer-motion";

interface EditorialBiographyProps {
  biography: string;
  /** Manual editorial images — takes priority over auto picks */
  biographyImages?: string[];
  /** Auto-fill images from curator's picks when no manual images set */
  pickImages?: string[];
  designerName: string;
}

const transition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const };

/** Highlight quoted text within a paragraph */
function renderQuotedText(text: string) {
  return text.split(/(\u2018[^\u2019]*\u2019|'[^']*')/g).map((segment, i) => {
    const isCurly = segment.startsWith("\u2018") && segment.endsWith("\u2019");
    const isStraight = segment.startsWith("'") && segment.endsWith("'") && segment.length > 2;
    if (isCurly || isStraight) {
      return (
        <span key={i} className="italic text-foreground font-medium">
          {segment}
        </span>
      );
    }
    return <span key={i}>{segment}</span>;
  });
}

/**
 * Editorial biography layout — splits biography into paragraphs and
 * interleaves full-width images between them, mimicking a magazine interview.
 */
export default function EditorialBiography({
  biography,
  biographyImages,
  pickImages,
  designerName,
}: EditorialBiographyProps) {
  const paragraphs = biography
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Use manual images if set, otherwise fall back to pick images
  const hasManualImages = biographyImages && biographyImages.length > 0;
  const images = hasManualImages ? biographyImages : (pickImages || []);

  // No images? Render plain editorial text
  if (images.length === 0) {
    return (
      <div className="font-body text-sm leading-relaxed text-foreground/85 text-justify whitespace-pre-line">
        {paragraphs.map((p, i) => (
          <p key={i} className={i > 0 ? "mt-4" : ""}>
            {renderQuotedText(p)}
          </p>
        ))}
      </div>
    );
  }

  // Place images after every N paragraphs (distribute evenly)
  const interval = Math.max(2, Math.ceil(paragraphs.length / (images.length + 1)));

  const elements: JSX.Element[] = [];
  let imageIndex = 0;

  paragraphs.forEach((p, i) => {
    elements.push(
      <p key={`p-${i}`} className={i > 0 ? "mt-4" : ""}>
        {renderQuotedText(p)}
      </p>
    );

    // Insert an image after every `interval` paragraphs (but not after the last one)
    if (
      (i + 1) % interval === 0 &&
      imageIndex < images.length &&
      i < paragraphs.length - 1
    ) {
      const imgUrl = images[imageIndex];
      elements.push(
        <motion.figure
          key={`img-${imageIndex}`}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={transition}
          className="my-8 -mx-2 md:mx-0"
        >
          <div className="aspect-[16/10] rounded-lg overflow-hidden bg-muted/20">
            <img
              src={imgUrl}
              alt={`${designerName} — editorial`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        </motion.figure>
      );
      imageIndex++;
    }
  });

  // If there are remaining images not yet placed, add them at the end
  while (imageIndex < images.length) {
    const imgUrl = images[imageIndex];
    elements.push(
      <motion.figure
        key={`img-tail-${imageIndex}`}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={transition}
        className="my-8 -mx-2 md:mx-0"
      >
        <div className="aspect-[16/10] rounded-lg overflow-hidden bg-muted/20">
          <img
            src={imgUrl}
            alt={`${designerName} — editorial`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      </motion.figure>
    );
    imageIndex++;
  }

  return (
    <div className="font-body text-sm leading-relaxed text-foreground/85 text-justify">
      {elements}
    </div>
  );
}
