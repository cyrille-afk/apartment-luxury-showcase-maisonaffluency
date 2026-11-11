export type PairingProduct = {
  id: string;
  source_pick_id?: string | null;
  product_name: string;
  brand_name: string;
  category: string;
  subcategory: string | null;
  materials: string | null;
  materials_description: string | null;
  default_variant_label: string | null;
  image_url: string | null;
  size_variants?: unknown;
  selected_finish?: string | null;
};

type Role = "seat" | "side" | "coffee" | "dining" | "light" | "mirror" | "bed" | "bedside" | "storage" | "rug" | "unknown";
function role(product: PairingProduct): Role {
  const text = `${product.subcategory || ""} ${product.product_name} ${product.category}`.toLowerCase();
  if (/bedside|nightstand/.test(text)) return "bedside";
  if (/dining.*table|table.*dining/.test(text)) return "dining";
  if (/coffee.*table|cocktail.*table/.test(text)) return "coffee";
  if (/side.*table|end.*table|occasional.*table|pedestal/.test(text)) return "side";
  if (/mirror/.test(text)) return "mirror";
  if (/lamp|lighting|sconce|pendant|chandelier/.test(text)) return "light";
  if (/\bbed\b|\bbeds\b/.test(text)) return "bed";
  if (/rug|carpet/.test(text)) return "rug";
  if (/console|cabinet|sideboard|storage|shelving/.test(text)) return "storage";
  if (/chair|sofa|lounge|seating|armchair|bench/.test(text)) return "seat";
  return "unknown";
}

const complements: Record<Role, Role[]> = {
  seat: ["side", "coffee", "light", "mirror", "rug"],
  side: ["seat", "light", "mirror", "rug"],
  coffee: ["seat", "light", "mirror", "rug"],
  dining: ["seat", "light", "storage", "mirror", "rug"],
  light: ["seat", "side", "coffee", "storage", "mirror"],
  mirror: ["storage", "side", "seat", "light"],
  bed: ["bedside", "light", "rug", "mirror"],
  bedside: ["bed", "light", "mirror", "rug"],
  storage: ["mirror", "light", "seat", "rug"],
  rug: ["seat", "coffee", "side", "light"],
  unknown: ["light", "mirror", "rug", "side"],
};

const attributes: Array<[string, RegExp]> = [
  ["dark timber", /dark (?:stain\w*|wood|timber|oak)|black(?:ened)? (?:oak|wood|timber)|eboni[sz]|smoked (?:oak|wood)/],
  ["light timber", /natural (?:oak|wood)|nude oak|light (?:oak|wood|timber)|bleached|blonde/],
  ["oak", /\boak\b/], ["walnut", /\bwalnut\b/],
  ["timber", /\bwood\b|\btimber\b|\boak\b|\bwalnut\b|\bash\b/],
  ["bronze", /\bbronze\b/], ["brass", /\bbrass\b/],
  ["marble", /\bmarble\b|\bonice\b|\bonyx\b/],
  ["stone", /\bstone\b|\bmarble\b|\btravertine\b|\bonyx\b/],
  ["cream tones", /\bcream\b|\bivory\b|\becru\b/],
  ["leather", /\bleather\b|\bsuede\b/], ["glass", /\bglass\b/],
  ["upholstery", /upholster|fabric|velvet|mohair|boucl/],
  ["bouclé", /boucl/], ["ceramic", /ceramic|porcelain/],
];
export function studioPairingTraits(product: PairingProduct) {
  // Options are deliberately excluded: an available finish is not a selected finish.
  const text = (product.selected_finish || `${product.materials || ""} ${product.materials_description || ""} ${product.default_variant_label || ""}`).toLowerCase();
  const result = new Set(attributes.filter(([, pattern]) => pattern.test(text)).map(([name]) => name));
  const variants = Array.isArray(product.size_variants) ? product.size_variants : [];
  // Only attributes present in every recorded configuration describe the piece itself.
  if (variants.length) for (const [name, pattern] of attributes) {
    if (variants.every(v => v && typeof v === "object" && pattern.test(`${v.base || ""} ${v.top || ""}`.toLowerCase()))) result.add(name);
  }
  return result;
}

function materialVoice(values: Set<string>): string {
  const wood = values.has("dark timber") ? "dark timber" : values.has("light timber") ? "pale timber" : values.has("walnut") ? "walnut" : values.has("oak") ? "oak" : values.has("timber") ? "timber" : "";
  const texture = ["bouclé", "ceramic", "marble", "stone", "bronze", "brass", "glass", "leather", "upholstery"].find(t => values.has(t) && !(t === "stone" && values.has("marble")));
  return [wood, texture].filter(Boolean).join(" and ");
}

function editorialPairing(reference: PairingProduct, candidate: PairingProduct, candidateRole: Role, source: Set<string>, target: Set<string>) {
  const name = reference.product_name.trim();
  const candidateName = candidate.product_name.trim();
  const typology = `${candidate.product_name} ${candidate.subcategory || ""}`.toLowerCase();
  const material = materialVoice(target);
  const sourceMaterial = materialVoice(source);
  const timberContrast = (source.has("dark timber") && target.has("light timber")) || (source.has("light timber") && target.has("dark timber"));
  const tag = candidateRole === "light" ? "AMBIENT LIGHTING LAYER" : candidateRole === "mirror" ? "REFLECTIVE COUNTERPOINT" : candidateRole === "rug" ? "TEXTURAL FOUNDATION" : timberContrast ? "WARM TIMBER CONTRAST" : target.has("stone") && source.has("upholstery") ? "MINERAL COUNTERPOINT" : candidateRole === "coffee" || candidateRole === "side" || candidateRole === "bedside" ? "PROPORTIONAL COMPANION" : candidateRole === "seat" ? "SOFT SPATIAL BALANCE" : "ARCHITECTURAL ANCHOR";
  const piece = material ? `${candidateName}, in ${material},` : candidateName;
  const surfaceAction = /oval|round|circular/.test(typology) ? "introduces a curved central surface" : "establishes a central surface";
  const lightingAction = /floor/.test(typology) ? "adds a freestanding vertical lighting layer" : /table/.test(typology) ? "adds a local pool of light at surface level" : /pendant|chandelier/.test(typology) ? "adds an overhead lighting layer" : /sconce|wall/.test(typology) ? "introduces a wall-mounted lighting layer" : "introduces a lighting layer";
  const spatial: Partial<Record<Role, string>> = {
    coffee: `${piece} ${surfaceAction} around ${name}, grounding the seating arrangement without adding another seating volume.`,
    side: `${piece} brings a useful surface alongside ${name}, keeping the centre of the arrangement open.`,
    light: `${piece} ${lightingAction} around ${name}, giving the composition an illuminated focal point beyond the furniture itself.`,
    mirror: `${piece} brings a reflective plane into the setting of ${name}, balancing solid furniture with light and visual depth.`,
    rug: `${piece} defines a shared floor zone for ${name}, bringing the surrounding pieces into one composition.`,
    seat: `${piece} adds a seating layer to the setting of ${name}, balancing the reference piece with a place to pause.`,
    bedside: `${piece} gives ${name} a bedside surface, keeping daily objects within the sleeping zone.`,
    storage: `${piece} introduces a storage element beside ${name}, organising the setting around a functional architectural edge.`,
    bed: `${piece} anchors the sleeping arrangement around ${name}.`,
  };
  let dialogue = "";
  if (timberContrast) dialogue = ` ${target.has("light timber") ? "Pale" : "Dark"} timber provides a tonal counterpoint to the ${sourceMaterial || "timber"} of the reference.`;
  else if (target.has("stone") && source.has("upholstery")) dialogue = " The mineral surface offsets the softness of the reference upholstery.";
  else if (target.has("ceramic") && source.has("timber")) dialogue = " Ceramic offers a tactile counterpoint to the reference's timber.";
  else if ((target.has("brass") || target.has("bronze")) && source.has("timber")) dialogue = " Warm metal adds a measured accent against the reference's timber.";
  else if (target.has("glass") && sourceMaterial) dialogue = ` Glass brings transparency alongside the reference's ${sourceMaterial}.`;
  else if (sourceMaterial && material && sourceMaterial !== material) dialogue = ` The ${material} material language sits in dialogue with the reference's ${sourceMaterial}.`;
  return { editorial_tag: tag, reason: `${spatial[candidateRole] || `${piece} adds a complementary element around ${name}.`}${dialogue}` };
}

export function rankStudioPairings(reference: PairingProduct, catalogue: PairingProduct[], excludedIds: string[]) {
  const excluded = new Set([...excludedIds, reference.id, reference.source_pick_id].filter(Boolean));
  const seen = new Set<string>();
  // The same piece can exist twice with spacing/case title variants (e.g. "Tumulte ConvexMirror").
  const titleKey = (p: PairingProduct) => `${p.brand_name} ${p.product_name}`.toLowerCase().replace(/[^a-z0-9]/g, "");
  const seenTitles = new Set<string>([titleKey(reference)]);
  const sourceTraits = studioPairingTraits(reference);
  const allowed = complements[role(reference)];
  const ranked = catalogue.flatMap((product) => {
    const identity = product.source_pick_id || product.id;
    const title = titleKey(product);
    if (excluded.has(product.id) || excluded.has(identity) || seen.has(identity) || seen.has(product.id) || seenTitles.has(title)) return [];
    seen.add(identity);
    seen.add(product.id);
    seenTitles.add(title);
    const candidateRole = role(product);
    const priority = allowed.indexOf(candidateRole);
    if (priority < 0) return [];
    const candidateTraits = studioPairingTraits(product);
    const shared = [...candidateTraits].filter((trait) => sourceTraits.has(trait));
    const specific = shared.filter((trait) => trait !== "timber" && trait !== "stone" && trait !== "upholstery");
    const score = Math.min(98, 85 + Math.max(0, 4 - priority) + shared.length * 2 + specific.length);
    return [{ product_id: product.id, title: product.product_name.trim(), subtitle: "", brand: product.brand_name, pairingRole: candidateRole,
      image_url: product.image_url || "", category: product.subcategory || product.category, score,
      ...editorialPairing(reference, product, candidateRole, sourceTraits, candidateTraits) }];
  }).sort((a, b) => b.score - a.score || a.product_id.localeCompare(b.product_id));
  // Keep different complementary functions visible rather than eight identical surfaces.
  const roleCounts = new Map<string, number>();
  return ranked.filter(product => {
    const count = roleCounts.get(product.pairingRole) || 0;
    if (count >= 3) return false;
    roleCounts.set(product.pairingRole, count + 1);
    return true;
  }).slice(0, 8).map(({ pairingRole, ...recommendation }) => recommendation);
}