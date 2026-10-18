/** Studio-branded cover page theme for client PDFs (colours stored on studios.pdf_cover_theme). */
export type CoverTheme = { background: string; accent: string; text: string };
export type CoverTypeface = "editorial" | "modern" | "classic";
export const DEFAULT_COVER_THEME: CoverTheme = { background: "#0C312F", accent: "#B08D57", text: "#F6F2EA" };
const HEX = /^#[0-9a-f]{6}$/i;

export function normalizeCoverTheme(value: unknown): CoverTheme {
  const v = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof CoverTheme, unknown>>;
  const pick = (k: keyof CoverTheme) => (typeof v[k] === "string" && HEX.test(v[k] as string) ? (v[k] as string).toUpperCase() : DEFAULT_COVER_THEME[k]);
  return { background: pick("background"), accent: pick("accent"), text: pick("text") };
}
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** WCAG relative-luminance contrast ratio. */
export function contrastRatio(a: string, b: string) {
  const lum = (h: string) => hexToRgb(h).map(c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }).reduce((t, c, i) => t + c * [0.2126, 0.7152, 0.0722][i], 0);
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
/** Heading/body fonts for the cover: only embedded PDF fonts (plus built-in Times) so output never falls back. */
export function coverFonts(typeface: string | null | undefined): { heading: "Cormorant" | "Inter" | "times"; body: "Inter" | "times" } {
  if (typeface === "modern") return { heading: "Inter", body: "Inter" };
  if (typeface === "classic") return { heading: "times", body: "times" };
  return { heading: "Cormorant", body: "Inter" };
}
