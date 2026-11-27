const IMAGE_FIELDS = new Set(["imageUrl", "image_url", "referenceImageUrl", "textureImageUrl", "styleReferenceUrl", "technicalDrawingUrl", "overlayImages"]);

/** The render service cannot fetch authenticated preview assets; send their bytes instead. */
export async function prepareAiRenderImages<T>(payload: T): Promise<T> {
  const pending = new Map<string, Promise<string>>();
  const prepare = (value: string): Promise<string> => {
    if (value.startsWith("data:")) return Promise.resolve(value);
    const existing = pending.get(value);
    if (existing) return existing;
    const task = (async () => {
      const url = new URL(value, window.location.origin);
      const previewHost = /(^|\.)(lovableproject\.com|lovable\.app)$/.test(url.hostname);
      if (url.origin !== window.location.origin && !previewHost && url.protocol !== "blob:") return value;
      const response = await fetch(url.href);
      if (!response.ok) throw new Error("The selected product photo could not be loaded. Please select it again.");
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error("The selected product photo is unavailable. Please select it again.");
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not prepare the product photo."));
        reader.onerror = () => reject(new Error("Could not prepare the product photo."));
        reader.readAsDataURL(blob);
      });
    })();
    pending.set(value, task);
    return task;
  };
  const walk = async (value: unknown, imageField = false): Promise<unknown> => {
    if (typeof value === "string") return imageField ? prepare(value) : value;
    if (Array.isArray(value)) return Promise.all(value.map((entry) => walk(entry, imageField)));
    if (value && typeof value === "object") return Object.fromEntries(await Promise.all(
      Object.entries(value).map(async ([key, entry]) => [key, await walk(entry, IMAGE_FIELDS.has(key))]),
    ));
    return value;
  };
  return await walk(payload) as T;
}