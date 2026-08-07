import { sanitizeBiographyCitations } from "@/lib/sanitizeBiographyCitations";
import { optimizeImageUrl } from "@/lib/cloudinary";
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

function MediaNote({ label }: { label: string }) {
  return (
    <div className="lg:col-span-4 lg:pt-1">
      <p className="font-body text-[9px] md:text-[10px] uppercase tracking-[0.34em] text-foreground/45 leading-[1.9]">
        {label}
      </p>
      <span className="mt-3 hidden lg:block h-px w-10 bg-foreground/20" aria-hidden />
    </div>
  );
}

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
  /** Small left-track anchor shown beside the opening narrative. */
  eyebrow?: string;
  /** Rendered at the absolute bottom, aligned with the right text track. */
  footer?: React.ReactNode;
}) {
  const blocks = toBlocks(biography, biographyImages);
  let firstTextRendered = false;

  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-[1400px] px-6 md:px-[6vw] py-14 md:py-20">
        <div className="flex flex-col gap-10 md:gap-14">
          {blocks.map((block, i) => {
            if (block.kind === "text") {
              const isFirst = !firstTextRendered;
              firstTextRendered = true;
              return (
                <div key={`t-${i}`} className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 h-auto">
                  <div className="lg:col-span-4">
                    {isFirst && eyebrow && (
                      <p className="font-body text-[9px] md:text-[10px] uppercase tracking-[0.34em] text-foreground/45">
                        {eyebrow}
                      </p>
                    )}
                  </div>
                  <div className="lg:col-span-8 h-auto">
                    <p className="max-w-[600px] font-body text-[15px] md:text-[16px] leading-[1.9] text-foreground/80">
                      {renderParagraph(block.content)}
                    </p>
                  </div>
                </div>
              );
            }

            if (block.kind === "video") {
              const note = (block.caption || "The Craftsmanship Video").toUpperCase();
              return (
                <div key={`v-${i}`} className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 h-auto">
                  <MediaNote label={note} />
                  <div className="lg:col-span-8 h-auto">
                    <VideoBlock
                      url={block.url}
                      designerName={designerName}
                      index={i}
                      overrideCaption={null}
                      posterUrl={block.poster || undefined}
                    />
                  </div>
                </div>
              );
            }

            const note = (block.caption || captionFromUrl(block.url) || "From the Archive").toUpperCase();
            return (
              <div key={`i-${i}`} className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 h-auto">
                <MediaNote label={note} />
                <div className="lg:col-span-8 h-auto">
                  <img
                    src={optimizeImageUrl(block.url)}
                    alt={block.caption || `${designerName} — editorial`}
                    className="w-full h-auto object-cover bg-muted/20"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
            );
          })}

          {footer && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 pt-4 md:pt-8">
              <div className="hidden lg:block lg:col-span-4" />
              <div className="lg:col-span-8">{footer}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
