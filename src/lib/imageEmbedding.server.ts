import { ImageEmbeddingError, readImageVector } from "./imageEmbeddingPolicy";

/** Shared image space: keep the model, dimensions and captions identical to existing search. */
export async function embedImageContent(apiKey: string, imageUrl: string, caption: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "google/gemini-embedding-2",
      input: [{ content: [{ type: "text", text: caption }, { type: "image_url", image_url: { url: imageUrl } }] }],
      encoding_format: "float",
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.message || payload?.error?.message || `Image service unavailable (${response.status}).`;
    const after = response.headers.get("Retry-After");
    const seconds = Number(after);
    const retryAfter = after ? (Number.isFinite(seconds) ? seconds * 1000 : Math.max(0, Date.parse(after) - Date.now())) : 0;
    throw new ImageEmbeddingError(String(message), response.status, retryAfter);
  }
  return readImageVector(await response.json());
}