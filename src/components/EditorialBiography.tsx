import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Play, ChevronDown } from "lucide-react";

interface EditorialBiographyProps {
  biography: string;
  /** Manual editorial media (images or video URLs) — takes priority over auto picks */
  biographyImages?: string[];
  /** Auto-fill images from curator's picks when no manual media set */
  pickImages?: string[];
  designerName: string;
}

/** Number of biography paragraphs to show before "Read more" on mobile */
const MOBILE_COLLAPSE_THRESHOLD = 3;

const transition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const };

/** Detect if a URL is a video */
function isVideoUrl(url: string): boolean {
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return true;
  if (/res\.cloudinary\.com\/.+\/video\/upload/i.test(url)) return true;
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
    /res\.cloudinary\.com\/.+\/(image|video)\/upload/i.test(url) ||
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
  const [playing, setPlaying] = useState(false);

  // Extract YouTube thumbnail automatically
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  const thumbnailUrl = ytMatch ? `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg` : null;

  const isNativeVideo = !embedUrl;

  const playOverlay = (
    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors flex items-center justify-center">
      <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/90 group-hover:bg-white flex items-center justify-center transition-colors shadow-lg">
        <Play className="w-7 h-7 md:w-9 md:h-9 text-foreground ml-1" fill="currentColor" />
      </div>
    </div>
  );

  return (
    <motion.figure
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={transition}
      className="my-10 md:my-14 -mx-2 md:-mx-6"
    >
      <div className="aspect-video rounded-lg overflow-hidden bg-muted/20 shadow-lg relative flex items-center justify-center">
        {!playing && thumbnailUrl ? (
          /* YouTube/Vimeo with auto-thumbnail */
          <button
            onClick={() => setPlaying(true)}
            className="w-full h-full relative group cursor-pointer"
            aria-label={`Play ${caption || 'video'}`}
          >
            <img
              src={thumbnailUrl}
              alt={caption || `${designerName} — video`}
              className="w-full h-full object-cover"
            />
            {playOverlay}
          </button>
        ) : !playing && isNativeVideo ? (
          /* Native MP4/WebM — show first frame via hidden video + play overlay */
          <button
            onClick={() => setPlaying(true)}
            className="w-full h-full relative group cursor-pointer"
            aria-label={`Play ${caption || 'video'}`}
          >
            <video
              src={url + '#t=0.5'}
              muted
              playsInline
              preload="metadata"
              className="w-full h-full object-cover pointer-events-none"
            />
            {playOverlay}
          </button>
        ) : embedUrl ? (
          <iframe
            src={playing ? embedUrl.replace('?', '?autoplay=1&') : embedUrl}
            title={caption || `${designerName} — video`}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video
            src={url}
            controls
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        )}
      </div>
      {caption && (
        <figcaption className="mt-2.5 text-center font-body text-[13px] tracking-wide text-muted-foreground italic">
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
  overrideCaption,
}: {
  url: string;
  designerName: string;
  index: number;
  paragraphs: string[];
  overrideCaption?: string | null;
}) {
  const caption = overrideCaption ?? captionFromUrl(url);
  const imageOnRight = index % 2 === 0;

  const imageEl = (
    <motion.figure
      initial={{ opacity: 0, x: imageOnRight ? 20 : -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={transition}
      className="shrink-0 w-full"
    >
      <div className="rounded-lg overflow-hidden bg-muted/10">
        <img
          src={url}
          alt={caption || `${designerName} — editorial`}
          className="w-full h-full object-contain"
          loading="lazy"
        />
      </div>
      {caption && (
        <figcaption className="mt-2 font-body text-[13px] tracking-wide text-muted-foreground italic text-center md:text-left">
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
    <div className={`${index === 0 ? "mb-10 md:mb-14" : "my-10 md:my-14"} flex flex-col md:flex-row gap-6 md:gap-10 items-start`}>
      <div className={`shrink-0 w-full md:w-[50%] order-1 ${imageOnRight ? 'md:order-2' : 'md:order-1'}`}>
        {imageEl}
      </div>
      {textEl && (
        <div className={`flex-1 min-w-0 order-2 ${imageOnRight ? 'md:order-1' : 'md:order-2'}`}>
          {textEl}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Full-width Image Block — used on mobile or when no paired text    */
/* ------------------------------------------------------------------ */
function FullWidthImageBlock({ url, designerName, index, overrideCaption }: { url: string; designerName: string; index: number; overrideCaption?: string | null }) {
  const caption = overrideCaption ?? captionFromUrl(url);
  return (
    <motion.figure
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={transition}
      className="my-10 md:my-14"
    >
      <div className="rounded-lg overflow-hidden bg-muted/10 aspect-square max-w-[520px] mx-auto">
        <img
          src={url}
          alt={caption || `${designerName} — editorial`}
          className="w-full h-full object-contain"
          loading="lazy"
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-center font-body text-[13px] tracking-wide text-muted-foreground italic">
          {caption}
        </figcaption>
      )}
    </motion.figure>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile Collapsible — collapses long text on small screens          */
/* ------------------------------------------------------------------ */
function MobileCollapsible({ paragraphs }: { paragraphs: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const shouldCollapse = paragraphs.length > MOBILE_COLLAPSE_THRESHOLD;
  const visibleParagraphs = shouldCollapse && !expanded
    ? paragraphs.slice(0, MOBILE_COLLAPSE_THRESHOLD)
    : paragraphs;

  return (
    <div className="font-body text-sm md:text-[15px] leading-relaxed md:leading-[1.8] text-foreground/85">
      {visibleParagraphs.map((p, i) => (
        <p key={i} className={i > 0 ? "mt-3 md:mt-5" : ""}>
          {renderQuotedText(p)}
        </p>
      ))}
      {shouldCollapse && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-4 flex items-center gap-1.5 font-display text-[11px] tracking-[0.15em] uppercase text-primary/70 hover:text-primary transition-colors"
        >
          Read more
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      )}
      <AnimatePresence>
        {shouldCollapse && expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {paragraphs.slice(MOBILE_COLLAPSE_THRESHOLD).map((p, i) => (
              <p key={i} className="mt-3 md:mt-5">
                {renderQuotedText(p)}
              </p>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Collapsible wrapper — limits height on mobile for long bios        */
/* ------------------------------------------------------------------ */
function CollapsibleBiographyWrapper({ children, elementCount }: { children: React.ReactNode; elementCount: number }) {
  const [expanded, setExpanded] = useState(false);
  // Only collapse on mobile when there's substantial content
  if (elementCount <= 3) return <>{children}</>;

  return (
    <div className="relative">
      <div
        className={expanded ? "" : "max-h-[420px] md:max-h-none overflow-hidden"}
      >
        {children}
      </div>
      {!expanded && (
        <div className="md:hidden">
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          <button
            onClick={() => setExpanded(true)}
            className="relative z-10 mt-2 flex items-center gap-1.5 font-display text-[11px] tracking-[0.15em] uppercase text-primary/70 hover:text-primary transition-colors"
          >
            Continue reading
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

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
    type Block = { type: "text"; content: string } | { type: "image"; url: string; caption: string | null } | { type: "video"; url: string; caption: string | null };
    const parsed: Block[] = blocks.map((b) => {
      const media = parseMediaLine(b);
      if (!media) return { type: "text" as const, content: b };
      if (isVideoUrl(media.url)) return { type: "video" as const, url: media.url, caption: media.caption };
      return { type: "image" as const, url: media.url, caption: media.caption };
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
          <VideoBlock key={`vid-${i}`} url={block.url} designerName={designerName} index={i} overrideCaption={block.caption} />
        );
        i++;
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
              overrideCaption={block.caption}
            />
          );
        } else {
          elements.push(
            <FullWidthImageBlock
              key={`fw-${imageIdx}`}
              url={block.url}
              designerName={designerName}
              index={imageIdx}
              overrideCaption={block.caption}
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
      <CollapsibleBiographyWrapper elementCount={elements.length}>
        <div className="font-body text-sm md:text-[15px] leading-relaxed md:leading-[1.8] text-foreground/85">
          {elements}
        </div>
      </CollapsibleBiographyWrapper>
    );
  }

  /* ------- Manual media array or pick images fallback ------- */
  const paragraphs = blocks;
  const media = hasManualMedia ? biographyImages! : (pickImages || []);
  const parsedMedia = media
    .map((entry) => {
      const parsed = parseMediaLine(entry);
      if (parsed) {
        return {
          url: parsed.url,
          caption: parsed.caption,
          isVideo: isVideoUrl(parsed.url),
        };
      }

      const raw = entry.trim();
      if (!raw) return null;
      return {
        url: raw,
        caption: null,
        isVideo: isVideoUrl(raw),
      };
    })
    .filter(
      (m): m is { url: string; caption: string | null; isVideo: boolean } =>
        !!m && /^https?:\/\//i.test(m.url)
    );

  if (parsedMedia.length === 0) {
    return (
      <MobileCollapsible paragraphs={paragraphs} />
    );
  }

  // Distribute media among paragraphs
  const interval = Math.max(2, Math.ceil(paragraphs.length / (parsedMedia.length + 1)));
  const elements: JSX.Element[] = [];
  let mediaIndex = 0;
  let textAccum: string[] = [];

  paragraphs.forEach((p, i) => {
    textAccum.push(p);

    const shouldInsertMedia =
      (i + 1) % interval === 0 &&
      mediaIndex < parsedMedia.length;

    if (shouldInsertMedia) {
      const mediaItem = parsedMedia[mediaIndex];
      if (mediaItem.isVideo) {
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
          <VideoBlock
            key={`media-vid-${mediaIndex}`}
            url={mediaItem.url}
            designerName={designerName}
            index={mediaIndex}
            overrideCaption={mediaItem.caption}
          />
        );
      } else {
        // Pair accumulated text with image in split layout
        elements.push(
          <SplitImageBlock
            key={`media-split-${mediaIndex}`}
            url={mediaItem.url}
            designerName={designerName}
            index={mediaIndex}
            paragraphs={textAccum}
            overrideCaption={mediaItem.caption}
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
  while (mediaIndex < parsedMedia.length) {
    const mediaItem = parsedMedia[mediaIndex];
    if (mediaItem.isVideo) {
      elements.push(
        <VideoBlock
          key={`media-tail-vid-${mediaIndex}`}
          url={mediaItem.url}
          designerName={designerName}
          index={mediaIndex}
          overrideCaption={mediaItem.caption}
        />
      );
    } else {
      elements.push(
        <FullWidthImageBlock
          key={`media-tail-${mediaIndex}`}
          url={mediaItem.url}
          designerName={designerName}
          index={mediaIndex + 100}
          overrideCaption={mediaItem.caption}
        />
      );
    }
    mediaIndex++;
  }

  return (
    <CollapsibleBiographyWrapper elementCount={elements.length}>
      <div className="font-body text-sm md:text-[15px] leading-relaxed md:leading-[1.8] text-foreground/85">
        {elements}
      </div>
    </CollapsibleBiographyWrapper>
  );
}
