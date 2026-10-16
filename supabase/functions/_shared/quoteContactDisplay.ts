// Unicode letters and combining marks preserve accented and decomposed names.
const USERNAME_NAME = /^[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*(?:[._][\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*)*$/u;

function readableNamePart(part: string): string {
  return part.split(/([-'’])/u).map((segment) => {
    if (!/^\p{L}/u.test(segment)) return segment;
    // Keep recorded casing (including initials and McDonald-style names).
    return segment.replace(/^\p{L}/u, (letter) => letter.toUpperCase());
  }).join("");
}

/** Display-only suggestion; never a verified or saved identity. */
export function suggestEmailName(email: string | null | undefined): string | null {
  const local = email?.split("@")[0]?.trim() ?? "";
  if (!USERNAME_NAME.test(local) || !/[._-]/u.test(local)) return null;
  return local.split(/[._]/u).map((part) => {
    const readable = readableNamePart(part);
    return /^\p{L}\p{M}*$/u.test(part) ? `${readable}.` : readable;
  }).join(" ");
}

/** One display rule for quote screens, PDFs and emails; never persist the result. */
export function displayNameForContact(name: string | null | undefined, email?: string | null): string | null {
  const raw = (name ?? "").trim();
  const local = (email ?? "").split("@")[0]?.trim() ?? "";
  if (local && raw.toLowerCase() === local.toLowerCase()) return suggestEmailName(email) ?? raw;
  if (!raw && local) return suggestEmailName(email);
  if (!raw) return null;
  if (/[._]/u.test(raw) && USERNAME_NAME.test(raw)) return suggestEmailName(raw) ?? raw;
  return raw;
}