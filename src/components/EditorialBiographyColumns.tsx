import React from "react";
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
 * 12-column grid:
 *  - col-span-4 (left)  → typographic anchors, metadata + media captions
 *  - col-span-8 (right) → running narrative (max 600px) and rich media
 *
 * Media never centers or wraps: it sits in the right track with its caption
 * note perfectly aligned on the left track. Everything is h-auto so blocks of
 * any length push the page down fluidly.
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
    <p className="mt-3 font-body text-[9px] md:text-[10px] uppercase tracking-[0.34em] text-foreground/45 leading-[1.8]">
      {label}
    </p>
  );
}

function TextCell({ content, eyebrow }: { content: string; eyebrow?: string }) {
  return (
    <div className="h-auto">
      {eyebrow && (
        <p className="mb-4 font-body text-[9px] md:text-[10px] uppercase tracking-[0.34em] text-foreground/45">
          {eyebrow}
        </p>
      )}
      <p className="max-w-[500px] font-body text-[15px] md:text-[16px] leading-[1.9] text-foreground/80">
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
        <div className="[&_*]:rounded-none overflow-hidden">
          <VideoBlock
            url={block.url}
            designerName={designerName}
            index={index}
            overrideCaption={null}
            posterUrl={block.poster || undefined}
          />
        </div>
        <Caption label={label} />
      </figure>
    );
  }

  return (
    <figure className="h-auto m-0">
      <img
        src={optimizeImageUrl(block.url)}
        alt={block.caption || `${designerName} — editorial`}
        className="w-full h-auto object-cover bg-muted/20 rounded-none"
        loading="lazy"
        decoding="async"
      />
      <Caption label={label} />
    </figure>
  );
}

type Row = { left: React.ReactNode; right: React.ReactNode };

export default function EditorialBiographyColumns({
  biography,
  biographyImages = [],
  designerName,
  eyebrow,
  footer,
}: {
  biography: string;
  biographyImages?: string[];
  designerName: string;
  /** Small anchor shown above the opening narrative. */
  eyebrow?: string;
  /** Rendered at the absolute bottom of the stream. */
  footer?: React.ReactNode;
}) {
  const blocks = toBlocks(biography, biographyImages);
  const texts = blocks.filter((b): b is Extract<Block, { kind: "text" }> => b.kind === "text");
  const media = blocks.filter(
    (b): b is Extract<Block, { kind: "image" } | { kind: "video" }> => b.kind !== "text",
  );

  const rows: Row[] = [];
  let ti = 0;
  let mi = 0;
  let rowIndex = 0;

  // Alternate: text/media, media/text, text/media …
  while (ti < texts.length && mi < media.length) {
    const textCell = (
      <TextCell content={texts[ti].content} eyebrow={ti === 0 ? eyebrow : undefined} />
    );
    const mediaCell = (
      <MediaCell block={media[mi]} designerName={designerName} index={mi} />
    );
    rows.push(
      rowIndex % 2 === 0
        ? { left: textCell, right: mediaCell }
        : { left: mediaCell, right: textCell },
    );
    ti += 1;
    mi += 1;
    rowIndex += 1;
  }

  // Leftovers keep both columns filled: pair remaining items two per row.
  while (ti < texts.length) {
    const left = <TextCell content={texts[ti].content} eyebrow={ti === 0 ? eyebrow : undefined} />;
    ti += 1;
    const right = ti < texts.length ? <TextCell content={texts[ti].content} /> : null;
    if (right) ti += 1;
    rows.push({ left, right });
  }
  while (mi < media.length) {
    const left = <MediaCell block={media[mi]} designerName={designerName} index={mi} />;
    mi += 1;
    const right =
      mi < media.length ? (
        <MediaCell block={media[mi]} designerName={designerName} index={mi} />
      ) : null;
    if (right) mi += 1;
    rows.push({ left, right });
  }

  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-[1400px] px-6 md:px-[6vw] py-14 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-14 lg:gap-x-16 lg:gap-y-20 items-start">
          {rows.map((row, i) => (
            <React.Fragment key={`row-${i}`}>
              <div className="h-auto">{row.left}</div>
              <div className="h-auto">{row.right}</div>
            </React.Fragment>
          ))}
        </div>

        {footer && <div className="pt-12 md:pt-20">{footer}</div>}
      </div>
    </div>
  );
}

