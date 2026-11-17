import { DIMENSIONS_PLACEHOLDER, dimensionBadgeLabel } from "./productDimensions";
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
};

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
