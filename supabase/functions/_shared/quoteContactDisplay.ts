/** Display-only suggestion; never a verified or saved identity. */
export function suggestEmailName(email: string | null | undefined): string | null {
  const local = email?.split("@")[0] ?? "";
  if (!/^[a-z]+[._-][a-z]+$/i.test(local)) return null;
  return local.split(/[._-]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
}

const STRICT_EMAIL_LOCAL = /^[a-z]+[._-][a-z]+$/;

/** One display rule for quote screens, PDFs and emails; never persist the result. */
export function displayNameForContact(name: string | null | undefined, email?: string | null): string | null {
  const raw = (name ?? "").trim();
  const local = (email ?? "").split("@")[0]?.trim() ?? "";
  if (local && raw.toLowerCase() === local.toLowerCase()) return suggestEmailName(email) ?? raw;
  if (!raw && local) return suggestEmailName(email);
  if (!raw) return null;
  if (STRICT_EMAIL_LOCAL.test(raw)) return suggestEmailName(raw) ?? raw;
  return raw;
}