import { jsPDF } from "jspdf";

/**
 * Generate a clean editorial PDF biography for a designer.
 *
 * Renders:
 *  - Cover with designer name + specialty
 *  - Optional philosophy quote
 *  - Biography paragraphs (HTML stripped, **bold** and <strong> respected as plain bold)
 *  - Inline media: images embedded; videos shown as poster image (or placeholder) + caption + URL
 *
 * Biography format follows the same convention used by EditorialBiography:
 *  - Paragraphs separated by blank lines
 *  - A standalone media line is "URL | optional caption | poster:URL | left/right | size"
 */

interface MediaItem {
  url: string;
  caption: string | null;
  poster: string | null;
  isVideo: boolean;
}

interface ParsedBlock {
  type: "text" | "media";
  text?: string;
  media?: MediaItem;
}

const VIDEO_POSTER_FALLBACKS: Record<string, string> = {
  "https://videos.fashionnetwork.com/en/PMV20055_EN.mp4":
    "/images/thierry-lemaire-video-poster.jpg",
};

function isVideoUrl(url: string): boolean {
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return true;
  if (/res\.cloudinary\.com\/.+\/video\/upload/i.test(url)) return true;
  if (/youtube\.com\/watch|youtu\.be\/|youtube\.com\/embed/i.test(url)) return true;
  if (/vimeo\.com\//i.test(url)) return true;
  if (/facebook\.com\/.+\/videos?\//i.test(url) || /facebook\.com\/plugins\/video/i.test(url)) return true;
  return false;
}

function isImageUrl(url: string): boolean {
  if (/\.(avif|gif|jpe?g|png|webp)(\?|$)/i.test(url)) return true;
  if (/res\.cloudinary\.com\/.+\/image\/upload/i.test(url)) return true;
  if (/\/storage\/v1\/object\/public\//i.test(url) && !isVideoUrl(url)) return true;
  return false;
}

function parseMediaLine(text: string): MediaItem | null {
  const value = text.trim();
  const pipes = value.split(/\s*\|\s*/);
  const url = (pipes[0] || "").trim();
  if (!/^https?:\/\//i.test(url) || /\s/.test(url)) return null;

  let caption: string | null = null;
  let poster: string | null = null;
  for (let i = 1; i < pipes.length; i++) {
    const seg = pipes[i].trim();
    if (/^poster:/i.test(seg)) {
      poster = seg.replace(/^poster:/i, "").trim();
    } else if (/^(left|right|small)$/i.test(seg) || /^\d{1,3}%$/.test(seg)) {
      // alignment / size hints — ignored in PDF
    } else if (!caption) {
      caption = seg;
    }
  }

  const video = isVideoUrl(url);
  const image = isImageUrl(url);
  if (!video && !image) return null;

  return { url, caption, poster, isVideo: video };
}

function stripHtml(text: string): string {
  return text
    .replace(/<\/?strong>/gi, "")
    .replace(/<\/?em>/gi, "")
    .replace(/<a\s+href="[^"]*"[^>]*>([\s\S]*?)<\/a>/gi, "$1")
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\u00A0/g, " ");
}

function parseBiography(biography: string): ParsedBlock[] {
  return biography
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map<ParsedBlock>((block) => {
      const media = parseMediaLine(block);
      if (media) return { type: "media", media };
      return { type: "text", text: stripHtml(block) };
    });
}

/** Resolve the best display URL for a media entry: video → poster (or fallback), image → itself */
function resolveDisplayImageUrl(media: MediaItem): string | null {
  if (!media.isVideo) return media.url;
  if (media.poster) return media.poster;
  const fallback = VIDEO_POSTER_FALLBACKS[media.url] || VIDEO_POSTER_FALLBACKS[media.url.split("?")[0]];
  return fallback || null;
}

/** Resolve a possibly-relative URL to absolute (for fetch) */
function absoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window !== "undefined") {
    return new URL(url, window.location.origin).toString();
  }
  return url;
}

interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
  format: "JPEG" | "PNG";
}

async function loadImage(url: string): Promise<LoadedImage | null> {
  try {
    const res = await fetch(absoluteUrl(url), { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    });
    const format: "JPEG" | "PNG" = /image\/png/i.test(blob.type) ? "PNG" : "JPEG";
    return { dataUrl, width: dims.w, height: dims.h, format };
  } catch {
    return null;
  }
}

export interface DesignerBiographyPdfInput {
  designerName: string;
  specialty?: string | null;
  philosophy?: string | null;
  biography: string;
  /** Optional manual editorial media (used when biography text has no inline media) */
  biographyImages?: string[] | null;
  /** Hero image rendered on the cover */
  heroImageUrl?: string | null;
  /** Public profile URL (printed on cover footer) */
  profileUrl?: string | null;
}

export async function generateDesignerBiographyPdf(input: DesignerBiographyPdfInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 56;
  const contentWidth = pageWidth - margin * 2;

  const blocks = parseBiography(input.biography);

  // If biography has no inline media, fold biographyImages in
  const hasInlineMedia = blocks.some((b) => b.type === "media");
  if (!hasInlineMedia && input.biographyImages?.length) {
    for (const url of input.biographyImages.slice(0, 3)) {
      const media = parseMediaLine(url);
      if (media) blocks.push({ type: "media", media });
    }
  }

  /* -------------------- COVER -------------------- */
  let heroLoaded: LoadedImage | null = null;
  if (input.heroImageUrl) heroLoaded = await loadImage(input.heroImageUrl);

  if (heroLoaded) {
    // Full-bleed hero (top half)
    const heroH = pageHeight * 0.55;
    const ratio = heroLoaded.width / heroLoaded.height;
    const drawW = pageWidth;
    const drawH = drawW / ratio;
    const offsetY = drawH > heroH ? -(drawH - heroH) / 2 : 0;
    // Add as background then overlay a soft white block for text readability
    doc.addImage(heroLoaded.dataUrl, heroLoaded.format, 0, offsetY, drawW, drawH, undefined, "FAST");
    // Bottom block
    doc.setFillColor(255, 255, 255);
    doc.rect(0, heroH, pageWidth, pageHeight - heroH, "F");
  }

  const titleY = heroLoaded ? pageHeight * 0.55 + 80 : pageHeight / 2 - 40;

  doc.setTextColor(20, 20, 20);
  doc.setFont("times", "normal");
  doc.setFontSize(34);
  doc.text(input.designerName, margin, titleY, { maxWidth: contentWidth });

  if (input.specialty) {
    doc.setFontSize(13);
    doc.setTextColor(100, 100, 100);
    doc.text(input.specialty, margin, titleY + 30, { maxWidth: contentWidth });
  }

  // Footer brand
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text("Maison Affluency", margin, pageHeight - margin);
  if (input.profileUrl) {
    doc.text(input.profileUrl, pageWidth - margin, pageHeight - margin, { align: "right" });
  }

  /* -------------------- BODY -------------------- */
  doc.addPage();
  let cursorY = margin;

  const ensureSpace = (needed: number) => {
    if (cursorY + needed > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }
  };

  // Philosophy quote
  if (input.philosophy) {
    const quote = stripHtml(input.philosophy).replace(/^[\s""\u201C\u201D«»]+|[\s""\u201C\u201D«»]+$/g, "").trim();
    if (quote) {
      doc.setFont("times", "italic");
      doc.setFontSize(14);
      doc.setTextColor(40, 40, 40);
      const lines = doc.splitTextToSize(`"${quote}"`, contentWidth);
      ensureSpace(lines.length * 18 + 24);
      doc.text(lines, pageWidth / 2, cursorY + 14, { align: "center" });
      cursorY += lines.length * 18 + 28;
    }
  }

  // Section heading
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  ensureSpace(20);
  doc.text("ABOUT", margin, cursorY);
  cursorY += 18;

  // Render blocks
  for (const block of blocks) {
    if (block.type === "text" && block.text) {
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.setTextColor(35, 35, 35);
      const lines = doc.splitTextToSize(block.text, contentWidth);
      const lineHeight = 15;
      // Paragraph-by-paragraph pagination (don't split mid-paragraph if it fits next page)
      for (const line of lines) {
        ensureSpace(lineHeight);
        doc.text(line, margin, cursorY);
        cursorY += lineHeight;
      }
      cursorY += 8; // paragraph spacing
    } else if (block.type === "media" && block.media) {
      const displayUrl = resolveDisplayImageUrl(block.media);
      if (!displayUrl) {
        // Video w/o poster — render link card
        ensureSpace(48);
        doc.setDrawColor(220, 220, 220);
        doc.setFillColor(248, 248, 248);
        doc.roundedRect(margin, cursorY, contentWidth, 40, 4, 4, "FD");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        doc.text(`▶ Video: ${block.media.caption || "Watch online"}`, margin + 12, cursorY + 16);
        doc.setTextColor(80, 80, 200);
        doc.textWithLink(block.media.url, margin + 12, cursorY + 32, { url: block.media.url });
        cursorY += 52;
        continue;
      }

      const img = await loadImage(displayUrl);
      if (!img) {
        // Skip if cannot load
        continue;
      }

      const ratio = img.width / img.height;
      const drawW = contentWidth;
      const drawH = drawW / ratio;
      const captionH = block.media.caption ? 14 : 0;
      const playOverlayH = block.media.isVideo ? 16 : 0;
      ensureSpace(drawH + captionH + playOverlayH + 16);

      doc.addImage(img.dataUrl, img.format, margin, cursorY, drawW, drawH, undefined, "FAST");

      if (block.media.isVideo) {
        // Play badge
        const cx = margin + drawW / 2;
        const cy = cursorY + drawH / 2;
        doc.setFillColor(0, 0, 0);
        doc.setDrawColor(255, 255, 255);
        doc.circle(cx, cy, 18, "FD");
        doc.setFillColor(255, 255, 255);
        doc.triangle(cx - 6, cy - 8, cx - 6, cy + 8, cx + 9, cy, "F");
      }

      cursorY += drawH + 6;

      if (block.media.caption) {
        doc.setFont("times", "italic");
        doc.setFontSize(9);
        doc.setTextColor(110, 110, 110);
        const capLines = doc.splitTextToSize(block.media.caption, contentWidth);
        for (const line of capLines) {
          ensureSpace(12);
          doc.text(line, margin, cursorY + 10);
          cursorY += 12;
        }
      }

      if (block.media.isVideo) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 200);
        ensureSpace(12);
        doc.textWithLink(`▶ Watch video: ${block.media.url}`, margin, cursorY + 10, { url: block.media.url });
        cursorY += 14;
      }
      cursorY += 12;
    }
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    if (i > 1) {
      doc.text(`${input.designerName} — Maison Affluency`, margin, pageHeight - 24);
      doc.text(`${i} / ${pageCount}`, pageWidth - margin, pageHeight - 24, { align: "right" });
    }
  }

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
