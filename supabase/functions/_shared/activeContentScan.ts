// Active-content screening for uploaded documents.
//
// Magic-byte validation proves a file *is* a PDF/PNG/JPEG. It says nothing
// about what the PDF will do when a reviewer opens it: a structurally perfect
// PDF can carry embedded JavaScript, an /OpenAction that fires on open, a
// /Launch action, an embedded executable payload or remote-loading RichMedia.
// Those are the constructs used in virtually every weaponised-document attack,
// and our administrators open these files by hand from the review queue.
//
// This scanner is deterministic, dependency-free and errs on the side of
// quarantine. It never mutates the file; it returns a verdict the caller uses
// to block storage (malicious) or to quarantine + flag for review (suspicious).

export type ActiveContentSeverity = "clean" | "suspicious" | "malicious";

export type ActiveContentVerdict = {
  severity: ActiveContentSeverity;
  /** Machine codes, e.g. "pdf_javascript". Empty when clean. */
  flags: string[];
  /** Human-readable reasons, safe to show a reviewer. */
  reasons: string[];
};

type Rule = {
  code: string;
  reason: string;
  severity: Exclude<ActiveContentSeverity, "clean">;
  pattern: RegExp;
};

// Matched against the raw bytes decoded as latin1 so that binary streams are
// preserved verbatim. PDF names may be hex-escaped (/J#61vaScript), so each
// rule tolerates the `#xx` form on any character.
const h = (word: string) =>
  word
    .split("")
    .map((c) => `(?:${c}|#${c.charCodeAt(0).toString(16).padStart(2, "0")})`)
    .join("");

const PDF_RULES: Rule[] = [
  {
    code: "pdf_javascript",
    reason: "The PDF contains embedded JavaScript.",
    severity: "malicious",
    pattern: new RegExp(`/(?:${h("JavaScript")}|${h("JS")})\\b`, "i"),
  },
  {
    code: "pdf_launch_action",
    reason: "The PDF contains a /Launch action that can start another program.",
    severity: "malicious",
    pattern: new RegExp(`/${h("Launch")}\\b`, "i"),
  },
  {
    code: "pdf_embedded_file",
    reason: "The PDF carries an embedded file attachment.",
    severity: "malicious",
    pattern: new RegExp(`/(?:${h("EmbeddedFile")}|${h("Filespec")})\\b`, "i"),
  },
  {
    code: "pdf_open_action",
    reason: "The PDF runs an action automatically when it is opened.",
    severity: "suspicious",
    pattern: new RegExp(`/(?:${h("OpenAction")}|${h("AA")})\\b`, "i"),
  },
  {
    code: "pdf_remote_content",
    reason: "The PDF loads remote or streaming media.",
    severity: "suspicious",
    pattern: new RegExp(`/(?:${h("RichMedia")}|${h("SubmitForm")}|${h("GoToR")})\\b`, "i"),
  },
  {
    code: "pdf_xfa_form",
    reason: "The PDF uses a dynamic XFA form.",
    severity: "suspicious",
    pattern: new RegExp(`/${h("XFA")}\\b`, "i"),
  },
];

// Images are inert, but metadata blocks are a common script-smuggling vector
// (e.g. PHP/JS in an EXIF comment served by a misconfigured host).
const IMAGE_RULES: Rule[] = [
  {
    code: "image_embedded_script",
    reason: "The image metadata contains script markup.",
    severity: "malicious",
    pattern: /<\s*script\b|<\?php\b|eval\s*\(/i,
  },
  {
    code: "image_html_payload",
    reason: "The image metadata contains HTML markup.",
    severity: "suspicious",
    pattern: /<\s*(iframe|object|embed)\b/i,
  },
];

const decodeLatin1 = (bytes: Uint8Array) => {
  let out = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return out;
};

/**
 * Screens already-signature-validated bytes for executable/active content.
 * `mime` must be the *detected* type, never the declared one.
 */
export function scanActiveContent(bytes: Uint8Array, mime: string): ActiveContentVerdict {
  const text = decodeLatin1(bytes);
  const rules = mime === "application/pdf" ? PDF_RULES : IMAGE_RULES;

  const flags: string[] = [];
  const reasons: string[] = [];
  let severity: ActiveContentSeverity = "clean";

  for (const rule of rules) {
    if (!rule.pattern.test(text)) continue;
    flags.push(rule.code);
    reasons.push(rule.reason);
    if (rule.severity === "malicious") severity = "malicious";
    else if (severity !== "malicious") severity = "suspicious";
  }

  // An encrypted PDF cannot be screened at all, so it can never be treated as
  // clean: it goes to quarantine and a human decides.
  if (mime === "application/pdf" && /\/Encrypt\b/.test(text)) {
    flags.push("pdf_encrypted");
    reasons.push("The PDF is encrypted and its contents could not be screened.");
    if (severity !== "malicious") severity = "suspicious";
  }

  return { severity, flags, reasons };
}

export const isBlockingVerdict = (v: ActiveContentVerdict) => v.severity === "malicious";
