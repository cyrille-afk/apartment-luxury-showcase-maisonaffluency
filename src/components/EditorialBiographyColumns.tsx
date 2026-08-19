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
 * Staggered editorial layout for the expanded ("full portrait") biography page.
 *
 * Architecture:
 *  - Outer wrapper: max-w-6xl px-6
 *  - Row 1: intro paragraph + centered horizontal video
 *  - Row 2: large blockquote, centered
 *  - Row 3: first vertical photo left, next narrative paragraphs right
 *  - Row 4: remaining text left, second vertical photo right
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
  className,
}: {
  content: string;
  eyebrow?: string;
  className?: string;
}) {
  if (isQuote(content)) {
    return (
      <div className={cn("h-auto", className)}>
        {eyebrow && (
          <p className="mb-2 font-body text-[9px] md:text-[10px] uppercase tracking-[0.34em] text-foreground/45">
            {eyebrow}
          </p>
        )}
        <blockquote className="border-l border-foreground/25 pl-5 md:pl-7 py-2 my-2 m-0">
          <p className="font-display text-lg md:text-xl leading-[1.55] tracking-[-0.005em] text-foreground/85">
            {renderParagraph(stripQuotes(content))}
          </p>
        </blockquote>
      </div>
    );
  }

  return (
    <div className={cn("h-auto", className)}>
      {eyebrow && (
        <p className="mb-2 font-body text-[9px] md:text-[10px] uppercase tracking-[0.34em] text-foreground/45">
          {eyebrow}
        </p>
      )}
      <p className="font-body text-[15px] md:text-[16px] leading-[1.9] text-foreground/80">
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
      <figure className={cn("h-auto m-0 block w-full max-w-4xl mx-auto", className)}>
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
    <figure className={cn("h-auto m-0 w-full", className)}>
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

  const textBlocks = blocks
    .map((block, index) => ({ block, index }))
    .filter((b): b is { block: Extract<Block, { kind: "text" }>; index: number } => b.block.kind === "text");

  const mediaBlocks = blocks
    .map((block, index) => ({ block, index }))
    .filter(
      (b): b is { block: Extract<Block, { kind: "image" } | { kind: "video" }>; index: number } =>
        b.block.kind !== "text",
    );

  const imageBlocks = mediaBlocks.filter((b) => b.block.kind === "image");
  const videoBlocks = mediaBlocks.filter((b) => b.block.kind === "video");

  const introText = textBlocks[0];
  const blockquoteIndex = textBlocks.findIndex((t, i) => i > 0 && isQuote(t.block.content));
  const blockquoteText = blockquoteIndex > 0 ? textBlocks[blockquoteIndex] : undefined;

  const remainingTexts = blockquoteText
    ? textBlocks.slice(blockquoteIndex + 1)
    : textBlocks.slice(1);

  const row3Texts = remainingTexts.slice(0, Math.ceil(remainingTexts.length / 2));
  const row4Texts = remainingTexts.slice(Math.ceil(remainingTexts.length / 2));

  const firstVideo = videoBlocks[0];
  const firstImage = imageBlocks[0];
  const secondImage = imageBlocks[1];

  const hasHeaderControls = collectionCtaHref || onClosePortrait;

  return (
    <div className="bg-cream">
      <div className={containerClassName ?? "mx-auto w-full max-w-6xl px-6 pt-4 md:pt-6 pb-4 md:pb-6"}>
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

          {/* Row 1: intro paragraph + centered video */}
          {introText && (
            <FadeInRow delay={60}>
              <div className="w-full max-w-3xl mx-auto">
                <TextCell content={introText.block.content} eyebrow={eyebrow} />
              </div>
            </FadeInRow>
          )}

          {firstVideo && (
            <FadeInRow delay={120}>
              <MediaCell
                block={firstVideo.block}
                designerName={designerName}
                index={firstVideo.index}
                className="w-full max-w-4xl mx-auto my-12 block"
              />
            </FadeInRow>
          )}

          {/* Row 2: large blockquote */}
          {blockquoteText && (
            <FadeInRow delay={180}>
              <div className="w-full max-w-3xl mx-auto my-8">
                <TextCell content={blockquoteText.block.content} />
              </div>
            </FadeInRow>
          )}

          {/* Row 3: first photo left, text right */}
          {(firstImage || row3Texts.length > 0) && (
            <FadeInRow delay={240}>
              <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-12 items-center my-12">
                {firstImage && (
                  <MediaCell
                    block={firstImage.block}
                    designerName={designerName}
                    index={firstImage.index}
                  />
                )}
                {row3Texts.length > 0 && (
                  <div className="flex flex-col gap-y-6">
                    {row3Texts.map(({ block, index }, i) => (
                      <TextCell key={`row3-text-${index}`} content={block.content} />
                    ))}
                  </div>
                )}
              </div>
            </FadeInRow>
          )}

          {/* Row 4: text left, second photo right */}
          {(row4Texts.length > 0 || secondImage) && (
            <FadeInRow delay={300}>
              <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-12 items-center my-12">
                {row4Texts.length > 0 && (
                  <div className="flex flex-col gap-y-6">
                    {row4Texts.map(({ block, index }, i) => (
                      <TextCell key={`row4-text-${index}`} content={block.content} />
                    ))}
                  </div>
                )}
                {secondImage && (
                  <MediaCell
                    block={secondImage.block}
                    designerName={designerName}
                    index={secondImage.index}
                  />
                )}
              </div>
            </FadeInRow>
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
