export function originToCountry(value?: string | null): string | null {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  const country = cleaned
    .replace(/^hand\s*crafted\s+in\s+the\s+/i, "")
    .replace(/^handcrafted\s+in\s+the\s+/i, "")
    .replace(/^handcrafted\s+in\s+/i, "")
    .replace(/^hancrafted\s+in\s+/i, "")
    .replace(/^handmade\s+in\s+the\s+/i, "")
    .replace(/^handmade\s+in\s+/i, "")
    .replace(/^made\s+in\s+the\s+/i, "")
    .replace(/^made\s+in\s+/i, "")
    .trim();

  return country || cleaned;
}