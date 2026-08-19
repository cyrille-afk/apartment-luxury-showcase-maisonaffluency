import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeBiographyCitations } from "@/lib/sanitizeBiographyCitations";
import { optimizeImageUrl } from "@/lib/cloudinary-optimize";
import {
  renderParagraph,
  parseMediaLine,
  isVideoUrl,
  captionFromUrl,
  VideoBlock,
} from "@/components/EditorialBiography";

/**
 * Stacked-row editorial layout for the expanded ("full portrait") biography page.
 *
 * Architecture:
 *  - Row 1: pinned utility controls (Discover Collection + Close Portrait)
 *  - Row 2: opening blockquote, full width, bounded by max-w-4xl
 *  - Row 3: 2-column split for the first narrative paragraph + first media
 *  - Row 4: remaining narrative blocks, full width, max-w-4xl left-aligned
 */

type Block =
  | { kind: "text"; content: string }
  | { kind: "image"; url: string; caption: string | null }
  | { kind: "video"; url: string; caption: string | null; poster: string | null };

function toBlocks(biography: string, extraMedia: string[]): Block[] {
  const cleaned = sanitizeBiographyCitations(biography);
  const raw = cleaned
    .split(/\n\n+/)
    .flatMap((p) => {
      const trimmed = p.trim();
      if (!trimmed) return [] as string[];
      const lines = trimmed.split(/\n/);
      if (lines.length > 1 && lines.some((l) => parseMediaLine(l.trim()) !== null)) {
        return lines.map((l) => l.trim()).filter(Boolean);
      }
      return [trimmed];
    });

  const blocks: Block[] = raw.map((b) => {
    const media = parseMediaLine(b);
    if (!media) return { kind: "text" as const, content: b };
    if (isVideoUrl(media.url)) {
      return { kind: "video" as const, url: media.url, caption: media.caption, poster: media.poster };
    }
    return { kind: "image" as const, url: media.url, caption: media.caption };
  });

  const seen = new Set(
    blocks.filter((b) => b.kind !== "text").map((b) => (b as { url: string }).url),
  );
  for (const entry of extraMedia) {
    const media = parseMediaLine(entry);
    if (!media || seen.has(media.url)) continue;
    seen.add(media.url);
    blocks.push(
      isVideoUrl(media.url)
        ? { kind: "video", url: media.url, caption: media.caption, poster: media.poster }
        : { kind: "image", url: media.url, caption: media.caption },
    );
  }

  return blocks;
}

function Caption({ label }: { label: string }) {
  if (!label) return null;
  return (
    <p className="mt-2 text-center font-body text-[9px] md:text-[10px] uppercase tracking-[0.34em] text-foreground/45 leading-[1.5]">
      {label}
    </p>
  );
}

/** A quoted paragraph, e.g. "I want the pieces that I create…" */
function isQuote(content: string) {
  const t = content.replace(/<[^>]+>/g, "").trim();
  return /^["“'‘«]/.test(t) && /["”'’»][.!?]?$/.test(t) && t.length < 420;
}

function stripQuotes(content: string) {
  return content
    .trim()
    .replace(/^((?:<[^>]+>\s*)*)["“'‘«]\s*/, "$1")
    .replace(/\s*["”'’»]([.!?]?)((?:\s*<\/[^>]+>)*)$/, "$1$2");
}

function TextCell({
  content,
  eyebrow,
}: {
  content: string;
  eyebrow?: string;
}) {
  if (isQuote(content)) {
    return (
      <div className="h-auto">
        {eyebrow && (
          <p className="mb-2 font-body text-[9px] md:text-[10px] uppercase tracking-[0.34em] text-foreground/45">
            {eyebrow}
          </p>
        )}
        <blockquote className="border-l border-foreground/25 pl-5 md:pl-7 py-2 my-2 m-0">
          <p className="font-display text-lg md:text-xl leading-[1.55] tracking-[-0.005em] text-foreground/85 max-w-3xl">
            {renderParagraph(stripQuotes(content))}
          </p>
        </blockquote>
      </div>
    );
  }

  return (
    <div className="h-auto">
      {eyebrow && (
        <p className="mb-2 font-body text-[9px] md:text-[10px] uppercase tracking-[0.34em] text-foreground/45">
          {eyebrow}
        </p>
      )}
      <p className="font-body text-[15px] md:text-[16px] leading-[1.9] text-foreground/80 max-w-3xl">
        {renderParagraph(content)}
      </p>
    </div>
  );
}

function MediaCell({
  block,
  designerName,
  index,
  className,
}: {
  block: Extract<Block, { kind: "image" } | { kind: "video" }>;
  designerName: string;
  index: number;
  className?: string;
}) {
  const rawCaption =
    block.caption || captionFromUrl(block.url) || (block.kind === "video" ? "" : "");
  const label = rawCaption ? rawCaption.toUpperCase() : "";

  if (block.kind === "video") {
    return (
      <figure className={cn("h-auto m-0 max-w-2xl", className)}>
        <VideoBlock
          url={block.url}
          designerName={designerName}
          index={index}
          overrideCaption={null}
          posterUrl={block.poster || undefined}
          bare
        />
        <Caption label={label} />
      </figure>
    );
  }

  return (
    <figure className={cn("h-auto m-0 w-full max-w-3xl", className)}>
      <img
        src={optimizeImageUrl(block.url)}
        alt={block.caption || `${designerName} — editorial`}
        className="w-full h-auto object-contain rounded-none"
        loading="lazy"
        decoding="async"
      />
      <Caption label={label} />
    </figure>
  );
}

function FadeInRow({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInView(true);
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`
        transition-all duration-700 ease-out will-change-transform
        ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}
      `}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function EditorialBiographyColumns({
  biography,
  biographyImages = [],
  designerName,
  eyebrow,
  footer,
  containerClassName,
  collectionCtaHref,
  collectionCtaLabel = "Discover the Collection",
  closePortraitLabel = "Close Portrait",
  onClosePortrait,
}: {
  biography: string;
  biographyImages?: string[];
  designerName: string;
  eyebrow?: string;
  footer?: React.ReactNode;
  containerClassName?: string;
  collectionCtaHref?: string;
  collectionCtaLabel?: string;
  closePortraitLabel?: string;
  onClosePortrait?: () => void;
}) {
  const blocks = toBlocks(biography, biographyImages);

  const firstQuoteIndex = blocks.findIndex((b) => b.kind === "text" && isQuote(b.content));

  let firstSplitTextIndex = -1;
  let firstSplitMediaIndex = -1;

  if (firstQuoteIndex >= 0) {
    // Row 3 pairs the first narrative paragraph *after* the intro quote with
    // the first image that follows it. Any lead-in text before the quote flows
    // into the bottom narrative row along with everything else.
    firstSplitTextIndex = blocks.findIndex(
      (b, i) => i > firstQuoteIndex && b.kind === "text" && !isQuote(b.content),
    );
    firstSplitMediaIndex = blocks.findIndex((b, i) => i > firstQuoteIndex && b.kind === "image");
    if (firstSplitMediaIndex < 0) {
      firstSplitMediaIndex = blocks.findIndex((b, i) => i > firstQuoteIndex && b.kind !== "text");
    }
  } else {
    // No opening quote: fall back to the first narrative paragraph + first media.
    firstSplitTextIndex = blocks.findIndex((b) => b.kind === "text" && !isQuote(b.content));
    firstSplitMediaIndex = blocks.findIndex((b) => b.kind !== "text");
  }

  const firstQuote = firstQuoteIndex >= 0 ? blocks[firstQuoteIndex] : null;
  const firstSplitText = firstSplitTextIndex >= 0 ? blocks[firstSplitTextIndex] : null;
  const firstSplitMedia = firstSplitMediaIndex >= 0 ? blocks[firstSplitMediaIndex] : null;

  const usedIndices = new Set(
    [firstQuoteIndex, firstSplitTextIndex, firstSplitMediaIndex].filter((i): i is number => i >= 0),
  );
  const remainingBlocks = blocks
    .map((block, index) => ({ block, index }))
    .filter(({ index }) => !usedIndices.has(index));

  const hasHeaderControls = collectionCtaHref || onClosePortrait;

  return (
    <div className="bg-cream">
      <div className={containerClassName ?? "mx-auto w-full max-w-6xl px-4 pt-4 md:pt-6 pb-4 md:pb-6"}>
        <div className="flex w-full flex-col gap-y-8 md:gap-y-10">
          {/* Row 1: pinned utility controls */}
          {hasHeaderControls && (
            <FadeInRow delay={0}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                {collectionCtaHref ? (
                  <Link
                    to={collectionCtaHref}
                    className="group inline-flex items-center gap-3 px-5 py-3 md:px-6 md:py-3.5 border border-foreground/30 bg-background/40 hover:bg-background/80 hover:border-foreground/60 transition-all duration-300"
                  >
                    <span className="font-body text-[10px] md:text-[11px] uppercase tracking-[0.28em] text-foreground/80 group-hover:text-foreground transition-colors">
                      {collectionCtaLabel}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-foreground/60 group-hover:text-foreground group-hover:translate-x-1 transition-all duration-300" strokeWidth={1.25} />
                  </Link>
                ) : (
                  <div />
                )}
                {onClosePortrait && (
                  <button
                    type="button"
                    onClick={onClosePortrait}
                    className="group inline-flex items-center gap-3 px-5 py-3 md:px-6 md:py-3.5 border border-foreground/30 bg-background/40 hover:bg-background/80 hover:border-foreground/60 transition-all duration-300"
                  >
                    <X className="h-3.5 w-3.5 text-foreground/60 group-hover:text-foreground transition-all duration-300" strokeWidth={1.25} />
                    <span className="font-body text-[10px] md:text-[11px] uppercase tracking-[0.28em] text-foreground/80 group-hover:text-foreground transition-colors">
                      {closePortraitLabel}
                    </span>
                  </button>
                )}
              </div>
            </FadeInRow>
          )}

          {/* Row 2: opening blockquote, full width */}
          {firstQuote && firstQuote.kind === "text" && (
            <FadeInRow delay={80}>
              <div className="w-full">
                <TextCell content={firstQuote.content} eyebrow={eyebrow} />
              </div>
            </FadeInRow>
          )}

          {/* Row 3: 2-column split for first narrative + first media */}
          {firstSplitText && firstSplitText.kind === "text" && firstSplitMedia && firstSplitMedia.kind !== "text" && (
            <FadeInRow delay={160}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
                <div className="h-auto">
                  <TextCell content={firstSplitText.content} eyebrow={firstQuote ? undefined : eyebrow} />
                </div>
                <div className="h-auto">
                  <MediaCell
                    block={firstSplitMedia}
                    designerName={designerName}
                    index={firstSplitMediaIndex}
                    className="max-w-none"
                  />
                </div>
              </div>
            </FadeInRow>
          )}

          {/* Row 4: remaining narrative, full width */}
          {remainingBlocks.length > 0 && (
            <div className="flex w-full flex-col gap-y-6 md:gap-y-8">
              {remainingBlocks.map(({ block, index }, i) => (
                <FadeInRow key={`remaining-${index}`} delay={240 + i * 80}>
                  {block.kind === "text" ? (
                    <div className="w-full max-w-3xl">
                      <TextCell content={block.content} />
                    </div>
                  ) : (
                    <div className="w-full">
                      <MediaCell
                        block={block}
                        designerName={designerName}
                        index={index}
                        className=""
                      />
                    </div>
                  )}
                </FadeInRow>
              ))}
            </div>
          )}

          {/* Footer */}
          {footer && (
            <div className="pt-4 md:pt-5 transition-all duration-700 ease-out opacity-100 translate-y-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
