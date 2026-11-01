import { brandInitial } from "@/lib/nameFormat";

const fold = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Search takes precedence; letter selection is a separate, catalogue-wide filter. */
export function filterDesignerDirectory<T extends { name: string; slug: string }>(
  designers: T[], query: string, letter: string | null,
): T[] {
  const search = fold(query.trim());
  return designers.filter((designer) => search
    ? fold(designer.name).includes(search) || fold(designer.slug).includes(search)
    : !letter || brandInitial(designer.name) === letter.toUpperCase());
}