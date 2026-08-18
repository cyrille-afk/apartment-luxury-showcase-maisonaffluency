import React, { useEffect, useRef, useState } from "react";
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
 * Premium 2-column asymmetrical editorial layout for the expanded
 * ("full portrait") biography page.
 *
 * Tightly bound, strictly editorial golden box:
 *  - max-w-5xl centered container
 *  - 12-column grid: text spans 5, media spans 7, filling the container edge to edge
 *  - ultra-fine horizontal baseline rule above every row
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

  // Manual biography_images that are not already referenced inline.
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
    <p
      className="mt-2 text-center font-body text-[9px] md:text-[10px] uppercase tracking-[0.34em] text-foreground/45 leading-[1.8]"
    >
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
        <blockquote className="border-l border-foreground/25 pl-5 md:pl-7 py-0 m-0">
          <p className="font-display text-lg md:text-xl leading-[1.55] tracking-[-0.005em] text-foreground/85 max-w-5xl">
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
      <p className="font-body text-[15px] md:text-[16px] leading-[1.9] text-foreground/80 max-w-4xl">
        {renderParagraph(content)}
      </p>
    </div>
  );
}



function MediaCell({
  block,
  designerName,
  index,
}: {
  block: Extract<Block, { kind: "image" } | { kind: "video" }>;
  designerName: string;
  index: number;
}) {
  const rawCaption =
    block.caption || captionFromUrl(block.url) || (block.kind === "video" ? "" : "");
  const label = rawCaption ? rawCaption.toUpperCase() : "";

  if (block.kind === "video") {
    return (
      <figure className="h-auto m-0">
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
    <figure className="h-auto m-0">
      <img
        src={optimizeImageUrl(block.url)}
        alt={block.caption || `${designerName} — editorial`}
        className="w-full aspect-[4/3] object-cover rounded-none"
        loading="lazy"
        decoding="async"
      />
      <Caption label={label} />
    </figure>
  );
}


type Cell = { node: React.ReactNode; isMedia: boolean; full?: boolean };
type Row = { left: Cell; right: Cell | null };


function FadeInRow({
  row,
  delay = 0,
}: {
  row: Row;
  delay?: number;
}) {
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

  const spanClass = (cell: Cell) =>
    cell.full ? "lg:col-span-12" : cell.isMedia ? "lg:col-span-7" : "lg:col-span-5";

  return (
    <div
      ref={ref}
      className={`
        grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center
        transition-all duration-700 ease-out will-change-transform
        ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}
      `}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className={`h-auto ${spanClass(row.left)}`}>{row.left.node}</div>
      {row.right ? (
        <div className={`h-auto ${spanClass(row.right)}`}>{row.right.node}</div>
      ) : row.left.full ? null : (
        <div className="hidden lg:block lg:col-span-7" />
      )}
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
}: {
  biography: string;
  biographyImages?: string[];
  designerName: string;
  /** Small anchor shown above the opening narrative. */
  eyebrow?: string;
  /** Rendered at the absolute bottom of the stream. */
  footer?: React.ReactNode;
  /** Override the width/padding container (e.g. full-bleed inside the trade shell). */
  containerClassName?: string;
}) {
  const blocks = toBlocks(biography, biographyImages);
  const texts = blocks.filter((b): b is Extract<Block, { kind: "text" }> => b.kind === "text");
  const media = blocks.filter(
    (b): b is Extract<Block, { kind: "image" } | { kind: "video" }> => b.kind !== "text",
  );

  const rows: Row[] = [];

  // Spread media evenly across the whole narrative instead of clustering it
  // against the first paragraphs: assign each media item a target text index.
  const mediaSlots = new Map<number, Extract<Block, { kind: "image" } | { kind: "video" }>[]>();
  if (texts.length > 0 && media.length > 0) {
    const step = texts.length / media.length;
    media.forEach((m, j) => {
      const idx = Math.min(texts.length - 1, Math.floor(j * step));
      const list = mediaSlots.get(idx) || [];
      list.push(m);
      mediaSlots.set(idx, list);
    });
  }

  const mediaIndexOf = (m: Block) => media.indexOf(m as never);
  let rowIndex = 0;

  if (texts.length === 0) {
    // Media only — two per row.
    for (let i = 0; i < media.length; i += 2) {
      rows.push({
        left: { node: <MediaCell block={media[i]} designerName={designerName} index={i} />, isMedia: true },
        right: media[i + 1]
          ? { node: <MediaCell block={media[i + 1]} designerName={designerName} index={i + 1} />, isMedia: true }
          : null,
      });
    }
  } else {
    texts.forEach((t, ti) => {
      const slot = mediaSlots.get(ti) || [];
      const quote = isQuote(t.content);
      const standalone = slot.length === 0 || quote;
      const textCell = (
        <TextCell
          content={t.content}
          eyebrow={ti === 0 ? eyebrow : undefined}
        />
      );

      // Quotes stretch across the full row, underneath the narrative.
      if (quote) {
        rows.push({ left: { node: textCell, isMedia: false, full: true }, right: null });
        rowIndex += 1;
        for (let k = 0; k < slot.length; k += 2) {
          const a = slot[k];
          const b = slot[k + 1];
          rows.push({
            left: { node: <MediaCell block={a} designerName={designerName} index={mediaIndexOf(a)} />, isMedia: true },
            right: b
              ? { node: <MediaCell block={b} designerName={designerName} index={mediaIndexOf(b)} />, isMedia: true }
              : null,
          });
          rowIndex += 1;
        }
        return;
      }

      if (slot.length === 0) {
        // Text-only row: span the full layout width.
        rows.push({ left: { node: textCell, isMedia: false, full: true }, right: null });
        rowIndex += 1;
        return;
      }


      const first = slot[0];
      const firstCell = (
        <MediaCell block={first} designerName={designerName} index={mediaIndexOf(first)} />
      );
      rows.push(
        rowIndex % 2 === 0
          ? { left: { node: textCell, isMedia: false }, right: { node: firstCell, isMedia: true } }
          : { left: { node: firstCell, isMedia: true }, right: { node: textCell, isMedia: false } },
      );
      rowIndex += 1;


      // Any extra media assigned to this slot pairs up on its own rows.
      for (let k = 1; k < slot.length; k += 2) {
        const a = slot[k];
        const b = slot[k + 1];
        rows.push({
          left: { node: <MediaCell block={a} designerName={designerName} index={mediaIndexOf(a)} />, isMedia: true },
          right: b
            ? { node: <MediaCell block={b} designerName={designerName} index={mediaIndexOf(b)} />, isMedia: true }
            : null,
        });
        rowIndex += 1;
      }
    });
  }


  // Group consecutive text-only rows into a single cohesive flow so paragraphs
  // read as one continuous column instead of isolated full-width blocks.
  type Group = { type: "text"; rows: Row[] } | { type: "media"; rows: Row[] };
  const grouped = rows.reduce<Group[]>((acc, row) => {
    const isTextOnly =
      row.left.isMedia === false && row.left.full === true && row.right === null;
    const last = acc[acc.length - 1];
    if (last && last.type === (isTextOnly ? "text" : "media")) {
      last.rows.push(row);
    } else {
      acc.push(isTextOnly ? { type: "text", rows: [row] } : { type: "media", rows: [row] });
    }
    return acc;
  }, []);

  return (
    <div className="bg-cream">
      <div className={containerClassName ?? "mx-auto max-w-7xl px-6 md:px-12 pt-4 md:pt-6 pb-4 md:pb-6"}>
        <div className="flex flex-col">
          {grouped.map((group, gi) =>
            group.type === "text" ? (
              <div
                key={`text-group-${gi}`}
                className="py-6 md:py-8 first:pt-0 last:pb-0"
              >
                <div className="max-w-3xl space-y-6">
                  {group.rows.map((row, ri) => (
                    <div key={`text-${gi}-${ri}`}>{row.left.node}</div>
                  ))}
                </div>
              </div>
            ) : (
              group.rows.map((row, ri) => (
                <div
                  key={`row-${gi}-${ri}`}
                  className="h-auto py-6 md:py-8 first:pt-0 last:pb-0"
                >
                  <FadeInRow row={row} delay={Math.min((gi + ri) * 80, 300)} />
                </div>
              ))
            )
          )}
        </div>


        {footer && (
          <div className="pt-4 md:pt-5 transition-all duration-700 ease-out opacity-100 translate-y-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
