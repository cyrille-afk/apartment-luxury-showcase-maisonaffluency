import { DIMENSIONS_PLACEHOLDER, dimensionBadgeLabel, resolveDimensions } from "./productDimensions";
import { studioFinishGroups, studioSelectedFinishes, type StudioFinishProduct, type StudioFinishSelection } from "./studioFinishes";

export type ProposalSpecificationSource = {
  dimensions?: string | null;
  width_mm?: number | null;
  depth_mm?: number | null;
  height_mm?: number | null;
  size_variants?: Array<{ label?: string | null; base?: string | null; top?: string | null }> | null;
  materials?: string | null;
  finish_details?: string | null;
  selected_finish?: string | null;
  finish_swatches?: ProposalFinishSwatch[];
};

export type ProposalFinishSwatch = { id: string; axis: string; name: string; image_url: string | null; color?: string };

export function proposalSwatchColor(color?: string | null): string | undefined {
  return color && /^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(color) ? color : undefined;
}

/** One recorded W/D/H source, converted with exactly 25.4 mm per inch. */
export function proposalDimensionRows(item: ProposalSpecificationSource) {
  const dims = resolveDimensions(item);
  if (!dims || [dims.w, dims.d, dims.h].some(value => value <= 0)) return { metric: proposalSpecifications(item).dimensions, imperial: null };
  const values = [dims.w, dims.d, dims.h];
  return { metric: `${values.join(" × ")} mm`, imperial: `${values.map(value => (value / 25.4).toFixed(1)).join(" × ")} in` };
}

export function proposalLeadTime(values: Array<string | null | undefined>): string {
  const weeks = values.flatMap(value => {
    const match = value?.match(/(\d+)(?:\s*[-–]\s*(\d+))?\s*weeks?\b/i);
    return match ? [Number(match[2] || match[1])] : [];
  });
  if (!weeks.length) return "To be confirmed";
  return `${Math.max(...weeks)} weeks${weeks.length < values.length ? " · partial estimate" : ""}`;
}

/** Preserve the exact selected library crop and axis, including unpictured named selections. */
export function proposalFinishSwatches(product: StudioFinishProduct, selection: StudioFinishSelection): ProposalFinishSwatch[] {
  return studioFinishGroups(product).flatMap(group => {
    const finish = group.options.find(option => option.id === selection.ids[group.key]);
    const color = proposalSwatchColor(finish?.color);
    return finish ? [{ id: `${group.key}:${finish.id}`, axis: group.label, name: finish.name, image_url: finish.image_url, ...(color ? { color } : {}) }] : [];
  });
}

const recorded = (value?: string | null) => {
  const clean = value?.replace(/\s+/g, " ").trim();
  return clean || null;
};

/** Recorded proposal specifications only; missing catalogue data stays explicitly unconfirmed. */
export function proposalSpecifications(item: ProposalSpecificationSource) {
  const resolvedDimensions = dimensionBadgeLabel(item);
  return {
    dimensions: resolvedDimensions === DIMENSIONS_PLACEHOLDER
      ? recorded(item.dimensions) ?? "On request"
      : resolvedDimensions,
    materials: recorded(item.materials) ?? "On request",
    finishes: recorded(item.finish_details) ?? recorded(item.selected_finish) ?? "On request",
  };
}

/** Name each selected finish with its supplier axis so the PDF needs no screen controls for context. */
export function proposalFinishDetails(product: StudioFinishProduct, selection: StudioFinishSelection): string | null {
  const details = studioFinishGroups(product).flatMap(group => {
    const finish = group.options.find(option => option.id === selection.ids[group.key]);
    return finish ? [`${group.label}: ${finish.name}`] : [];
  });
  return details.length ? details.join(" · ") : null;
}

/** Selected supplier records outrank generic catalogue prose; never infer textile composition. */
export function proposalMaterialDetails(product: StudioFinishProduct, selection: StudioFinishSelection): string | null {
  const details = studioSelectedFinishes(product, selection).flatMap(({ finish }) => {
    const name = recorded(finish.name);
    if (!name) return [];
    const material = recorded(finish.material_type) ?? recorded(finish.category);
    return [material ? `${material}: ${name}` : name];
  });
  return details.length ? [...new Set(details)].join(" · ") : recorded(product.materials);
}
