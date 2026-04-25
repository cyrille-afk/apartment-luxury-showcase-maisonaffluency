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

/**
 * Load any remote image URL and re-encode to a clean JPEG data URL via canvas.
 * This avoids jsPDF rendering glitches (vertical stripes) when the source is
 * AVIF / WebP / progressive JPEG / CORS-tainted, and guarantees a valid payload.
 */
async function loadImage(url: string): Promise<LoadedImage | null> {
  const tryLoadElement = (src: string, useCrossOrigin: boolean) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      if (useCrossOrigin) img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const absolute = absoluteUrl(url);

  // Strategy 1: load <img crossOrigin> directly (works for Cloudinary etc.)
  let imgEl: HTMLImageElement | null = null;
  try {
    imgEl = await tryLoadElement(absolute, true);
  } catch {
    // Strategy 2: fetch → blob → object URL → load
    try {
      const res = await fetch(absolute, { mode: "cors" });
      if (!res.ok) return null;
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      try {
        imgEl = await tryLoadElement(objectUrl, false);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      return null;
    }
  }

  if (!imgEl) return null;

  // Cap to a reasonable resolution to keep PDF size manageable
  const MAX_DIM = 1600;
  const naturalW = imgEl.naturalWidth || imgEl.width;
  const naturalH = imgEl.naturalHeight || imgEl.height;
  if (!naturalW || !naturalH) return null;
  const scale = Math.min(1, MAX_DIM / Math.max(naturalW, naturalH));
  const w = Math.max(1, Math.round(naturalW * scale));
  const h = Math.max(1, Math.round(naturalH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // White background in case of transparency (JPEG has no alpha)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  try {
    ctx.drawImage(imgEl, 0, 0, w, h);
  } catch {
    return null;
  }

  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    // Tainted canvas — fallback fail
    return null;
  }
  if (!dataUrl || dataUrl === "data:,") return null;

  return { dataUrl, width: w, height: h, format: "JPEG" };
}

/** Sanitize a URL for printing inside the PDF (remove control chars/whitespace). */
function sanitizeUrlForDisplay(url: string): string {
  return url.replace(/[\r\n\t]+/g, "").trim();
}

export type PdfProgressStage =
  | "parsing"
  | "cover"
  | "media"
  | "finalizing"
  | "done";

export interface PdfProgress {
  stage: PdfProgressStage;
  /** 0..1 overall progress */
  ratio: number;
  /** Human-readable label for inline display */
  label: string;
  /** When stage is "media", which item index (1-based) */
  current?: number;
  /** When stage is "media", total media items */
  total?: number;
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
  /** Optional progress callback for inline UI feedback */
  onProgress?: (p: PdfProgress) => void;
}

export async function generateDesignerBiographyPdf(input: DesignerBiographyPdfInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Editorial margins: generous outer whitespace, asymmetric vertical rhythm
  const marginX = 64;
  const marginTop = 72;
  const marginBottom = 80;
  const contentWidth = pageWidth - marginX * 2;

  // Editorial palette (subtle warm neutrals)
  const ink = [28, 28, 30] as const;        // body
  const inkSoft = [70, 70, 74] as const;    // secondary
  const muted = [140, 138, 132] as const;   // labels / meta
  const rule = [200, 196, 188] as const;    // hairline rules

  const emit = (p: PdfProgress) => {
    try {
      input.onProgress?.(p);
    } catch {
      /* ignore consumer errors */
    }
  };
  // Yield to the event loop so the UI can paint between heavy steps
  const tick = () => new Promise<void>((r) => setTimeout(r, 0));

  emit({ stage: "parsing", ratio: 0.02, label: "Reading biography…" });
  const blocks = parseBiography(input.biography);

  // If biography has no inline media, fold biographyImages in
  const hasInlineMedia = blocks.some((b) => b.type === "media");
  if (!hasInlineMedia && input.biographyImages?.length) {
    for (const url of input.biographyImages.slice(0, 3)) {
      const media = parseMediaLine(url);
      if (media) blocks.push({ type: "media", media });
    }
  }

  const mediaBlocks = blocks.filter((b) => b.type === "media");
  const totalMedia = mediaBlocks.length;

  /* -------------------- COVER -------------------- */
  emit({ stage: "cover", ratio: 0.08, label: "Composing cover…" });
  await tick();
  let heroLoaded: LoadedImage | null = null;
  if (input.heroImageUrl) heroLoaded = await loadImage(input.heroImageUrl);
  emit({ stage: "cover", ratio: 0.18, label: "Cover ready" });

  if (heroLoaded) {
    // Full-bleed hero (top ~62% — editorial proportion)
    const heroH = pageHeight * 0.62;
    const ratio = heroLoaded.width / heroLoaded.height;
    const drawW = pageWidth;
    const drawH = drawW / ratio;
    const offsetY = drawH > heroH ? -(drawH - heroH) / 2 : 0;
    doc.addImage(heroLoaded.dataUrl, heroLoaded.format, 0, offsetY, drawW, drawH, undefined, "FAST");
    // Bottom block (cream-white)
    doc.setFillColor(252, 250, 246);
    doc.rect(0, heroH, pageWidth, pageHeight - heroH, "F");
  } else {
    doc.setFillColor(252, 250, 246);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
  }

  // Eyebrow label above the title
  const titleBlockTop = heroLoaded ? pageHeight * 0.62 + 56 : pageHeight * 0.32;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.setCharSpace(2.4);
  doc.text("MAISON AFFLUENCY  ·  DESIGNER BIOGRAPHY", marginX, titleBlockTop);
  doc.setCharSpace(0);

  // Hairline under eyebrow
  doc.setDrawColor(...rule);
  doc.setLineWidth(0.4);
  doc.line(marginX, titleBlockTop + 10, marginX + 56, titleBlockTop + 10);

  // Designer name — display serif, generous size
  doc.setFont("times", "normal");
  doc.setFontSize(40);
  doc.setTextColor(...ink);
  doc.text(input.designerName, marginX, titleBlockTop + 50, { maxWidth: contentWidth });

  if (input.specialty) {
    doc.setFont("times", "italic");
    doc.setFontSize(13);
    doc.setTextColor(...inkSoft);
    doc.text(input.specialty, marginX, titleBlockTop + 76, { maxWidth: contentWidth });
  }

  // Cover footer: brand left, URL right, hairline above
  doc.setDrawColor(...rule);
  doc.setLineWidth(0.4);
  doc.line(marginX, pageHeight - marginBottom + 18, pageWidth - marginX, pageHeight - marginBottom + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.setCharSpace(1.6);
  doc.text("MAISON AFFLUENCY", marginX, pageHeight - marginBottom + 34);
  doc.setCharSpace(0);
  if (input.profileUrl) {
    doc.setFontSize(8);
    doc.text(sanitizeUrlForDisplay(input.profileUrl), pageWidth - marginX, pageHeight - marginBottom + 34, { align: "right" });
  }

  /* -------------------- BODY -------------------- */
  doc.addPage();
  doc.setFillColor(252, 250, 246);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  let cursorY = marginTop;

  const ensureSpace = (needed: number) => {
    if (cursorY + needed > pageHeight - marginBottom) {
      doc.addPage();
      doc.setFillColor(252, 250, 246);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      cursorY = marginTop;
    }
  };

  const drawSectionLabel = (label: string) => {
    ensureSpace(40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.setCharSpace(2.6);
    doc.text(label.toUpperCase(), marginX, cursorY);
    doc.setCharSpace(0);
    // Hairline rule underneath
    doc.setDrawColor(...rule);
    doc.setLineWidth(0.4);
    doc.line(marginX, cursorY + 8, marginX + 40, cursorY + 8);
    cursorY += 28;
  };

  // Pull quote — oversized opening curly quote, centered narrow column, em-dash attribution
  let firstParagraphRendered = false;
  const renderPullQuote = (raw: string) => {
    const quote = stripHtml(raw)
      .replace(/^[\s""\u201C\u201D«»]+|[\s""\u201C\u201D«»]+$/g, "")
      .trim();
    if (!quote) return;

    // Reserve space estimate before drawing
    const quoteWidth = contentWidth * 0.78;
    const quoteX = marginX + (contentWidth - quoteWidth) / 2;

    doc.setFont("times", "italic");
    doc.setFontSize(16);
    const lines = doc.splitTextToSize(quote, quoteWidth);
    const lineHeight = 22;
    const blockHeight = 60 /* opening glyph */ + lines.length * lineHeight + 36 /* attribution + spacing */;
    ensureSpace(blockHeight);

    // Oversized opening quote glyph (decorative)
    doc.setFont("times", "normal");
    doc.setFontSize(72);
    doc.setTextColor(...rule);
    doc.text("\u201C", pageWidth / 2, cursorY + 44, { align: "center" });

    // Quote body
    doc.setFont("times", "italic");
    doc.setFontSize(15);
    doc.setTextColor(...ink);
    let qy = cursorY + 60;
    for (const line of lines) {
      doc.text(line, pageWidth / 2, qy, { align: "center" });
      qy += lineHeight;
    }

    // Attribution rule + name
    qy += 10;
    doc.setDrawColor(...rule);
    doc.setLineWidth(0.4);
    doc.line(pageWidth / 2 - 18, qy, pageWidth / 2 + 18, qy);
    qy += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.setCharSpace(2);
    doc.text(input.designerName.toUpperCase(), pageWidth / 2, qy, { align: "center" });
    doc.setCharSpace(0);

    cursorY = qy + 24;
  };

  if (input.philosophy) renderPullQuote(input.philosophy);

  drawSectionLabel("About");

  // Render blocks
  let mediaIdx = 0;
  // Reserve 0.20..0.90 of the bar for media work, 0.90..1.0 for finalize
  const mediaStart = 0.20;
  const mediaEnd = 0.90;
  for (const block of blocks) {
    if (block.type === "media") {
      mediaIdx += 1;
      const ratio = totalMedia > 0
        ? mediaStart + ((mediaIdx - 1) / totalMedia) * (mediaEnd - mediaStart)
        : mediaStart;
      emit({
        stage: "media",
        ratio,
        current: mediaIdx,
        total: totalMedia,
        label: totalMedia > 1
          ? `Embedding media ${mediaIdx} of ${totalMedia}…`
          : "Embedding media…",
      });
      await tick();
    }
    if (block.type === "text" && block.text) {
      const text = block.text.trim();
      if (!text) continue;

      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...ink);
      const lineHeight = 16.5; // generous leading

      // Drop cap on the very first paragraph for editorial flair
      if (!firstParagraphRendered && text.length > 80) {
        firstParagraphRendered = true;
        const dropChar = text.charAt(0);
        const restText = text.slice(1).replace(/^\s+/, "");

        // Drop cap glyph
        doc.setFont("times", "normal");
        doc.setFontSize(48);
        doc.setTextColor(...ink);
        const dropCapWidth = 32;
        ensureSpace(lineHeight * 3 + 8);
        doc.text(dropChar, marginX, cursorY + 36);

        // First 3 lines wrap around the drop cap; remainder full width
        doc.setFont("times", "normal");
        doc.setFontSize(11);
        const indentedWidth = contentWidth - dropCapWidth;
        const allLines = doc.splitTextToSize(restText, indentedWidth);
        const wrapLines = allLines.slice(0, 3);
        const restLines = doc.splitTextToSize(allLines.slice(3).join(" "), contentWidth);

        let lineIdx = 0;
        for (const line of wrapLines) {
          doc.text(line, marginX + dropCapWidth, cursorY + 12 + lineIdx * lineHeight);
          lineIdx++;
        }
        cursorY += wrapLines.length * lineHeight + 6;

        for (const line of restLines) {
          ensureSpace(lineHeight);
          doc.text(line, marginX, cursorY + 4);
          cursorY += lineHeight;
        }
        cursorY += 12;
        continue;
      }

      const lines = doc.splitTextToSize(text, contentWidth);
      for (const line of lines) {
        ensureSpace(lineHeight);
        doc.text(line, marginX, cursorY + 4);
        cursorY += lineHeight;
      }
      cursorY += 14; // paragraph spacing
    } else if (block.type === "media" && block.media) {
      const displayUrl = resolveDisplayImageUrl(block.media);
      if (!displayUrl) {
        // Video w/o poster — minimal editorial link card (no rounded pill)
        ensureSpace(64);
        cursorY += 6;
        doc.setDrawColor(...rule);
        doc.setLineWidth(0.4);
        doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
        cursorY += 16;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...muted);
        doc.setCharSpace(2);
        doc.text("VIDEO", marginX, cursorY);
        doc.setCharSpace(0);
        cursorY += 14;
        if (block.media.caption) {
          doc.setFont("times", "italic");
          doc.setFontSize(11);
          doc.setTextColor(...ink);
          doc.text(block.media.caption, marginX, cursorY);
          cursorY += 16;
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 160);
        doc.textWithLink(sanitizeUrlForDisplay(block.media.url), marginX, cursorY, { url: block.media.url });
        cursorY += 14;
        doc.setDrawColor(...rule);
        doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
        cursorY += 22;
        continue;
      }

      const img = await loadImage(displayUrl);
      if (!img) continue;

      const ratio = img.width / img.height;
      const drawW = contentWidth;
      const drawH = drawW / ratio;
      const captionH = block.media.caption ? 28 : 0;
      const linkH = block.media.isVideo ? 18 : 0;
      ensureSpace(drawH + captionH + linkH + 28);

      cursorY += 8;
      doc.addImage(img.dataUrl, img.format, marginX, cursorY, drawW, drawH, undefined, "FAST");

      if (block.media.isVideo) {
        // Subtle play badge — smaller, refined
        const cx = marginX + drawW / 2;
        const cy = cursorY + drawH / 2;
        doc.setFillColor(20, 20, 20);
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(1);
        doc.circle(cx, cy, 16, "FD");
        doc.setFillColor(255, 255, 255);
        doc.triangle(cx - 5, cy - 7, cx - 5, cy + 7, cx + 8, cy, "F");
      }

      cursorY += drawH + 12;

      if (block.media.caption) {
        // Italic caption with leading vertical rule
        doc.setDrawColor(...rule);
        doc.setLineWidth(0.6);
        const capStartY = cursorY;
        doc.setFont("times", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...inkSoft);
        const capLines = doc.splitTextToSize(block.media.caption, contentWidth - 16);
        for (const line of capLines) {
          ensureSpace(12);
          doc.text(line, marginX + 12, cursorY + 8);
          cursorY += 12;
        }
        doc.line(marginX, capStartY + 2, marginX, cursorY);
      }

      if (block.media.isVideo) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 160);
        ensureSpace(14);
        doc.textWithLink(`Watch — ${sanitizeUrlForDisplay(block.media.url)}`, marginX, cursorY + 10, { url: block.media.url });
        cursorY += 14;
      }
      cursorY += 22;
    }
  }

  emit({ stage: "finalizing", ratio: 0.92, label: "Adding page footers…" });
  await tick();

  // Footer on every page (except cover)
  const pageCount = doc.getNumberOfPages();
  for (let i = 2; i <= pageCount; i++) {
    doc.setPage(i);
    // Hairline above footer
    doc.setDrawColor(...rule);
    doc.setLineWidth(0.4);
    doc.line(marginX, pageHeight - marginBottom + 28, pageWidth - marginX, pageHeight - marginBottom + 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.setCharSpace(1.6);
    doc.text(input.designerName.toUpperCase(), marginX, pageHeight - marginBottom + 44);
    doc.text("MAISON AFFLUENCY", pageWidth / 2, pageHeight - marginBottom + 44, { align: "center" });
    doc.setCharSpace(0);
    doc.text(`${i} / ${pageCount}`, pageWidth - marginX, pageHeight - marginBottom + 44, { align: "right" });
  }

  emit({ stage: "finalizing", ratio: 0.97, label: "Encoding PDF…" });
  await tick();
  const blob = doc.output("blob");
  emit({ stage: "done", ratio: 1, label: "Ready" });
  return blob;
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
