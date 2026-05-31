// Helpers to keep prompt context lean. Smaller prompts = fewer input tokens
// and lower latency. Use these whenever you are about to stuff catalog rows,
// chat history, or document text into a model call.

const WHITESPACE_RE = /\s+/g;

/** Collapse runs of whitespace and trim — saves tokens on user-pasted text. */
export function compressWhitespace(s: string | null | undefined): string {
  if (!s) return "";
  return String(s).replace(WHITESPACE_RE, " ").trim();
}

/** Hard-truncate to N characters with a single ellipsis. */
export function clip(s: string | null | undefined, max: number): string {
  const t = compressWhitespace(s);
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

/**
 * Strip a catalog row to the fields the model actually needs to reason about
 * a piece: id, title, brand, category, materials, optional one-line description.
 * Drops null/undefined/empty values so the JSON stays small.
 */
export function compressCatalogRow(row: Record<string, unknown>): Record<string, unknown> {
  const keep = ["id", "title", "brand_name", "category", "subcategory", "materials", "designer_name"];
  const out: Record<string, unknown> = {};
  for (const k of keep) {
    const v = row[k];
    if (v != null && v !== "") out[k] = typeof v === "string" ? clip(v, 120) : v;
  }
  if (typeof row.description === "string" && row.description) {
    out.description = clip(row.description, 200);
  }
  return out;
}

/** Compress a list of catalog rows into a compact JSON-stringifiable array. */
export function compressCatalog(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return rows.map(compressCatalogRow);
}

/**
 * Trim a chat history to the most recent N messages, plus optionally the very
 * first user message (often contains the brief). Avoids unbounded growth.
 */
export function trimChatHistory<T extends { role: string; content: unknown }>(
  messages: T[],
  keepLast = 12,
  keepFirstUser = true,
): T[] {
  if (messages.length <= keepLast) return messages;
  const tail = messages.slice(-keepLast);
  if (!keepFirstUser) return tail;
  const firstUser = messages.find((m) => m.role === "user");
  if (firstUser && !tail.includes(firstUser)) return [firstUser, ...tail];
  return tail;
}
