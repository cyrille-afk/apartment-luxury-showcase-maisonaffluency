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

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&mdash;/gi, "\u2014")
    .replace(/&ndash;/gi, "\u2013")
    .replace(/&hellip;/gi, "\u2026")
    .replace(/&laquo;/gi, "\u00AB")
    .replace(/&raquo;/gi, "\u00BB")
    .replace(/&ldquo;/gi, "\u201C")
    .replace(/&rdquo;/gi, "\u201D")
    .replace(/&lsquo;/gi, "\u2018")
    .replace(/&rsquo;/gi, "\u2019")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

/**
 * Convert straight quotes/apostrophes into typographic ones, leaving any
 * already-curly quotes (and French guillemets) untouched.
 */
function smartenQuotes(text: string): string {
  let out = text;
  out = out.replace(/([A-Za-zÀ-ÿ])'([A-Za-zÀ-ÿ])/g, "$1\u2019$2");
  out = out.replace(/([A-Za-zÀ-ÿ])'/g, "$1\u2019");
  out = out.replace(/(^|[\s(\[{\u2014\u2013-])'/g, "$1\u2018");
  out = out.replace(/'/g, "\u2019");
  out = out.replace(/(^|[\s(\[{\u2014\u2013-])"/g, "$1\u201C");
  out = out.replace(/"/g, "\u201D");
  return out;
}

function stripHtml(text: string): string {
  return smartenQuotes(
    decodeEntities(text)
      .replace(/<\/?strong>/gi, "")
      .replace(/<\/?em>/gi, "")
      .replace(/<\/?i>/gi, "")
      .replace(/<\/?b>/gi, "")
      .replace(/<a\s+href="[^"]*"[^>]*>([\s\S]*?)<\/a>/gi, "$1")
      .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
      .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, "$1$2")
      .replace(/<[^>]+>/g, "")
      .replace(/\u00A0/g, " "),
  );
}

/* -------------------- Rich inline parsing for quotes -------------------- */

export interface RichRun {
  text: string;
  italic: boolean;
  bold: boolean;
}

/**
 * Parse a fragment of HTML / lightweight markdown into styled inline runs.
 * Supports <em>/<i>, <strong>/<b>, *italic*, **bold**.
 * Decodes entities and applies smart-quote transformation.
 */
export function parseRichInline(input: string): RichRun[] {
  const decoded = decodeEntities(input).replace(/\u00A0/g, " ");
  const cleaned = decoded
    .replace(/<a\s+href="[^"]*"[^>]*>([\s\S]*?)<\/a>/gi, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?p[^>]*>/gi, "");

  const runs: RichRun[] = [];
  let italic = 0;
  let bold = 0;
  let buf = "";

  const flush = () => {
    if (!buf) return;
    runs.push({ text: buf, italic: italic > 0, bold: bold > 0 });
    buf = "";
  };

  let i = 0;
  while (i < cleaned.length) {
    const ch = cleaned[i];

    if (ch === "<") {
      const close = cleaned.indexOf(">", i);
      if (close !== -1) {
        const tag = cleaned.slice(i + 1, close).trim().toLowerCase();
        if (/^(em|i)$/.test(tag)) { flush(); italic++; i = close + 1; continue; }
        if (/^\/(em|i)$/.test(tag)) { flush(); italic = Math.max(0, italic - 1); i = close + 1; continue; }
        if (/^(strong|b)$/.test(tag)) { flush(); bold++; i = close + 1; continue; }
        if (/^\/(strong|b)$/.test(tag)) { flush(); bold = Math.max(0, bold - 1); i = close + 1; continue; }
        i = close + 1;
        continue;
      }
    }

    if (ch === "*" && cleaned[i + 1] === "*") {
      const end = cleaned.indexOf("**", i + 2);
      if (end !== -1) {
        flush();
        const inner = cleaned.slice(i + 2, end);
        for (const r of parseRichInline(inner)) {
          runs.push({ ...r, bold: true });
        }
        i = end + 2;
        continue;
      }
    }

    if (ch === "*" && cleaned[i + 1] !== "*" && (i === 0 || cleaned[i - 1] !== "*")) {
      const end = cleaned.indexOf("*", i + 1);
      if (end !== -1 && cleaned[end + 1] !== "*") {
        flush();
        const inner = cleaned.slice(i + 1, end);
        for (const r of parseRichInline(inner)) {
          runs.push({ ...r, italic: true });
        }
        i = end + 1;
        continue;
      }
    }

    buf += ch;
    i++;
  }
  flush();

  // Apply smart quotes across the joined text, then re-split by run boundaries.
  const joined = runs.map((r) => r.text).join("\u0001");
  const smart = smartenQuotes(joined.replace(/[ \t]+/g, " "));
  const parts = smart.split("\u0001");
  return runs
    .map((r, idx) => ({ ...r, text: parts[idx] ?? r.text }))
    .filter((r) => r.text.length > 0);
}

/** Split philosophy/quote source into rich paragraphs (split on <p>, double-<br>, or blank lines). */
export function splitRichParagraphs(input: string): RichRun[][] {
  const normalized = input
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<\/?p[^>]*>/gi, "\n\n")
    .replace(/(?:<br\s*\/?>\s*){2,}/gi, "\n\n")
    .replace(/\r\n?/g, "\n");
  return normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => parseRichInline(p))
    .filter((runs) => runs.some((r) => r.text.trim().length > 0));
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

/** Extract Vimeo numeric ID from a Vimeo URL */
function extractVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return m ? m[1] : null;
}

/** Extract YouTube video ID from any common URL form */
function extractYouTubeId(url: string): string | null {
  const m =
    url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/i) ||
    url.match(/youtube\.com\/(?:watch\?v=|embed\/|v\/)([A-Za-z0-9_-]{6,})/i);
  return m ? m[1] : null;
}

/** Resolve the best display URL for a media entry: video → poster (or fallback), image → itself */
function resolveDisplayImageUrl(media: MediaItem): string | null {
  if (!media.isVideo) return media.url;
  if (media.poster) return media.poster;
  const fallback = VIDEO_POSTER_FALLBACKS[media.url] || VIDEO_POSTER_FALLBACKS[media.url.split("?")[0]];
  if (fallback) return fallback;
  // Vimeo: vumbnail returns a CORS-friendly JPEG thumbnail
  const vimeoId = extractVimeoId(media.url);
  if (vimeoId) return `https://vumbnail.com/${vimeoId}.jpg`;
  // YouTube: i.ytimg.com hi-quality thumbnail
  const ytId = extractYouTubeId(media.url);
  if (ytId) return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
  return null;
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
  /** Optional fallback hero URL used if primary fails to load (e.g. non-CORS host) */
  heroImageFallbackUrl?: string | null;
  /** Public profile URL (printed on cover footer) */
  profileUrl?: string | null;
  /** Authenticated trade user's display name — printed in footer as "Prepared for …" */
  recipientName?: string | null;
  /** Download date (defaults to now) — printed alongside recipient name */
  downloadedAt?: Date | null;
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

  // Personalized "Prepared for …" line for footers (only when we have a name)
  const recipient = (input.recipientName ?? "").trim();
  const downloadDate = input.downloadedAt ?? new Date();
  const formattedDate = downloadDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const preparedLine = recipient
    ? `Prepared for ${recipient} · ${formattedDate}`
    : `Downloaded ${formattedDate}`;

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
  if (!heroLoaded && input.heroImageFallbackUrl) {
    heroLoaded = await loadImage(input.heroImageFallbackUrl);
  }
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
  // Personalized recipient line — top-right of cover
  if (recipient || input.downloadedAt) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text(preparedLine, pageWidth - marginX, marginTop - 36, { align: "right" });
    doc.setFont("helvetica", "normal");
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
    cursorY += 20;
  };

  // Pull quote — oversized opening curly quote, centered narrow column,
  // multi-paragraph, italic/bold-aware, smart-quote preserved.
  let firstParagraphRendered = false;

  /** Set jsPDF font for a given run style (using Times for body emphasis). */
  const setRunFont = (italic: boolean, bold: boolean) => {
    const style = bold && italic ? "bolditalic" : bold ? "bold" : italic ? "italic" : "normal";
    doc.setFont("times", style as "bolditalic" | "bold" | "italic" | "normal");
  };

  /** Word-wrap a single rich paragraph into lines of runs that fit `maxWidth`. */
  const wrapRichRuns = (
    runs: RichRun[],
    maxWidth: number,
    fontSize: number,
    baseItalic: boolean,
  ): RichRun[][] => {
    doc.setFontSize(fontSize);

    type Token = { text: string; italic: boolean; bold: boolean; isSpace: boolean };
    const tokens: Token[] = [];
    for (const run of runs) {
      const italic = run.italic || baseItalic;
      const bold = run.bold;
      // Split into words + preserve internal spaces as their own tokens
      const parts = run.text.split(/(\s+)/);
      for (const part of parts) {
        if (!part) continue;
        tokens.push({ text: part, italic, bold, isSpace: /^\s+$/.test(part) });
      }
    }

    const measure = (t: Token) => {
      setRunFont(t.italic, t.bold);
      return doc.getTextWidth(t.text);
    };

    const lines: RichRun[][] = [];
    let line: Token[] = [];
    let lineWidth = 0;

    const pushLine = () => {
      // Trim trailing spaces
      while (line.length && line[line.length - 1].isSpace) line.pop();
      if (!line.length) {
        lines.push([]);
      } else {
        // Merge adjacent same-style tokens for clean drawing
        const merged: RichRun[] = [];
        for (const t of line) {
          const last = merged[merged.length - 1];
          if (last && last.italic === t.italic && last.bold === t.bold) {
            last.text += t.text;
          } else {
            merged.push({ text: t.text, italic: t.italic, bold: t.bold });
          }
        }
        lines.push(merged);
      }
      line = [];
      lineWidth = 0;
    };

    for (const tok of tokens) {
      const w = measure(tok);
      if (tok.isSpace) {
        if (line.length === 0) continue; // skip leading whitespace
        if (lineWidth + w > maxWidth) {
          pushLine();
        } else {
          line.push(tok);
          lineWidth += w;
        }
        continue;
      }
      // Non-space word
      if (lineWidth + w > maxWidth && line.length > 0) {
        pushLine();
      }
      line.push(tok);
      lineWidth += w;
    }
    if (line.length) pushLine();
    return lines;
  };

  /** Draw a wrapped line of runs centered on a given y baseline. */
  const drawCenteredRichLine = (
    line: RichRun[],
    centerX: number,
    y: number,
    fontSize: number,
    baseItalic: boolean,
    color: readonly [number, number, number],
  ) => {
    if (!line.length) return;
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    // Measure full width
    let totalW = 0;
    const widths: number[] = [];
    for (const r of line) {
      setRunFont(r.italic || baseItalic, r.bold);
      const w = doc.getTextWidth(r.text);
      widths.push(w);
      totalW += w;
    }
    let x = centerX - totalW / 2;
    for (let i = 0; i < line.length; i++) {
      const r = line[i];
      setRunFont(r.italic || baseItalic, r.bold);
      doc.text(r.text, x, y);
      x += widths[i];
    }
  };

  const renderPullQuote = (raw: string) => {
    const paragraphs = splitRichParagraphs(raw)
      // Strip surrounding quote glyphs from the very first/last text run
      .map((runs, idx, arr) => {
        if (!runs.length) return runs;
        const out = runs.map((r) => ({ ...r }));
        if (idx === 0) {
          out[0].text = out[0].text.replace(/^[\s"\u201C\u201D\u00AB\u00BB]+/, "");
        }
        if (idx === arr.length - 1) {
          const last = out[out.length - 1];
          last.text = last.text.replace(/[\s"\u201C\u201D\u00AB\u00BB]+$/, "");
        }
        return out.filter((r) => r.text.length > 0);
      })
      .filter((runs) => runs.length > 0);

    if (paragraphs.length === 0) return;

    const quoteWidth = contentWidth * 0.78;
    const lineHeight = 22;
    const fontSize = 15;
    const paragraphGap = 12;

    // Pre-wrap to estimate height
    const wrappedParagraphs = paragraphs.map((runs) =>
      wrapRichRuns(runs, quoteWidth, fontSize, true /* base italic */),
    );
    const totalLines = wrappedParagraphs.reduce((n, p) => n + p.length, 0);
    const blockHeight =
      44 /* opening glyph */ +
      totalLines * lineHeight +
      (wrappedParagraphs.length - 1) * paragraphGap +
      28 /* attribution */;
    ensureSpace(blockHeight);

    // Oversized opening quote glyph (decorative, in hairline color)
    doc.setFont("times", "normal");
    doc.setFontSize(72);
    doc.setTextColor(...rule);
    doc.text("\u201C", pageWidth / 2, cursorY + 32, { align: "center" });

    // Quote body — italic base, with bold/non-italic emphasis preserved
    let qy = cursorY + 44;
    for (let p = 0; p < wrappedParagraphs.length; p++) {
      const wrapped = wrappedParagraphs[p];
      for (const line of wrapped) {
        drawCenteredRichLine(line, pageWidth / 2, qy, fontSize, true, ink);
        qy += lineHeight;
      }
      if (p < wrappedParagraphs.length - 1) qy += paragraphGap;
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

    cursorY = qy + 18;
  };

  if (input.philosophy) renderPullQuote(input.philosophy);

  drawSectionLabel("About");

  // Render blocks
  let mediaIdx = 0;
  // Reserve 0.20..0.90 of the bar for media work, 0.90..1.0 for finalize
  const mediaStart = 0.20;
  const mediaEnd = 0.90;
  // Track which text blocks have already been consumed by side-by-side figures
  const consumedTextIdx = new Set<number>();
  for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
    const block = blocks[blockIdx];
    if (consumedTextIdx.has(blockIdx)) continue;
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

      // Look ahead: if the NEXT block is text and the drop cap has already
      // been used, render side-by-side (image left, text right) to pull
      // content up and avoid orphaned takeaways on later pages.
      const nextBlock = blocks[blockIdx + 1];
      const canSideBySide =
        firstParagraphRendered &&
        nextBlock &&
        nextBlock.type === "text" &&
        !!nextBlock.text &&
        nextBlock.text.trim().length > 0;

      if (canSideBySide) {
        // Half-column figure on the LEFT, text wraps on the RIGHT.
        // Size the image so the right column reads as a balanced block —
        // not a tall photo with a short text stub beside it.
        const gutter = 22;
        const colW = (contentWidth - gutter) / 2;
        const bodyLineH = 16.5;
        const paragraphGap = 10;

        // Gather up to 2 consecutive text blocks to pair with the figure.
        const pairedTexts: string[] = [];
        const pairedIndices: number[] = [];
        let lookahead = blockIdx + 1;
        while (lookahead < blocks.length && blocks[lookahead].type === "text") {
          const t = blocks[lookahead].text?.trim();
          if (!t) { lookahead++; continue; }
          pairedTexts.push(t);
          pairedIndices.push(lookahead);
          lookahead++;
          if (pairedTexts.length >= 2) break;
        }

        // Pre-wrap right-column text to know its true height
        doc.setFont("times", "normal");
        doc.setFontSize(11);
        const rightParagraphs: string[][] = pairedTexts.map((t) =>
          doc.splitTextToSize(t, colW),
        );
        const rightTextH =
          rightParagraphs.reduce((acc, p) => acc + p.length * bodyLineH, 0) +
          Math.max(0, rightParagraphs.length - 1) * paragraphGap;

        // Caption setup
        let capLines: string[] = [];
        const capLineH = 12;
        if (block.media!.caption) {
          doc.setFont("times", "italic");
          doc.setFontSize(9);
          capLines = doc.splitTextToSize(block.media!.caption, colW - 12);
        }
        const captionH = capLines.length ? 8 + capLines.length * capLineH + 6 : 0;
        const linkH = block.media!.isVideo ? 14 : 0;

        // Target image height: match the right-column text height for a balanced
        // spread, clamped so it never becomes a stamp or a giant.
        const minImgH = Math.min(pageHeight * 0.28, contentWidth * 0.45);
        const maxImgH = pageHeight * 0.48;
        const targetImgH = Math.max(
          minImgH,
          Math.min(maxImgH, rightTextH - captionH - linkH),
        );

        let drawH = targetImgH;
        let drawW = drawH * ratio;
        if (drawW > colW) {
          drawW = colW;
          drawH = drawW / ratio;
        }

        const figureH = drawH + 10 + captionH + linkH;
        const blockH = Math.max(figureH, rightTextH) + 18;
        ensureSpace(blockH);

        const startY = cursorY + 6;
        const imgX = marginX;
        doc.addImage(img.dataUrl, img.format, imgX, startY, drawW, drawH, undefined, "FAST");
        if (block.media!.isVideo) {
          const cx = imgX + drawW / 2;
          const cy = startY + drawH / 2;
          doc.setFillColor(20, 20, 20);
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(1);
          doc.circle(cx, cy, 14, "FD");
          doc.setFillColor(255, 255, 255);
          doc.triangle(cx - 4, cy - 6, cx - 4, cy + 6, cx + 7, cy, "F");
        }

        // Caption beneath image
        let leftY = startY + drawH + 10;
        if (capLines.length) {
          doc.setFont("times", "italic");
          doc.setFontSize(9);
          doc.setTextColor(...inkSoft);
          for (const line of capLines) {
            doc.text(line, imgX + 12, leftY);
            leftY += capLineH;
          }
          doc.setDrawColor(...rule);
          doc.setLineWidth(0.6);
          doc.line(imgX, startY + drawH + 12, imgX, leftY);
          leftY += 4;
        }
        if (block.media!.isVideo) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(80, 80, 160);
          doc.textWithLink(`Watch — ${sanitizeUrlForDisplay(block.media!.url)}`, imgX, leftY + 8, { url: block.media!.url });
          leftY += 14;
        }

        // Right-column text — render ALL paired paragraphs; overflow continues
        // full-width below the figure so no copy is dropped.
        const rightX = marginX + colW + gutter;
        doc.setFont("times", "normal");
        doc.setFontSize(11);
        doc.setTextColor(...ink);
        let rightY = startY;
        // Allow text to flow up to ~2 lines past the bottom of the image+caption
        // before spilling underneath, to avoid orphan single lines.
        const rightFlowMaxY = startY + figureH + bodyLineH * 2;

        const remainder: string[] = [];
        let stoppedEarly = false;
        for (let p = 0; p < rightParagraphs.length; p++) {
          const para = rightParagraphs[p];
          for (let l = 0; l < para.length; l++) {
            if (stoppedEarly || rightY + bodyLineH > rightFlowMaxY) {
              stoppedEarly = true;
              remainder.push(para[l]);
              continue;
            }
            doc.text(para[l], rightX, rightY + 4);
            rightY += bodyLineH;
          }
          if (p < rightParagraphs.length - 1) {
            if (stoppedEarly) remainder.push("");
            else rightY += paragraphGap;
          }
        }

        cursorY = startY + Math.max(leftY - startY, rightY - startY) + 12;

        if (remainder.length) {
          doc.setFont("times", "normal");
          doc.setFontSize(11);
          doc.setTextColor(...ink);
          for (const line of remainder) {
            if (line === "") { cursorY += paragraphGap; continue; }
            ensureSpace(bodyLineH);
            // Re-wrap to full width in case original wrap was narrower
            const wide = doc.splitTextToSize(line, contentWidth);
            for (const wl of wide) {
              ensureSpace(bodyLineH);
              doc.text(wl, marginX, cursorY + 4);
              cursorY += bodyLineH;
            }
          }
        }
        cursorY += 12;
        for (const idx of pairedIndices) consumedTextIdx.add(idx);
        continue;
      }

      // Default: full-width figure (existing behaviour)
      const maxImgH = pageHeight * 0.36;
      let drawW = contentWidth;
      let drawH = drawW / ratio;
      if (drawH > maxImgH) {
        drawH = maxImgH;
        drawW = drawH * ratio;
      }
      const imgX = marginX + (contentWidth - drawW) / 2;

      let capLines: string[] = [];
      const capLineH = 12;
      const capPadTop = 8;
      const capPadBottom = 6;
      if (block.media.caption) {
        doc.setFont("times", "italic");
        doc.setFontSize(9);
        capLines = doc.splitTextToSize(block.media.caption, contentWidth - 16);
      }
      const captionH = capLines.length ? capPadTop + capLines.length * capLineH + capPadBottom : 0;
      const linkH = block.media.isVideo ? 18 : 0;
      const figureH = 6 + drawH + 10 + captionH + linkH + 16;

      ensureSpace(figureH);

      cursorY += 6;
      doc.addImage(img.dataUrl, img.format, imgX, cursorY, drawW, drawH, undefined, "FAST");

      if (block.media.isVideo) {
        const cx = imgX + drawW / 2;
        const cy = cursorY + drawH / 2;
        doc.setFillColor(20, 20, 20);
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(1);
        doc.circle(cx, cy, 16, "FD");
        doc.setFillColor(255, 255, 255);
        doc.triangle(cx - 5, cy - 7, cx - 5, cy + 7, cx + 8, cy, "F");
      }

      cursorY += drawH + 12;

      if (capLines.length) {
        const capStartY = cursorY;
        doc.setFont("times", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...inkSoft);
        for (const line of capLines) {
          doc.text(line, marginX + 12, cursorY + capPadTop);
          cursorY += capLineH;
        }
        const capEndY = cursorY;
        doc.setDrawColor(...rule);
        doc.setLineWidth(0.6);
        doc.line(marginX, capStartY + 2, marginX, capEndY);
        cursorY += capPadBottom;
      }


      if (block.media.isVideo) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 160);
        ensureSpace(14);
        doc.textWithLink(`Watch — ${sanitizeUrlForDisplay(block.media.url)}`, marginX, cursorY + 10, { url: block.media.url });
        cursorY += 14;
      }
      cursorY += 18;
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
    // Personalized recipient line under the main footer row
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text(preparedLine, pageWidth / 2, pageHeight - marginBottom + 56, { align: "center" });
    doc.setFont("helvetica", "normal");
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
