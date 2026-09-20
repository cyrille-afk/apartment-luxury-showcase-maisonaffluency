// Anti-tamper heuristics run on the credential document *before* any model
// sees it. None of these decide anything on their own — each hit is recorded
// as a flag that forces the application into the human-review queue.

export type FraudFlag = { code: string; detail: string };

const latin1 = (buf: Uint8Array, from: number, to: number) =>
  new TextDecoder("latin1").decode(buf.subarray(from, to));

// Producers associated with generated, edited or template-filled documents
// rather than an issuing body's own export pipeline.
const SUSPECT_PRODUCERS = [
  /canva/i,
  /photoshop/i,
  /gimp/i,
  /illustrator/i,
  /inkscape/i,
  /figma/i,
  /pdfescape/i,
  /ilovepdf/i,
  /smallpdf/i,
  /sejda/i,
  /pdf24/i,
  /foxit\s*phantom/i,
  /nitro\s*pro/i,
  /openai|dall-?e|midjourney|stable\s*diffusion|gemini|firefly/i,
];

const metaField = (text: string, key: string): string | null => {
  const m = text.match(new RegExp(`/${key}\\s*\\(([^)]{0,200})\\)`));
  return m ? m[1].trim() : null;
};

const pdfDate = (raw: string | null): Date | null => {
  if (!raw) return null;
  const m = raw.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", s = "00"] = m;
  const dt = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
  return isNaN(dt.getTime()) ? null : dt;
};

/**
 * Inspects embedded document metadata for signs of recent generation or
 * manual template editing.
 */
export function screenDocumentMetadata(buf: Uint8Array, mime: string): FraudFlag[] {
  const flags: FraudFlag[] = [];
  // Metadata lives near the head and in the trailer of a PDF; images carry
  // EXIF/XMP near the head. Scanning both ends covers all of them cheaply.
  const text =
    latin1(buf, 0, Math.min(buf.length, 12_000)) +
    "\n" +
    latin1(buf, Math.max(0, buf.length - 12_000), buf.length);

  const producer = metaField(text, "Producer");
  const creator = metaField(text, "Creator");
  for (const label of [producer, creator]) {
    if (label && SUSPECT_PRODUCERS.some((re) => re.test(label))) {
      flags.push({
        code: "suspect_producer",
        detail: `Document was produced with "${label}", a design or editing tool rather than an issuing body's export.`,
      });
      break;
    }
  }

  if (/xmp|Adobe XMP/i.test(text) && /(AIGeneratedBy|digitalSourceType[^>]*(trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia))/i.test(text)) {
    flags.push({
      code: "ai_generated_metadata",
      detail: "Embedded content credentials mark this file as AI-generated.",
    });
  }

  const created = pdfDate(metaField(text, "CreationDate"));
  const modified = pdfDate(metaField(text, "ModDate"));
  if (created && modified && modified.getTime() - created.getTime() > 1000) {
    flags.push({
      code: "modified_after_creation",
      detail: `Document was modified after creation (created ${created.toISOString().slice(0, 10)}, modified ${modified.toISOString().slice(0, 10)}).`,
    });
  }
  const newest = modified ?? created;
  if (newest && Date.now() - newest.getTime() < 24 * 60 * 60 * 1000) {
    flags.push({
      code: "freshly_authored",
      detail: "Document was authored or edited within the last 24 hours.",
    });
  }

  // Incremental-update markers: a PDF re-saved after an edit carries more than
  // one cross-reference section.
  if (mime === "application/pdf") {
    const eofCount = (latin1(buf, 0, buf.length).match(/%%EOF/g) || []).length;
    if (eofCount > 2) {
      flags.push({
        code: "incremental_edits",
        detail: `PDF contains ${eofCount} revision markers, indicating the file was edited after it was issued.`,
      });
    }
  }

  return flags;
}
