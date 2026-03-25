import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Play, ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface EditorialBiographyProps {
  biography: string;
  /** Manual editorial media (images or video URLs) — takes priority over auto picks */
  biographyImages?: string[];
  /** Auto-fill images from curator's picks when no manual media set */
  pickImages?: string[];
  designerName: string;
  /** Shows debug events for text/media pairing in preview contexts */
  debugMediaOrder?: boolean;
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

/** Keep Cloudinary-hosted videos uncropped when legacy URLs contain c_fill/c_crop */
function normalizeCloudinaryVideoUrl(url: string): string {
  if (!/res\.cloudinary\.com\/.+\/video\/upload/i.test(url)) return url;
  return url
    .replace(/\/c_(fill|crop),/gi, "/c_fit,")
    .replace(/,c_(fill|crop)\b/gi, ",c_fit");
}

/** Render inline HTML: <strong>, <a href="...">, and highlighted quoted text */
export function renderParagraph(text: string): React.ReactNode[] {
  // Split on <strong>...</strong> and <a href="...">...</a> tags
  const parts = text.split(/(<strong>[\s\S]*?<\/strong>|<a\s+href="[^"]*"[^>]*>[\s\S]*?<\/a>)/g);
  return parts.map((part, i) => {
    const strongMatch = part.match(/^<strong>([\s\S]*?)<\/strong>$/);
    if (strongMatch) {
      return (
        <strong key={i} className="font-black text-foreground" style={{ fontWeight: 900 }}>
          {renderQuotedText(strongMatch[1])}
        </strong>
      );
    }
    const linkMatch = part.match(/^<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>$/);
    if (linkMatch) {
      return (
        <a key={i} href={linkMatch[1]} className="underline underline-offset-2 text-foreground hover:text-primary transition-colors">
          {linkMatch[2]}
        </a>
      );
    }
    return <span key={i}>{renderQuotedText(part)}</span>;
  });
}

/** Highlight quoted text within a paragraph */
function renderQuotedText(text: string): React.ReactNode[] {
  // Match curly single quotes, straight single quotes (preceded by space/start), curly double quotes, and straight double quotes
  // The straight single-quote pattern requires a word boundary before the opening quote to avoid matching possessives like "Aerts'"
  return text.split(/(\u2018[^\u2019]*\u2019|(?:^|(?<=\s))'[^']*'|\u201C[^\u201D]*\u201D|"[^"]*")/g).map((segment, i) => {
    const isCurlySingle = segment.startsWith("\u2018") && segment.endsWith("\u2019");
    const isStraightSingle = segment.startsWith("'") && segment.endsWith("'") && segment.length > 2;
    const isCurlyDouble = segment.startsWith("\u201C") && segment.endsWith("\u201D");
    const isStraightDouble = segment.startsWith('"') && segment.endsWith('"') && segment.length > 2;
    // Extra guard: skip if the "quoted" text is unreasonably long (likely a false match from an apostrophe)
    const maxQuoteLength = 300;
    if ((isCurlySingle || isStraightSingle || isCurlyDouble || isStraightDouble) && segment.length <= maxQuoteLength) {
      return (
        <span key={i} className="font-black text-foreground" style={{ fontWeight: 900 }}>
          {segment}
        </span>
      );
    }
    return <span key={i}>{segment}</span>;
  });
}

/** Parse a media line — supports `URL | Caption` pipe separator */
function parseMediaLine(text: string): { url: string; caption: string | null; poster: string | null; align: "left" | "right" | null; size: "small" | null } | null {
  const value = text.trim();
  // Try pipe separator: "https://...jpg | My Caption | poster:https://..." | left/right | small
  const pipes = value.split(/\s*\|\s*/);
  const url = pipes[0]?.trim() || "";

  if (!/^https?:\/\//i.test(url)) return null;
  if (/\s/.test(url)) return null;

  let caption: string | null = null;
  let poster: string | null = null;
  let align: "left" | "right" | null = null;
  let size: "small" | null = null;
  for (let i = 1; i < pipes.length; i++) {
    const seg = pipes[i].trim();
    if (/^poster:/i.test(seg)) {
      poster = seg.replace(/^poster:/i, "").trim();
    } else if (/^(left|right)$/i.test(seg)) {
      align = seg.toLowerCase() as "left" | "right";
    } else if (/^small$/i.test(seg)) {
      size = "small";
    } else if (!caption) {
      caption = seg;
    }
  }

  const isMedia =
    isVideoUrl(url) ||
    /\.(avif|gif|jpe?g|png|webp)(\?|$)/i.test(url) ||
    /res\.cloudinary\.com\/.+\/(image|video)\/upload/i.test(url) ||
    /\/storage\/v1\/object\/public\//i.test(url);

  if (!isMedia) return null;
  return { url, caption, poster, align, size };
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

const VIDEO_POSTER_FALLBACKS: Record<string, string> = {
  "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/documents/1774220339833-galr9d.mp4":
    "/images/lamont-video-poster-v2.jpg?v=20260323-2",
  "https://vimeo.com/803009029":
    "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772110437/Screen_Shot_2026-02-18_at_10.08.42_AM_xr4vun.jpg",
};

function getPosterFallbackForVideo(url: string): string | undefined {
  const normalized = url.split("?")[0];
  return VIDEO_POSTER_FALLBACKS[normalized];
}

/* ------------------------------------------------------------------ */
/*  Video Block — always full-width to stand out                      */
/* ------------------------------------------------------------------ */
function VideoBlock({
  url,
  designerName,
  index,
  overrideCaption,
  posterUrl,
}: {
  url: string;
  designerName: string;
  index: number;
  overrideCaption?: string | null;
  posterUrl?: string;
}) {
  const caption = overrideCaption ?? captionFromUrl(url);
  const embedUrl = getEmbedUrl(url);
  const [playing, setPlaying] = useState(false);
  const [posterIndex, setPosterIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Extract YouTube thumbnail automatically
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  const thumbnailUrl = ytMatch ? `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg` : null;

  const isNativeVideo = !embedUrl;
  const videoSrc = isNativeVideo ? normalizeCloudinaryVideoUrl(url) : url;

  const manualPosterUrl = posterUrl?.trim() || undefined;
  const autoPosterUrl = (() => {
    if (manualPosterUrl) return manualPosterUrl;
    if (/res\.cloudinary\.com\/.+\/video\/upload/i.test(url)) {
      return url.replace("/video/upload/", "/video/upload/so_2,f_jpg,q_auto/");
    }
    return undefined;
  })();
  const mappedFallbackPoster = getPosterFallbackForVideo(url);

  const posterCandidates = useMemo(
    () =>
      [...new Set([manualPosterUrl, autoPosterUrl, mappedFallbackPoster].filter((p): p is string => !!p))],
    [manualPosterUrl, autoPosterUrl, mappedFallbackPoster]
  );

  useEffect(() => {
    setPosterIndex(0);
  }, [url, manualPosterUrl]);

  useEffect(() => {
    if (!playing || !isNativeVideo || !videoRef.current) return;
    const video = videoRef.current;
    video.play().catch(() => undefined);
  }, [playing, isNativeVideo, videoSrc]);

  const currentPosterUrl = posterCandidates[posterIndex];

  const handlePosterError = () => {
    setPosterIndex((prev) => {
      if (prev >= posterCandidates.length - 1) return prev;
      return prev + 1;
    });
  };

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
      <div className="aspect-video rounded-xl overflow-hidden bg-muted/20 shadow-lg relative flex items-center justify-center">
        {!playing && (thumbnailUrl || currentPosterUrl) ? (
          /* Poster + play button for YouTube, Vimeo, or any video with a poster */
          <button
            onClick={() => setPlaying(true)}
            className="w-full h-full relative group cursor-pointer"
            aria-label={`Play ${caption || "video"}`}
          >
            <img
              src={thumbnailUrl || currentPosterUrl!}
              alt={caption || `${designerName} — video`}
              className="w-full h-full object-cover"
              onError={thumbnailUrl ? undefined : handlePosterError}
            />
            {playOverlay}
          </button>
        ) : !playing && embedUrl ? (
          <iframe
            src={embedUrl}
            title={caption || `${designerName} — video`}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : playing && embedUrl ? (
          <iframe
            src={embedUrl.includes("?") ? `${embedUrl}&autoplay=1` : `${embedUrl}?autoplay=1`}
            title={caption || `${designerName} — video`}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : !playing ? (
          <button
            onClick={() => setPlaying(true)}
            className="w-full h-full relative group cursor-pointer"
            aria-label={`Play ${caption || "video"}`}
          >
            {currentPosterUrl ? (
              <img
                src={currentPosterUrl}
                alt={caption || `${designerName} — video cover`}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={handlePosterError}
              />
            ) : (
              <div className="w-full h-full bg-muted/40" />
            )}
            {playOverlay}
          </button>
        ) : (
          <video
            ref={videoRef}
            src={videoSrc}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="w-full h-full object-contain bg-black"
            poster={currentPosterUrl}
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
  forceAlign,
  size,
}: {
  url: string;
  designerName: string;
  index: number;
  paragraphs: string[];
  overrideCaption?: string | null;
  forceAlign?: "left" | "right" | null;
  size?: "small" | null;
}) {
  const caption = overrideCaption ?? captionFromUrl(url);
  const imageOnRight = forceAlign ? forceAlign === "right" : index % 2 === 0;
  const isSmall = size === "small";

  const imageEl = (
    <motion.figure
      initial={{ opacity: 0, x: imageOnRight ? 20 : -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={transition}
      className="shrink-0 w-full"
    >
      <div className={`rounded-xl overflow-hidden bg-muted/10 ${isSmall ? "max-w-[240px] mx-auto md:mx-0" : ""}`}>
        <img
          src={url}
          alt={caption || `${designerName} — editorial`}
          className="w-full h-full object-contain"
          loading="lazy"
        />
      </div>
      {caption && (
        <figcaption className={`mt-2 font-body text-[13px] tracking-wide text-muted-foreground italic text-center md:text-left ${isSmall ? "max-w-[240px] mx-auto md:mx-0" : ""}`}>
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
          {renderParagraph(p)}
        </p>
      ))}
    </motion.div>
  ) : null;

  const imageWidth = isSmall ? "md:w-[24%]" : "md:w-[38%]";

  return (
    <div className={`${index === 0 ? "mb-10 md:mb-14" : "my-10 md:my-14"} flex flex-col md:flex-row gap-6 md:gap-10 items-center`}>
      {textEl && (
        <div className={`flex-1 min-w-0 ${imageOnRight ? 'md:order-1' : 'md:order-2'}`}>
          {textEl}
        </div>
      )}
      <div className={`shrink-0 w-full ${imageWidth} ${imageOnRight ? 'md:order-2' : 'md:order-1'}`}>
        {imageEl}
      </div>
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
      <div className="rounded-xl overflow-hidden bg-muted/10 aspect-square max-w-[520px] mx-auto">
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
          {renderParagraph(p)}
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
                {renderParagraph(p)}
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
function CollapsibleBiographyWrapper({
  children,
  elementCount,
  allowCollapse = true,
}: {
  children: React.ReactNode;
  elementCount: number;
  allowCollapse?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  // Only collapse on mobile when there's substantial content and no blocking media
  if (!allowCollapse || elementCount <= 3) return <>{children}</>;

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
  debugMediaOrder = false,
}: EditorialBiographyProps) {
  const isMobile = useIsMobile();
  const blocks = biography
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const hasManualMedia = !!(biographyImages && biographyImages.length > 0);
  const hasInlineMedia = blocks.some(isStandaloneMediaUrl);

  /* ------- Inline media mode (URLs pasted directly in biography) ------- */
  if (hasInlineMedia) {
    const debugEvents: string[] = [];
    // Separate into text paragraphs and media URLs, preserving order
    type Block =
      | { type: "text"; content: string }
      | { type: "image"; url: string; caption: string | null; poster: string | null; align: "left" | "right" | null }
      | { type: "video"; url: string; caption: string | null; poster: string | null };
    const parsed: Block[] = blocks.map((b) => {
      const media = parseMediaLine(b);
      if (!media) return { type: "text" as const, content: b };
      if (isVideoUrl(media.url)) {
        return { type: "video" as const, url: media.url, caption: media.caption, poster: media.poster };
      }
      return { type: "image" as const, url: media.url, caption: media.caption, poster: media.poster, align: media.align };
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
      if (debugMediaOrder) debugEvents.push(`Leading text block (${leadingText.length} paragraph${leadingText.length > 1 ? "s" : ""})`);
      elements.push(
        <div key="leading-text">
          {leadingText.map((p, pi) => (
            <p key={pi} className={pi > 0 ? "mt-4" : ""}>
              {renderParagraph(p)}
            </p>
          ))}
        </div>
      );
    }

    while (i < parsed.length) {
      const block = parsed[i];

      if (block.type === "video") {
        if (debugMediaOrder) debugEvents.push(`Video rendered: ${block.url}`);
        const inlinePoster = block.poster || undefined;

        elements.push(
          <VideoBlock
            key={`vid-${i}`}
            url={block.url}
            designerName={designerName}
            index={i}
            overrideCaption={block.caption}
            posterUrl={inlinePoster}
          />
        );
        i++;
        const followText: string[] = [];
        while (i < parsed.length && parsed[i].type === "text") {
          followText.push((parsed[i] as { type: "text"; content: string }).content);
          i++;
        }
        if (followText.length > 0) {
          elements.push(
            <div key={`post-vid-text-${i}`} className="mb-6 md:mb-10">
              {followText.map((p, pi) => (
                <p key={pi} className={pi > 0 ? "mt-4" : ""}>
                  {renderParagraph(p)}
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

        const hasFutureTextOrVideo = parsed
          .slice(i)
          .some((nextBlock) => nextBlock.type === "text" || nextBlock.type === "video");

        if (!hasFutureTextOrVideo) {
          if (isMobile) {
            if (paired.length > 0) {
              elements.push(
                <div key={`terminal-text-${imageIdx}`}>
                  {paired.map((p, pi) => (
                    <p key={pi} className={pi > 0 ? "mt-4" : ""}>
                      {renderParagraph(p)}
                    </p>
                  ))}
                </div>
              );
            }
            if (debugMediaOrder) debugEvents.push(`Suppressed terminal mobile image: ${block.url}`);
            imageIdx++;
            continue;
          }

          // On desktop, keep paired terminal images but still suppress unpaired trailing images.
          if (paired.length === 0) {
            if (debugMediaOrder) debugEvents.push(`Suppressed trailing unpaired image: ${block.url}`);
            imageIdx++;
            continue;
          }
        }

        if (paired.length > 0) {
          if (debugMediaOrder) debugEvents.push(`Split image rendered with ${paired.length} paired paragraph${paired.length > 1 ? "s" : ""}: ${block.url}`);
          elements.push(
            <SplitImageBlock
              key={`split-${imageIdx}`}
              url={block.url}
              designerName={designerName}
              index={imageIdx}
              paragraphs={paired}
              overrideCaption={block.caption}
              forceAlign={(block as any).align}
            />
          );
        } else {
          if (debugMediaOrder) debugEvents.push(`Full-width image rendered: ${block.url}`);
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

    // Append any manual biography_images that aren't already inline
    if (hasManualMedia && biographyImages) {
      for (const entry of biographyImages) {
        const media = parseMediaLine(entry);
        if (!media) continue;
        // Skip if this URL is already rendered inline
        const alreadyInline = parsed.some(
          (b) => b.type !== "text" && (b as any).url === media.url
        );
        if (alreadyInline) continue;

        if (isVideoUrl(media.url)) {
          if (debugMediaOrder) debugEvents.push(`Manual trailing video kept: ${media.url}`);
          elements.push(
            <VideoBlock
              key={`manual-vid-${imageIdx}`}
              url={media.url}
              designerName={designerName}
              index={imageIdx}
              overrideCaption={media.caption}
              posterUrl={media.poster || undefined}
            />
          );
        } else {
          // Keep manual trailing videos, suppress manual trailing images.
          if (debugMediaOrder) debugEvents.push(`Manual trailing image suppressed: ${media.url}`);
          imageIdx++;
          continue;
        }
        imageIdx++;
      }
    }

    const hasInlineVideo = parsed.some((block) => block.type === "video");

    return (
      <CollapsibleBiographyWrapper elementCount={elements.length} allowCollapse={!hasInlineVideo}>
        <div className="font-body text-sm md:text-[15px] leading-relaxed md:leading-[1.8] text-foreground/85">
          {debugMediaOrder && debugEvents.length > 0 && (
            <div className="mb-4 rounded-md border border-border bg-muted/30 p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Debug media order</p>
              <ol className="mt-2 space-y-1 text-xs text-muted-foreground list-decimal list-inside">
                {debugEvents.map((event, idx) => (
                  <li key={`${idx}-${event}`}>{event}</li>
                ))}
              </ol>
            </div>
          )}
          {elements}
        </div>
      </CollapsibleBiographyWrapper>
    );
  }

  /* ------- Manual media array or pick images fallback ------- */
  // Strip any inline media URLs from text paragraphs so they don't render as raw text
  const paragraphs = blocks.filter((b) => !isStandaloneMediaUrl(b));
  // Collect inline media from biography text and merge with manual array
  const inlineMediaEntries = blocks.filter((b) => isStandaloneMediaUrl(b));
  const manualEntries = hasManualMedia ? biographyImages! : (pickImages || []);
  const media = [...inlineMediaEntries, ...manualEntries];
  const parsedMedia = media
    .map((entry) => {
      const parsed = parseMediaLine(entry);
      if (parsed) {
        return {
          url: parsed.url,
          caption: parsed.caption,
          poster: parsed.poster,
          align: parsed.align,
          size: parsed.size,
          isVideo: isVideoUrl(parsed.url),
        };
      }

      const raw = entry.trim();
      if (!raw) return null;
      return {
        url: raw,
        caption: null,
        poster: null as string | null,
        align: null as "left" | "right" | null,
        size: null as "small" | null,
        isVideo: isVideoUrl(raw),
      };
    })
    .filter(
      (m): m is { url: string; caption: string | null; poster: string | null; align: "left" | "right" | null; size: "small" | null; isVideo: boolean } =>
        !!m && /^https?:\/\//i.test(m.url)
    );

  const findNeighborPoster = (_startIndex: number) => undefined;

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
  const debugEvents: string[] = [];

  paragraphs.forEach((p, i) => {
    textAccum.push(p);

    const shouldInsertMedia =
      (i + 1) % interval === 0 &&
      mediaIndex < parsedMedia.length;

    if (shouldInsertMedia) {
      const mediaItem = parsedMedia[mediaIndex];
      if (mediaItem.isVideo) {
        if (debugMediaOrder) debugEvents.push(`Video rendered: ${mediaItem.url}`);
        // Flush text before video
        if (textAccum.length > 0) {
          elements.push(
            <div key={`text-pre-vid-${i}`}>
              {textAccum.map((tp, ti) => (
                <p key={ti} className={ti > 0 ? "mt-4" : ""}>
                  {renderParagraph(tp)}
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
            posterUrl={mediaItem.poster || undefined}
          />
        );
      } else {
        const hasFutureParagraphs = i < paragraphs.length - 1;

        if (isMobile && !hasFutureParagraphs) {
          if (debugMediaOrder) debugEvents.push(`Suppressed terminal mobile image: ${mediaItem.url}`);
        } else {
          if (debugMediaOrder) debugEvents.push(`Split image rendered with ${textAccum.length} paired paragraph${textAccum.length !== 1 ? "s" : ""}: ${mediaItem.url}`);
          // Pair accumulated text with image in split layout
          elements.push(
            <SplitImageBlock
              key={`media-split-${mediaIndex}`}
              url={mediaItem.url}
              designerName={designerName}
              index={mediaIndex}
              paragraphs={textAccum}
              overrideCaption={mediaItem.caption}
              forceAlign={mediaItem.align}
              size={mediaItem.size}
            />
          );
          textAccum = [];
        }
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
            {renderParagraph(p)}
          </p>
        ))}
      </div>
    );
  }

  // Remaining media — only render trailing videos; skip trailing images so
  // photos never dangle at the bottom of the biography (especially on mobile).
  while (mediaIndex < parsedMedia.length) {
    const mediaItem = parsedMedia[mediaIndex];
    if (mediaItem.isVideo) {
      if (debugMediaOrder) debugEvents.push(`Trailing video kept: ${mediaItem.url}`);
      elements.push(
        <VideoBlock
          key={`media-tail-vid-${mediaIndex}`}
          url={mediaItem.url}
          designerName={designerName}
          index={mediaIndex}
          overrideCaption={mediaItem.caption}
          posterUrl={mediaItem.poster || undefined}
        />
      );
    } else if (debugMediaOrder) {
      debugEvents.push(`Trailing image suppressed: ${mediaItem.url}`);
    }
    mediaIndex++;
  }

  const hasParsedVideo = parsedMedia.some((mediaItem) => mediaItem.isVideo);

  return (
    <CollapsibleBiographyWrapper elementCount={elements.length} allowCollapse={!hasParsedVideo}>
      <div className="font-body text-sm md:text-[15px] leading-relaxed md:leading-[1.8] text-foreground/85">
        {debugMediaOrder && debugEvents.length > 0 && (
          <div className="mb-4 rounded-md border border-border bg-muted/30 p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Debug media order</p>
            <ol className="mt-2 space-y-1 text-xs text-muted-foreground list-decimal list-inside">
              {debugEvents.map((event, idx) => (
                <li key={`${idx}-${event}`}>{event}</li>
              ))}
            </ol>
          </div>
        )}
        {elements}
      </div>
    </CollapsibleBiographyWrapper>
  );
}
