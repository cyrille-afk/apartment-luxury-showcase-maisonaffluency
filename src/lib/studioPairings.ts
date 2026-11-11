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
];
function traits(product: PairingProduct) {
  // Options are deliberately excluded: an available finish is not a selected finish.
  const text = `${product.materials || ""} ${product.materials_description || ""} ${product.default_variant_label || ""}`.toLowerCase();
  const result = new Set(attributes.filter(([, pattern]) => pattern.test(text)).map(([name]) => name));
  const variants = Array.isArray(product.size_variants) ? product.size_variants : [];
  // Only attributes present in every recorded configuration describe the piece itself.
  if (variants.length) for (const [name, pattern] of attributes) {
    if (variants.every(v => v && typeof v === "object" && pattern.test(`${v.base || ""} ${v.top || ""}`.toLowerCase()))) result.add(name);
  }
  return result;
}

const purpose: Partial<Record<Role, string>> = {
  side: "a companion surface", coffee: "a central companion surface", light: "a complementary lighting layer",
  mirror: "a reflective counterpoint", rug: "a grounding textile layer", seat: "complementary seating",
  bedside: "a bedside companion surface", bed: "a bedroom anchor", storage: "a functional storage counterpoint",
};

export function rankStudioPairings(reference: PairingProduct, catalogue: PairingProduct[], excludedIds: string[]) {
  const excluded = new Set([...excludedIds, reference.id, reference.source_pick_id].filter(Boolean));
  const seen = new Set<string>();
  const sourceTraits = traits(reference);
  const allowed = complements[role(reference)];
  const ranked = catalogue.flatMap((product) => {
    const identity = product.source_pick_id || product.id;
    if (excluded.has(product.id) || excluded.has(identity) || seen.has(identity) || seen.has(product.id)) return [];
    seen.add(identity);
    seen.add(product.id);
    const candidateRole = role(product);
    const priority = allowed.indexOf(candidateRole);
    if (priority < 0) return [];
    const shared = [...traits(product)].filter((trait) => sourceTraits.has(trait));
    const specific = shared.filter((trait) => trait !== "timber" && trait !== "stone" && trait !== "upholstery");
    const score = Math.min(98, 85 + Math.max(0, 4 - priority) + shared.length * 2 + specific.length);
    const dialogue = shared.length ? `, echoing its recorded ${shared.slice(0, 3).join(" and ")} palette` : ", complementing its function without assuming an unrecorded material match";
    return [{ product_id: product.id, title: product.product_name.trim(), subtitle: "", brand: product.brand_name, pairingRole: candidateRole,
      image_url: product.image_url || "", category: product.subcategory || product.category, score,
      reason: `Pairs with ${reference.product_name.trim()} as ${purpose[candidateRole] || "a complementary piece"}${dialogue}.` }];
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