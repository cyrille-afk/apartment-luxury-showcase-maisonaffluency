import { composeTitle, splitTitleAttribution, cleanBrandLine } from "./curatorPickLegend";
import { formatCuratorialEditionLine, productEditionBadge, isEcartReedition } from "./editionLabel";

export type ProductAttributionInput = {
  title: string;
  subtitle?: string | null;
  designerName?: string | null;
  brandName?: string | null;
  houseName?: string | null;
  edition?: string | null;
  edition_number?: string | null;
  edition_signing?: string | null;
  tags?: string[] | null;
};

const key = (value?: string | null) => (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/** Presentation only: never changes product identity, pricing, URLs or saved selections. */
export function productAttribution(input: ProductAttributionInput) {
  const composed = composeTitle(input.title, input.subtitle);
  const explicit = splitTitleAttribution(composed.title, input.subtitle);
  const designer = cleanBrandLine(explicit.designer || input.designerName || input.brandName) || null;
  const brand = cleanBrandLine(input.brandName);
  const house = cleanBrandLine(input.houseName) || (explicit.designer && key(brand) !== key(designer) ? brand : "") || null;
  const recordedEdition = formatCuratorialEditionLine(input);
  const ecart = isEcartReedition({ designerName: designer, founder: house });
  const edition = ecart ? productEditionBadge(input, true) : recordedEdition || (house && key(house) !== key(designer) ? (/\b[ée]ditions?$/i.test(house) ? house : `${house} Edition`) : null);
  // An explicit edition stays separate; do not repeat its publishing house in a second line.
  const houseInEdition = house && edition && [house, `${house} Edition`, `${house} Editions`, `${house} REEDITION`].some((label) => key(label) === key(edition));
  const houseLine = house && key(house) !== key(designer) && !houseInEdition ? house : null;
  const subtitle = composed.remainingSubtitle && !explicit.designer && !/^for\s+/i.test(composed.remainingSubtitle)
    ? composed.remainingSubtitle : null;
  return { title: explicit.title.trim(), designer, house, houseLine, edition, subtitle };
}