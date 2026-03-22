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
  let match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (match) return `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1`;
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

/** Parse a media line — supports `URL | Caption` pipe separator */
function parseMediaLine(text: string): { url: string; caption: string | null } | null {
  const value = text.trim();
  // Try pipe separator: "https://...jpg | My Caption"
  const pipeMatch = value.match(/^(https?:\/\/\S+)\s*\|\s*(.+)$/i);
  const url = pipeMatch ? pipeMatch[1].trim() : value;
  const pipeCaption = pipeMatch ? pipeMatch[2].trim() : null;

  if (!/^https?:\/\//i.test(url)) return null;
  if (/\s/.test(url)) return null;

  const isMedia =
    isVideoUrl(url) ||
    /\.(avif|gif|jpe?g|png|webp)(\?|$)/i.test(url) ||
    /res\.cloudinary\.com\/.+\/image\/upload/i.test(url) ||
    /\/storage\/v1\/object\/public\//i.test(url);

  if (!isMedia) return null;
  return { url, caption: pipeCaption };
}

/** Detect a standalone media URL paragraph pasted directly into biography text */
function isStandaloneMediaUrl(text: string): boolean {
  return parseMediaLine(text) !== null;
}

/** Extract a human-readable caption from a URL's filename */
function captionFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    let filename = pathname.split("/").pop() || "";
    filename = filename.replace(/^\d{10,}-[a-z0-9]+\./, "");
    filename = filename.replace(/\.[a-z0-9]+$/i, "");
    filename = filename.replace(/_[a-z0-9]{4,8}$/i, "");
    filename = filename.replace(/_\d+$/, "");
    filename = filename.replace(/[-_]+/g, " ").trim();
    if (filename.length < 3) return null;
    return filename
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Video Block — always full-width to stand out                      */
/* ------------------------------------------------------------------ */
function VideoBlock({ url, designerName, index, overrideCaption }: { url: string; designerName: string; index: number; overrideCaption?: string | null }) {
  const caption = overrideCaption ?? captionFromUrl(url);
  const embedUrl = getEmbedUrl(url);

  return (
    <motion.figure
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={transition}
      className="my-10 md:my-14 -mx-2 md:-mx-6"
    >
      <div className="aspect-video rounded-lg overflow-hidden bg-muted/20 shadow-lg">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={caption || `${designerName} — video`}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
          />
        )}
      </div>
      {caption && (
        <figcaption className="mt-2.5 text-center font-body text-[11px] tracking-wide text-muted-foreground italic">
          {caption}
        </figcaption>
      )}
    </motion.figure>
  );
}

/* ------------------------------------------------------------------ */
/*  Image Block — asymmetric side-by-side with text                   */
/*  Uses natural aspect ratio (no cropping) via object-contain        */
/* ------------------------------------------------------------------ */
function SplitImageBlock({
  url,
  designerName,
  index,
  paragraphs,
}: {
  url: string;
  designerName: string;
  index: number;
  paragraphs: string[];
}) {
  const caption = captionFromUrl(url);
  const imageOnRight = index % 2 === 0;

  const imageEl = (
    <motion.figure
      initial={{ opacity: 0, x: imageOnRight ? 20 : -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={transition}
      className="flex-1 min-w-0"
    >
      <div className="rounded-lg overflow-hidden bg-muted/10">
        <img
          src={url}
          alt={caption || `${designerName} — editorial`}
          className="w-full h-auto object-contain"
          loading="lazy"
        />
      </div>
      {caption && (
        <figcaption className="mt-2 font-body text-[11px] tracking-wide text-muted-foreground italic text-center md:text-left">
          {caption}
        </figcaption>
      )}
    </motion.figure>
  );

  const textEl = paragraphs.length > 0 ? (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ ...transition, delay: 0.1 }}
      className="flex-1 min-w-0 flex flex-col justify-center"
    >
      {paragraphs.map((p, i) => (
        <p key={i} className={i > 0 ? "mt-4" : ""}>
          {renderQuotedText(p)}
        </p>
      ))}
    </motion.div>
  ) : null;

  return (
    <div className="my-10 md:my-14 flex flex-col md:flex-row gap-6 md:gap-10 items-start">
      {imageOnRight ? (
        <>
          {textEl}
          {imageEl}
        </>
      ) : (
        <>
          {imageEl}
          {textEl}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Full-width Image Block — used on mobile or when no paired text    */
/* ------------------------------------------------------------------ */
function FullWidthImageBlock({ url, designerName, index }: { url: string; designerName: string; index: number }) {
  const caption = captionFromUrl(url);
  return (
    <motion.figure
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={transition}
      className="my-8 -mx-2 md:mx-0"
    >
      <div className="rounded-lg overflow-hidden bg-muted/10">
        <img
          src={url}
          alt={caption || `${designerName} — editorial`}
          className="w-full h-auto object-contain"
          loading="lazy"
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-center font-body text-[11px] tracking-wide text-muted-foreground italic">
          {caption}
        </figcaption>
      )}
    </motion.figure>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

/**
 * Editorial biography layout with asymmetric grid:
 * - Images sit side-by-side with text paragraphs, alternating left/right
 * - Videos always break out full-width to stand out
 * - Images use natural aspect ratios (no cropping)
 * - On mobile everything stacks vertically
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

  const hasManualMedia = !!(biographyImages && biographyImages.length > 0);
  const hasInlineMedia = !hasManualMedia && blocks.some(isStandaloneMediaUrl);

  /* ------- Inline media mode (URLs pasted directly in biography) ------- */
  if (hasInlineMedia) {
    // Separate into text paragraphs and media URLs, preserving order
    type Block = { type: "text"; content: string } | { type: "image"; url: string } | { type: "video"; url: string };
    const parsed: Block[] = blocks.map((b) => {
      if (!isStandaloneMediaUrl(b)) return { type: "text" as const, content: b };
      if (isVideoUrl(b)) return { type: "video" as const, url: b };
      return { type: "image" as const, url: b };
    });

    // Group consecutive text blocks that follow an image, pair them for split layout
    const elements: JSX.Element[] = [];
    let imageIdx = 0;
    let i = 0;

    // Render leading text paragraphs before first media
    const leadingText: string[] = [];
    while (i < parsed.length && parsed[i].type === "text") {
      leadingText.push((parsed[i] as { type: "text"; content: string }).content);
      i++;
    }
    if (leadingText.length > 0) {
      elements.push(
        <div key="leading-text">
          {leadingText.map((p, pi) => (
            <p key={pi} className={pi > 0 ? "mt-4" : ""}>
              {renderQuotedText(p)}
            </p>
          ))}
        </div>
      );
    }

    while (i < parsed.length) {
      const block = parsed[i];

      if (block.type === "video") {
        elements.push(
          <VideoBlock key={`vid-${i}`} url={block.url} designerName={designerName} index={i} />
        );
        i++;
        // Render any following text as standalone paragraphs until next media
        const followText: string[] = [];
        while (i < parsed.length && parsed[i].type === "text") {
          followText.push((parsed[i] as { type: "text"; content: string }).content);
          i++;
        }
        if (followText.length > 0) {
          elements.push(
            <div key={`post-vid-text-${i}`}>
              {followText.map((p, pi) => (
                <p key={pi} className={pi > 0 ? "mt-4" : ""}>
                  {renderQuotedText(p)}
                </p>
              ))}
            </div>
          );
        }
        continue;
      }

      if (block.type === "image") {
        // Collect following text paragraphs to pair with this image
        i++;
        const paired: string[] = [];
        while (i < parsed.length && parsed[i].type === "text") {
          paired.push((parsed[i] as { type: "text"; content: string }).content);
          i++;
        }

        if (paired.length > 0) {
          elements.push(
            <SplitImageBlock
              key={`split-${imageIdx}`}
              url={block.url}
              designerName={designerName}
              index={imageIdx}
              paragraphs={paired}
            />
          );
        } else {
          elements.push(
            <FullWidthImageBlock
              key={`fw-${imageIdx}`}
              url={block.url}
              designerName={designerName}
              index={imageIdx}
            />
          );
        }
        imageIdx++;
        continue;
      }

      // Stray text (shouldn't happen but safety)
      elements.push(
        <p key={`stray-${i}`} className="mt-4">
          {renderQuotedText((block as { type: "text"; content: string }).content)}
        </p>
      );
      i++;
    }

    return (
      <div className="font-body text-sm leading-relaxed text-foreground/85 text-justify">
        {elements}
      </div>
    );
  }

  /* ------- Manual media array or pick images fallback ------- */
  const paragraphs = blocks;
  const media = hasManualMedia ? biographyImages! : (pickImages || []);

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

  // Distribute media among paragraphs
  const interval = Math.max(2, Math.ceil(paragraphs.length / (media.length + 1)));
  const elements: JSX.Element[] = [];
  let mediaIndex = 0;
  let textAccum: string[] = [];

  paragraphs.forEach((p, i) => {
    textAccum.push(p);

    const shouldInsertMedia =
      (i + 1) % interval === 0 &&
      mediaIndex < media.length &&
      i < paragraphs.length - 1;

    if (shouldInsertMedia) {
      const url = media[mediaIndex];
      if (isVideoUrl(url)) {
        // Flush text before video
        if (textAccum.length > 0) {
          elements.push(
            <div key={`text-pre-vid-${i}`}>
              {textAccum.map((tp, ti) => (
                <p key={ti} className={ti > 0 ? "mt-4" : ""}>
                  {renderQuotedText(tp)}
                </p>
              ))}
            </div>
          );
          textAccum = [];
        }
        elements.push(
          <VideoBlock key={`media-vid-${mediaIndex}`} url={url} designerName={designerName} index={mediaIndex} />
        );
      } else {
        // Pair accumulated text with image in split layout
        elements.push(
          <SplitImageBlock
            key={`media-split-${mediaIndex}`}
            url={url}
            designerName={designerName}
            index={mediaIndex}
            paragraphs={textAccum}
          />
        );
        textAccum = [];
      }
      mediaIndex++;
    }
  });

  // Remaining text
  if (textAccum.length > 0) {
    elements.push(
      <div key="trailing-text">
        {textAccum.map((p, i) => (
          <p key={i} className={i > 0 ? "mt-4" : ""}>
            {renderQuotedText(p)}
          </p>
        ))}
      </div>
    );
  }

  // Remaining media
  while (mediaIndex < media.length) {
    const url = media[mediaIndex];
    if (isVideoUrl(url)) {
      elements.push(
        <VideoBlock key={`media-tail-vid-${mediaIndex}`} url={url} designerName={designerName} index={mediaIndex} />
      );
    } else {
      elements.push(
        <FullWidthImageBlock key={`media-tail-${mediaIndex}`} url={url} designerName={designerName} index={mediaIndex + 100} />
      );
    }
    mediaIndex++;
  }

  return (
    <div className="font-body text-sm leading-relaxed text-foreground/85 text-justify">
      {elements}
    </div>
  );
}
