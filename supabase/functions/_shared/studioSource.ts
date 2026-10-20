/** A bare application handle is Instagram, never an undotted website host. */
export function resolveStudioSource(ref: string | null): { url: string | null; instagramHandle: string | null } {
  const value = (ref ?? "").trim();
  if (!value) return { url: null, instagramHandle: null };
  const handle = value.match(/^@([A-Za-z0-9._]{1,30})$/)?.[1] ?? (/^[A-Za-z0-9_]{1,30}$/.test(value) ? value : null);
  if (handle) return { url: `https://www.instagram.com/${handle}/`, instagramHandle: handle };
  const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(url);
    return { url, instagramHandle: /^(www\.)?instagram\.com$/i.test(parsed.hostname)
      ? parsed.pathname.match(/^\/([A-Za-z0-9._]{1,30})\/?$/)?.[1] ?? null : null };
  } catch { return { url: null, instagramHandle: null }; }
}