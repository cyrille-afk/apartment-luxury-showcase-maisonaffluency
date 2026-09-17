/**
 * Attachment intent helpers for the Felix concierge.
 *
 * Guardrail: descriptive "here is the file" notification sentences must never
 * be parsed as architectural parameters (zones, typologies, cities). When an
 * image/PDF is attached alongside such a string, the string is dropped from
 * entity parsing entirely and the document itself becomes the payload.
 */

/** Sentences that merely announce an attachment — never structural content. */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^(here\s*(is|are|'s)?|this\s+is|attached\s+is|please\s+(see|find)|pls\s+(see|find)|see|sharing|sending|uploading|uploaded|dropping|dropped|find)\b/i,
  /\b(attached|attachment|attachments|enclosed|file\s+dropped|drag(ged)?\s*(and|&)?\s*drop(ped)?)\b/i,
  /\b(floor\s*plan|floorplan|layout|plan|drawing|dwg|pdf|image|photo|picture|scan|document|doc|file|files)\b/i,
];

/** Words that indicate real instructions rather than a bare notification. */
const SUBSTANTIVE_HINT =
  /\b(analy[sz]e|review|compare|budget|price|quote|lead\s*time|specify|source|propose|suggest|client|ceiling|sqm|sq\s*m|m2|metres?|meters?|feet|seats?|capacity|style|deadline|timeline|why|how|what|which|can you|could you)\b/i;

/**
 * True when the string is only a notification that a file was attached.
 * Short (≤ 12 words), matches at least two placeholder signals, and carries no
 * substantive instruction.
 */
export function isAttachmentPlaceholderText(raw: string | null | undefined): boolean {
  const text = (raw ?? "").trim();
  if (!text) return true;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 12) return false;
  if (SUBSTANTIVE_HINT.test(text)) return false;
  const hits = PLACEHOLDER_PATTERNS.reduce((n, re) => (re.test(text) ? n + 1 : n), 0);
  return hits >= 2;
}

/** Human-readable list of uploaded file names. */
export function formatAttachmentNames(names: string[]): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (!clean.length) return "the uploaded document";
  if (clean.length === 1) return clean[0];
  return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
}

/** The exact acknowledgment Felix must open with after a document upload. */
export function buildDocumentAcknowledgement(names: string[]): string {
  return `Understood. I have successfully processed the uploaded floor plan structure (${formatAttachmentNames(
    names,
  )}). Let me analyze the architectural layout lines and scale metrics...`;
}

/**
 * Instruction appended to the API payload so the reply opens on the document
 * acknowledgment instead of a generic fallback template.
 */
export function buildAttachmentSystemNote(names: string[], droppedPlaceholder: boolean): string {
  const lines = [
    "DOCUMENT UPLOAD EVENT — the client has just attached architectural document(s): " +
      formatAttachmentNames(names) +
      ".",
    `Begin your reply with exactly this sentence, then continue with your analysis: "${buildDocumentAcknowledgement(names)}"`,
    "Ground the reply in the attached document's content (layout lines, room divisions, scale, dimensions). Do not use generic fallback templates and do not ask the client to restate what is already in the file.",
  ];
  if (droppedPlaceholder) {
    lines.push(
      "The accompanying message was only a notification that a file was attached. Ignore it completely for entity extraction — it defines no zone, typology, city, or shipping destination.",
    );
  }
  return lines.join("\n");
}
