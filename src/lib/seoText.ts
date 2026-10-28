/** Plain-text snippets shared by SSR and the client-side metadata mirror. */
export function seoText(value: string, max: number): string {
  const text = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + "…";
}

export function seoTitle(label: string): string {
  const suffix = " — Maison Affluency";
  return seoText(label, 60 - suffix.length) + suffix;
}

export function seoDescription(value: string | null | undefined, fallback: string): string {
  const text = seoText(value || "", 160);
  if (text.length >= 50) return text;
  const context = seoText(fallback, 160);
  if (context.length >= 50) return context;
  return seoText(`${context} Explore the curated design collection at Maison Affluency.`, 160);
}

export function productSeoText(input: { name: string; maker?: string | null; description?: string | null; materials?: string | null }) {
  const label = `${input.name}${input.maker ? ` by ${input.maker}` : ""}`;
  const fallback = `${label}. ${input.materials ? `Materials: ${input.materials}. ` : ""}Explore the curated collection at Maison Affluency.`;
  return { title: seoTitle(label), description: seoDescription(input.description, fallback) };
}