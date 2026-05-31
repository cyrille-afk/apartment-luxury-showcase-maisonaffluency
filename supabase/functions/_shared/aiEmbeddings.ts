// Step 8: Optimized embeddings — batch + dedup + retry.
// Single entry point for every edge function that needs vectors.
// Uses openai/text-embedding-3-small (1536 dims) — the cheapest tier ($0.02/1M tokens)
// and matches the vector(1536) columns added in the RAG migration.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
export const EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;

const MAX_BATCH = 100;          // OpenAI accepts up to 2048; 100 keeps payloads small.
const MAX_INPUT_CHARS = 6000;   // ~1500 tokens — well under the per-input cap.

function normalize(text: string): string {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, MAX_INPUT_CHARS);
}

/**
 * Embed a list of strings. Deduplicates identical inputs before calling
 * the gateway, then re-expands so the returned array matches `inputs` 1:1.
 * Returns null entries for empty / failed inputs so callers can skip them.
 */
export async function embedBatch(
  apiKey: string,
  inputs: string[],
): Promise<(number[] | null)[]> {
  if (!inputs.length) return [];

  const normalized = inputs.map(normalize);
  const uniqueMap = new Map<string, number[] | null>();
  for (const t of normalized) {
    if (t && !uniqueMap.has(t)) uniqueMap.set(t, null);
  }
  const uniqueKeys = Array.from(uniqueMap.keys());

  for (let i = 0; i < uniqueKeys.length; i += MAX_BATCH) {
    const slice = uniqueKeys.slice(i, i + MAX_BATCH);
    const vectors = await callGateway(apiKey, slice);
    slice.forEach((key, idx) => uniqueMap.set(key, vectors[idx] ?? null));
  }

  return normalized.map((t) => (t ? uniqueMap.get(t) ?? null : null));
}

async function callGateway(apiKey: string, input: string[]): Promise<(number[] | null)[]> {
  let attempt = 0;
  while (true) {
    attempt++;
    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
    });
    if (resp.ok) {
      const data = await resp.json();
      const out = new Array<number[] | null>(input.length).fill(null);
      for (const row of (data.data || [])) {
        const idx = typeof row.index === "number" ? row.index : 0;
        if (Array.isArray(row.embedding)) out[idx] = row.embedding;
      }
      return out;
    }
    if ((resp.status === 429 || resp.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 500 * attempt));
      continue;
    }
    const errText = await resp.text().catch(() => "");
    console.error("embedBatch failed", resp.status, errText.slice(0, 300));
    return new Array(input.length).fill(null);
  }
}

/** Embed a single query for similarity search. */
export async function embedQuery(apiKey: string, text: string): Promise<number[] | null> {
  const [vec] = await embedBatch(apiKey, [text]);
  return vec;
}

/** Stable hash used to detect when source text changed and a row needs re-embedding. */
export async function sourceHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(normalize(text));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Build the canonical embedding source string for a catalog row. */
export function catalogText(row: {
  title?: string | null;
  designer?: string | null;
  brand?: string | null;
  category?: string | null;
  subcategory?: string | null;
  materials?: string | null;
  description?: string | null;
}): string {
  const designer = row.designer || row.brand || "";
  return [
    row.title || "",
    designer ? `by ${designer}` : "",
    row.subcategory || row.category || "",
    row.materials || "",
    row.description || "",
  ].filter(Boolean).join(" · ");
}
