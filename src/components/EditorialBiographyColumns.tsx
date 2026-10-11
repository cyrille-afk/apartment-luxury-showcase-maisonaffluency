import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeBiographyCitations } from "@/lib/sanitizeBiographyCitations";
import { optimizeImageUrl } from "@/lib/cloudinary-optimize";
import { useIsMobile } from "@/hooks/use-mobile";
import { biographyPictureGroups } from "@/lib/biographyPictureGroups";
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
 *  - Following rows: ordered photos alternate sides beside successive paragraphs
 *  - Final photo row: all remaining narrative text
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
          overrideCaption=""
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
  const isMobile = useIsMobile();

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

  const pictureTextGroups = biographyPictureGroups(remainingTexts, imageBlocks.length);

  const firstVideo = videoBlocks[0];
  const additionalVideos = videoBlocks.slice(1);

  const showCollectionCta = Boolean(collectionCtaHref);
  const mobileMedia = [...videoBlocks, ...imageBlocks];
  const mobileGaps = Math.max(1, textBlocks.length - 1);
  const mobileSequence: Block[] = [];
  textBlocks.forEach(({ block }, textIndex) => {
    const gapIndex = textBlocks.length === 1 ? 0 : textIndex - 1;
    if (gapIndex >= 0) {
      const gapMedia = mobileMedia.filter((_, mediaIndex) =>
        Math.floor(mediaIndex * mobileGaps / Math.max(1, mobileMedia.length)) === gapIndex,
      );
      // Photos precede videos if there is insufficient text for separate gaps.
      gapMedia.sort((a, b) => Number(a.block.kind === "video") - Number(b.block.kind === "video"));
      mobileSequence.push(...gapMedia.map(({ block: media }) => media));
    }
    mobileSequence.push(block);
  });
  if (textBlocks.length === 0) mobileSequence.push(...blocks);

  return (
    <div className="bg-cream">
      <div className={containerClassName ?? "mx-auto w-full max-w-6xl px-6 pt-4 md:pt-6 pb-4 md:pb-6"}>
        <div className="flex w-full flex-col gap-y-8 md:gap-y-10">
          {isMobile ? (
            <div className="flex flex-col gap-8" data-biography-mobile>
              {mobileSequence.map((block, index) => (
                <div key={`mobile-${index}`} data-biography-block={block.kind}>
                  <FadeInRow>
                    {block.kind === "text" ? (
                      <TextCell content={block.content} eyebrow={index === 0 ? eyebrow : undefined} />
                    ) : (
                      <MediaCell block={block} designerName={designerName} index={index} />
                    )}
                  </FadeInRow>
                </div>
              ))}
              {showCollectionCta && collectionCtaHref && (
                <div className="flex justify-center">
                  <Link to={collectionCtaHref} className="inline-flex items-center gap-3 border border-foreground/20 px-7 py-3 text-foreground/70 hover:text-foreground transition-colors">
                    <span className="font-body text-[10px] uppercase tracking-[0.34em]">{collectionCtaLabel}</span>
                    <ArrowRight className="h-3 w-3" strokeWidth={1.25} />
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <>
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

          {/* Single collection CTA — beneath the video caption */}
          {showCollectionCta && collectionCtaHref && (
            <FadeInRow delay={140}>
              <div className="flex justify-center my-2">
                <Link
                  to={collectionCtaHref}
                  className="group inline-flex items-center gap-3 border border-foreground/20 px-7 py-3 md:px-9 md:py-3.5 hover:border-foreground/60 transition-colors duration-300"
                >
                  <span className="font-body text-[10px] md:text-[11px] uppercase tracking-[0.34em] text-foreground/70 group-hover:text-foreground transition-colors">
                    {collectionCtaLabel}
                  </span>
                  <ArrowRight className="h-3 w-3 text-foreground/50 group-hover:text-foreground group-hover:translate-x-1 transition-all duration-300" strokeWidth={1.25} />
                </Link>
              </div>
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



          {pictureTextGroups.map((texts, pictureIndex) => {
            const image = imageBlocks[pictureIndex];
            const imageOnLeft = pictureIndex % 2 === 0;
            return (
            <FadeInRow key={`picture-row-${pictureIndex}`} delay={240}>
              <div data-biography-picture-row={pictureIndex + 1}
                className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12 items-start my-12">
                {image && (
                  <MediaCell block={image.block} designerName={designerName} index={image.index}
                    className={cn("md:row-start-1", imageOnLeft ? "md:col-start-1" : "md:col-start-2")} />
                )}
                {texts.length > 0 && (
                  <div className={cn("w-full text-left space-y-8 md:row-start-1",
                    image ? (imageOnLeft ? "md:col-start-2" : "md:col-start-1") : "md:col-span-2 max-w-3xl mx-auto")}>
                    {texts.map(({ block, index }) => (
                      <TextCell key={`picture-text-${index}`} content={block.content} className="w-full text-left" />
                    ))}
                  </div>
                )}
              </div>
            </FadeInRow>
            );
          })}

          {additionalVideos.map(({ block, index }) => (
            <FadeInRow key={`extra-video-${index}`} delay={300}>
              <MediaCell
                block={block}
                designerName={designerName}
                index={index}
                className="w-full max-w-4xl mx-auto my-12 block"
              />
            </FadeInRow>
          ))}

            </>
          )}

          {/* Closing navigation link at the end of the narrative track */}
          {onClosePortrait && (
            <FadeInRow delay={360}>
              <div className="flex justify-center pt-2 pb-2">
                <button
                  type="button"
                  onClick={onClosePortrait}
                  className="group inline-flex items-center gap-3 font-body text-[10px] md:text-[11px] uppercase tracking-[0.3em] text-foreground/60 hover:text-foreground transition-colors duration-300"
                >
                  <X className="h-3 w-3 transition-transform group-hover:rotate-90" strokeWidth={1.25} />
                  <span className="underline-offset-4 group-hover:underline">
                    {closePortraitLabel}
                  </span>
                </button>
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
