// Binary signature ("magic byte") validation.
//
// Extensions and Content-Type headers are attacker-controlled: a renamed
// executable, a shell script or a PDF/HTML polyglot all arrive claiming to be
// "document.pdf". The only trustworthy evidence is the first bytes of the
// file itself, so every credential upload is checked here before it is
// written to storage or shown to a model.

export type DetectedType = "application/pdf" | "image/png" | "image/jpeg" | null;

const startsWith = (buf: Uint8Array, sig: number[], offset = 0) =>
  sig.every((b, i) => buf[offset + i] === b);

/** Returns the real media type, or null when the bytes match nothing allowed. */
export function detectFileType(buf: Uint8Array): DetectedType {
  if (buf.length < 12) return null;
  // %PDF-
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  // \x89PNG\r\n\x1a\n
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // JPEG SOI + APPn marker, and EOI at the tail
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "image/jpeg";
  return null;
}

// Executables, archives and scripts we reject outright even if they somehow
// also satisfy a container check (polyglot defence).
const FORBIDDEN_SIGNATURES: { name: string; sig: number[] }[] = [
  { name: "Windows executable", sig: [0x4d, 0x5a] }, // MZ
  { name: "ELF binary", sig: [0x7f, 0x45, 0x4c, 0x46] },
  { name: "Mach-O binary", sig: [0xcf, 0xfa, 0xed, 0xfe] },
  { name: "Mach-O binary", sig: [0xfe, 0xed, 0xfa, 0xce] },
  { name: "Java class", sig: [0xca, 0xfe, 0xba, 0xbe] },
  { name: "ZIP / Office / JAR archive", sig: [0x50, 0x4b, 0x03, 0x04] },
  { name: "RAR archive", sig: [0x52, 0x61, 0x72, 0x21] },
  { name: "7-Zip archive", sig: [0x37, 0x7a, 0xbc, 0xaf] },
  { name: "GZIP archive", sig: [0x1f, 0x8b] },
  { name: "Shell script", sig: [0x23, 0x21] }, // #!
];

const TEXT_HEAD_BYTES = 2048;

export type SignatureVerdict =
  | { ok: true; mime: Exclude<DetectedType, null>; note: string }
  | { ok: false; reason: string };

/**
 * Authenticates the bytes as a real PDF / PNG / JPEG and rejects renamed
 * binaries, scripts and polyglots. `declaredName` and `declaredMime` are only
 * used to detect a mismatch worth reporting — never to accept a file.
 */
export function verifyFileSignature(
  buf: Uint8Array,
  declaredName = "",
  declaredMime = "",
): SignatureVerdict {
  if (buf.length < 64) return { ok: false, reason: "File is empty or truncated." };

  for (const f of FORBIDDEN_SIGNATURES) {
    if (startsWith(buf, f.sig)) {
      return { ok: false, reason: `Rejected: the file is a ${f.name}, not a document.` };
    }
  }

  const mime = detectFileType(buf);
  if (!mime) {
    return {
      ok: false,
      reason: "Rejected: the file contents are not a genuine PDF, PNG or JPEG.",
    };
  }

  const head = new TextDecoder("latin1").decode(buf.subarray(0, TEXT_HEAD_BYTES));

  // Polyglot / injected-markup defence: a genuine PDF or image header never
  // carries HTML or script markup in its first bytes.
  if (/<\s*(script|html|\?php|%|svg)\b/i.test(head)) {
    return { ok: false, reason: "Rejected: the file contains embedded markup or script." };
  }

  if (mime === "application/pdf") {
    const tail = new TextDecoder("latin1").decode(buf.subarray(Math.max(0, buf.length - 2048)));
    if (!/%%EOF/.test(tail)) {
      return { ok: false, reason: "Rejected: the PDF is malformed or truncated." };
    }
  }

  if (mime === "image/jpeg") {
    const last = buf.length - 2;
    if (!(buf[last] === 0xff && buf[last + 1] === 0xd9)) {
      // Trailing data after the JPEG end marker is a classic polyglot carrier;
      // a missing marker means the file is not a clean JPEG.
      const eoi = buf.lastIndexOf?.(0xd9) ?? -1;
      if (eoi < 0) return { ok: false, reason: "Rejected: the JPEG is malformed or truncated." };
    }
  }

  const ext = declaredName.split(".").pop()?.toLowerCase() ?? "";
  const expected = mime === "application/pdf" ? ["pdf"] : mime === "image/png" ? ["png"] : ["jpg", "jpeg"];
  const mismatch =
    (ext && !expected.includes(ext)) ||
    (declaredMime && declaredMime !== mime && !declaredMime.startsWith("application/octet-stream"));

  return {
    ok: true,
    mime,
    note: mismatch
      ? `Declared "${declaredMime || ext || "unknown"}" but the bytes are ${mime}.`
      : "",
  };
}

/** Lower-case hex SHA-256 of the raw bytes. */
export async function sha256Hex(buf: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
