import { motion } from "framer-motion";

interface EditorialBiographyProps {
  biography: string;
  /** Manual editorial media (images or video URLs) — takes priority over auto picks */
  biographyImages?: string[];
  /** Auto-fill images from curator's picks when no manual media set */
  pickImages?: string[];
  designerName: string;
}

const transition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const };

/** Detect if a URL is a video */
function isVideoUrl(url: string): boolean {
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return true;
  if (/youtube\.com\/watch|youtu\.be\/|youtube\.com\/embed/i.test(url)) return true;
  if (/vimeo\.com\//i.test(url)) return true;
  return false;
}

/** Convert YouTube/Vimeo URLs to embeddable format */
function getEmbedUrl(url: string): string | null {
  // YouTube
  let match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (match) return `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1`;
  // Vimeo
  match = url.match(/vimeo\.com\/(\d+)/);
  if (match) return `https://player.vimeo.com/video/${match[1]}?title=0&byline=0&portrait=0`;
  return null;
}

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

/** Detect a standalone media URL paragraph pasted directly into biography text */
function isStandaloneMediaUrl(text: string): boolean {
  const value = text.trim();
  if (!/^https?:\/\//i.test(value)) return false;
  if (/\s/.test(value)) return false;

  return (
    isVideoUrl(value) ||
    /\.(avif|gif|jpe?g|png|webp)(\?|$)/i.test(value) ||
    /res\.cloudinary\.com\/.+\/image\/upload/i.test(value) ||
    /\/storage\/v1\/object\/public\//i.test(value)
  );
}

/** Render either an image or a video depending on URL */
function MediaBlock({ url, designerName, index }: { url: string; designerName: string; index: number }) {
  if (isVideoUrl(url)) {
    const embedUrl = getEmbedUrl(url);
    if (embedUrl) {
      // YouTube / Vimeo embed
      return (
        <motion.figure
          key={`vid-${index}`}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={transition}
          className="my-8 -mx-2 md:mx-0"
        >
          <div className="aspect-video rounded-lg overflow-hidden bg-muted/20">
            <iframe
              src={embedUrl}
              title={`${designerName} — video`}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </motion.figure>
      );
    }
    // Native MP4/WebM
    return (
      <motion.figure
        key={`vid-${index}`}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={transition}
        className="my-8 -mx-2 md:mx-0"
      >
        <div className="aspect-video rounded-lg overflow-hidden bg-muted/20">
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
          />
        </div>
      </motion.figure>
    );
  }

  // Image
  return (
    <motion.figure
      key={`img-${index}`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={transition}
      className="my-8 -mx-2 md:mx-0"
    >
      <div className="aspect-[16/10] rounded-lg overflow-hidden bg-muted/20">
        <img
          src={url}
          alt={`${designerName} — editorial`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    </motion.figure>
  );
}

/**
 * Editorial biography layout — splits biography into paragraphs and
 * interleaves full-width images/videos between them, mimicking a magazine interview.
 */
export default function EditorialBiography({
  biography,
  biographyImages,
  pickImages,
  designerName,
}: EditorialBiographyProps) {
  const blocks = biography
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Use manual media if set, otherwise fall back to pick images.
  // If no manual media is set but standalone media URLs are pasted in biography text,
  // render those inline at the exact authored position.
  const hasManualMedia = !!(biographyImages && biographyImages.length > 0);
  const hasInlineMediaBlocks = !hasManualMedia && blocks.some(isStandaloneMediaUrl);

  if (hasInlineMediaBlocks) {
    return (
      <div className="font-body text-sm leading-relaxed text-foreground/85 text-justify">
        {blocks.map((block, i) =>
          isStandaloneMediaUrl(block) ? (
            <MediaBlock key={`inline-media-${i}`} url={block} designerName={designerName} index={500 + i} />
          ) : (
            <p key={`inline-p-${i}`} className={i > 0 ? "mt-4" : ""}>
              {renderQuotedText(block)}
            </p>
          )
        )}
      </div>
    );
  }

  const paragraphs = blocks;
  const media = hasManualMedia ? biographyImages : (pickImages || []);

  // No media? Render plain editorial text
  if (media.length === 0) {
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

  // Place media after every N paragraphs (distribute evenly)
  const interval = Math.max(2, Math.ceil(paragraphs.length / (media.length + 1)));

  const elements: JSX.Element[] = [];
  let mediaIndex = 0;

  paragraphs.forEach((p, i) => {
    elements.push(
      <p key={`p-${i}`} className={i > 0 ? "mt-4" : ""}>
        {renderQuotedText(p)}
      </p>
    );

    if (
      (i + 1) % interval === 0 &&
      mediaIndex < media.length &&
      i < paragraphs.length - 1
    ) {
      elements.push(
        <MediaBlock key={`media-${mediaIndex}`} url={media[mediaIndex]} designerName={designerName} index={mediaIndex} />
      );
      mediaIndex++;
    }
  });

  // Remaining media at the end
  while (mediaIndex < media.length) {
    elements.push(
      <MediaBlock key={`media-tail-${mediaIndex}`} url={media[mediaIndex]} designerName={designerName} index={mediaIndex + 100} />
    );
    mediaIndex++;
  }

  return (
    <div className="font-body text-sm leading-relaxed text-foreground/85 text-justify">
      {elements}
    </div>
  );
}
