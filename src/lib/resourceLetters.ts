export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Accent-folded first letter of a maker name ("Émile" → "E"); non-letters → "#". */
export function brandInitial(name: string | null | undefined): string {
  const c = (name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}
