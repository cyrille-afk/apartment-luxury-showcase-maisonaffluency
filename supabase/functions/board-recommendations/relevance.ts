export type CatalogSource = "curator" | "trade";

export interface ProductContextInput {
  id: string;
  title: string;
  brand: string;
  category?: string;
  subcategory?: string;
  materials?: string;
  description?: string;
  dimensions?: string;
  tags?: string[];
  source?: CatalogSource;
  pinnedAnchor?: boolean;
}

export interface BoardIntentSummary {
  dominantRooms: string[];
  presentRoles: string[];
  desiredRoles: string[];
  materialTokens: string[];
}

export interface RankedCatalogCandidate extends ProductContextInput {
  role: string;
  roomTags: string[];
  materialTokens: string[];
  normalizedBrand?: string;
  score: number;
  fitNote: string;
  anchorTitle: string;
}

interface ProductInsight extends ProductContextInput {
  role: string;
  roomTags: string[];
  materialTokens: string[];
  normalizedBrand: string;
}

const MATERIAL_KEYWORDS = [
  "walnut",
  "oak",
  "ash",
  "wood",
  "timber",
  "stone",
  "marble",
  "travertine",
  "limestone",
  "granite",
  "alabaster",
  "glass",
  "brass",
  "bronze",
  "copper",
  "steel",
  "metal",
  "linen",
  "leather",
  "boucle",
  "wool",
  "ceramic",
  "plaster",
  "concrete",
  "paper",
  "parchment",
  "rattan",
  "cane",
  "velvet",
  "fabric",
  "textile",
];

const ROLE_RULES: Array<{ role: string; keywords: string[] }> = [
  { role: "dining_table", keywords: ["dining table"] },
  { role: "coffee_table", keywords: ["coffee table", "cocktail table"] },
  { role: "side_table", keywords: ["side table", "end table", "occasional table", "occasion table", "drink table"] },
  { role: "bedside_table", keywords: ["bedside table", "nightstand", "night stand"] },
  { role: "desk", keywords: ["desk", "writing table"] },
  { role: "dining_chair", keywords: ["dining chair", "dining armchair"] },
  { role: "desk_chair", keywords: ["desk chair", "office chair", "task chair"] },
  { role: "lounge_chair", keywords: ["lounge chair", "easy chair", "club chair"] },
  { role: "armchair", keywords: ["armchair", "accent chair"] },
  { role: "chair", keywords: [" chair ", "chair"] },
  { role: "sofa", keywords: ["sofa", "settee", "loveseat", "sectional"] },
  { role: "bench", keywords: ["bench", "banquette"] },
  { role: "sideboard", keywords: ["sideboard"] },
  { role: "credenza", keywords: ["credenza", "buffet"] },
  { role: "console", keywords: ["console"] },
  { role: "cabinet", keywords: ["cabinet", "cupboard"] },
  { role: "wall_light", keywords: ["wall light", "wall lamp", "sconce"] },
  { role: "pendant", keywords: ["pendant"] },
  { role: "chandelier", keywords: ["chandelier"] },
  { role: "ceiling_light", keywords: ["ceiling light", "suspension light", "suspension"] },
  { role: "floor_lamp", keywords: ["floor lamp", "standing lamp"] },
  { role: "table_lamp", keywords: ["table lamp", "desk lamp"] },
  { role: "rug", keywords: ["rug", "carpet"] },
  { role: "ottoman", keywords: ["ottoman", "pouf"] },
  { role: "mirror", keywords: ["mirror"] },
  { role: "bed", keywords: [" bed ", "bed"] },
  { role: "stool", keywords: ["stool"] },
];

const ROLE_ROOMS: Record<string, string[]> = {
  dining_table: ["dining"],
  dining_chair: ["dining"],
  pendant: ["dining", "living"],
  chandelier: ["dining", "living"],
  ceiling_light: ["dining", "living"],
  wall_light: ["dining", "living", "bedroom", "entry"],
  cabinet: ["dining", "living"],
  sideboard: ["dining", "living"],
  credenza: ["dining", "living"],
  bench: ["dining", "bedroom", "living"],
  rug: ["dining", "living", "bedroom"],
  lounge_chair: ["living"],
  armchair: ["living", "bedroom"],
  chair: ["living", "dining"],
  sofa: ["living"],
  coffee_table: ["living"],
  side_table: ["living", "bedroom"],
  floor_lamp: ["living", "bedroom"],
  table_lamp: ["living", "bedroom", "office"],
  console: ["living", "entry"],
  ottoman: ["living", "bedroom"],
  mirror: ["entry", "bedroom", "living"],
  bed: ["bedroom"],
  bedside_table: ["bedroom"],
  desk: ["office"],
  desk_chair: ["office"],
  stool: ["dining", "living", "office"],
  unknown: ["general"],
};

const ROLE_LABELS: Record<string, string> = {
  dining_table: "dining table",
  dining_chair: "dining chair",
  pendant: "pendant light",
  chandelier: "chandelier",
  ceiling_light: "ceiling light",
  wall_light: "wall light",
  cabinet: "cabinet",
  sideboard: "sideboard",
  credenza: "credenza",
  bench: "bench",
  rug: "rug",
  lounge_chair: "lounge chair",
  armchair: "armchair",
  chair: "chair",
  sofa: "sofa",
  coffee_table: "coffee table",
  side_table: "side table",
  floor_lamp: "floor lamp",
  table_lamp: "table lamp",
  console: "console",
  ottoman: "ottoman",
  mirror: "mirror",
  bed: "bed",
  bedside_table: "bedside table",
  desk: "desk",
  desk_chair: "desk chair",
  stool: "stool",
  unknown: "accent piece",
};

const ROOM_LABELS: Record<string, string> = {
  dining: "dining room",
  living: "living room",
  bedroom: "bedroom",
  office: "study",
  entry: "entry",
  outdoor: "outdoor setting",
  general: "room",
};

const PAIRING_WEIGHTS: Record<string, Record<string, number>> = {
  pendant: { dining_table: 18, dining_chair: 16, sideboard: 14, credenza: 14, console: 13, rug: 7 },
  chandelier: { dining_table: 18, dining_chair: 16, sideboard: 14, credenza: 14, console: 13, rug: 7 },
  ceiling_light: { dining_table: 18, dining_chair: 16, sideboard: 14, credenza: 14, console: 13, rug: 7 },
  dining_table: {
    dining_chair: 15,
    pendant: 13,
    chandelier: 13,
    sideboard: 11,
    credenza: 11,
    bench: 10,
    rug: 9,
  },
  dining_chair: {
    dining_table: 14,
    pendant: 8,
    chandelier: 8,
    sideboard: 7,
    credenza: 7,
    rug: 7,
  },
  chair: {
    side_table: 10,
    floor_lamp: 9,
    rug: 8,
    dining_table: 7,
  },
  lounge_chair: {
    side_table: 14,
    floor_lamp: 13,
    coffee_table: 10,
    sofa: 9,
    ottoman: 9,
    rug: 8,
    table_lamp: 6,
  },
  armchair: {
    side_table: 14,
    floor_lamp: 13,
    coffee_table: 10,
    sofa: 9,
    ottoman: 9,
    rug: 8,
    table_lamp: 6,
  },
  sofa: {
    coffee_table: 14,
    side_table: 12,
    floor_lamp: 11,
    lounge_chair: 10,
    armchair: 10,
    rug: 10,
    ottoman: 8,
  },
  coffee_table: {
    sofa: 13,
    lounge_chair: 11,
    armchair: 11,
    rug: 8,
    side_table: 6,
  },
  side_table: {
    table_lamp: 12,
    lounge_chair: 10,
    armchair: 10,
    sofa: 8,
    floor_lamp: 7,
  },
  floor_lamp: {
    lounge_chair: 10,
    armchair: 10,
    sofa: 8,
    side_table: 6,
  },
  table_lamp: {
    side_table: 11,
    console: 8,
    bedside_table: 12,
    desk: 10,
  },
  credenza: {
    dining_table: 11,
    dining_chair: 7,
    pendant: 5,
    chandelier: 5,
    rug: 5,
  },
  sideboard: {
    dining_table: 11,
    dining_chair: 7,
    pendant: 5,
    chandelier: 5,
    rug: 5,
  },
  rug: {
    dining_table: 8,
    sofa: 9,
    lounge_chair: 8,
    armchair: 8,
    bed: 8,
  },
  bed: {
    bedside_table: 14,
    table_lamp: 12,
    bench: 8,
    rug: 8,
  },
  bedside_table: {
    bed: 14,
    table_lamp: 12,
  },
  desk: {
    desk_chair: 13,
    table_lamp: 10,
  },
  desk_chair: {
    desk: 13,
    table_lamp: 7,
  },
};

function normalizeText(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s&/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function intersect(a: string[], b: string[]): string[] {
  const bSet = new Set(b);
  return unique(a.filter((value) => bSet.has(value)));
}

function extractMaterialTokens(input: ProductContextInput): string[] {
  const tagText = (input.tags || []).join(" ");
  const haystack = normalizeText(
    [input.materials, input.description, tagText].filter(Boolean).join(" "),
  );

  return unique(MATERIAL_KEYWORDS.filter((token) => new RegExp(`\\b${token}\\b`).test(haystack)));
}

export function inferRole(input: ProductContextInput): string {
  const title = normalizeText(input.title);
  if (/\b(?:barstool|counterstool)\b/.test(title)) return "stool";
  if (/\b(?:bar|counter)\b.*\bstool\b/.test(title)) return "stool";
  if (/\bstool\b/.test(title)) return "stool";
  if (/ottomans?\s*&\s*stools?/.test(normalizeText(input.subcategory)) && !/\b(?:ottoman|pouf)\b/.test(title)) return "stool";
  if (/\bbreakfast table\b/.test(title)) return "dining_table";
  const haystack = ` ${normalizeText(
    [input.title, input.category, input.subcategory].filter(Boolean).join(" "),
  )} `;

  // Typology metadata wins over a product name (e.g. a table named "Chair").
  const subtype = normalizeText(input.subcategory);
  const metadata = normalizeText([input.subcategory, input.category].filter(Boolean).join(" "));
  // A multi-type department list is not a specific typology (e.g. Yoma Console).
  const broadSubtype = /[,/&]|\band\b/.test(subtype);
  for (const text of broadSubtype ? [title, metadata, haystack] : [metadata, haystack]) {
    for (const rule of ROLE_RULES) {
      if (rule.keywords.some((keyword) => new RegExp(`\\b${keyword.trim()}s?\\b`).test(text))) {
      return rule.role;
      }
    }
  }

  const category = normalizeText(input.category);
  if (category.includes("lighting")) return "pendant";
  if (category.includes("seating")) return "chair";
  if (category.includes("table")) return "table";

  return "unknown";
}

export function isOverheadLighting(input: ProductContextInput): boolean {
  return ["pendant", "chandelier", "ceiling_light"].includes(inferRole(input));
}

function functionalType(input: ProductContextInput): string {
  if (isOverheadLighting(input)) return "overhead_lighting";
  const role = inferRole(input);
  if (["sideboard", "credenza"].includes(role)) return "sideboard";
  if (role !== "unknown" && role !== "table") return role;
  // Preserve specific typologies not yet represented in the role vocabulary.
  return normalizeText(input.subcategory || input.category).replace(/s\b/g, "");
}

export function isFunctionalComplement(board: ProductContextInput[], candidate: ProductContextInput): boolean {
  const type = functionalType(candidate);
  return Boolean(type) && !board.some(item => functionalType(item) === type);
}

function inferRooms(role: string, input: ProductContextInput): string[] {
  const haystack = normalizeText([input.title, input.category, input.subcategory].filter(Boolean).join(" "));

  if (haystack.includes("outdoor")) return ["outdoor"];

  const explicitRooms: string[] = [];
  if (haystack.includes("dining")) explicitRooms.push("dining");
  if (haystack.includes("living") || haystack.includes("lounge")) explicitRooms.push("living");
  if (haystack.includes("bed") || haystack.includes("bedroom") || haystack.includes("night")) explicitRooms.push("bedroom");
  if (haystack.includes("desk") || haystack.includes("office") || haystack.includes("study")) explicitRooms.push("office");
  if (haystack.includes("entry") || haystack.includes("hall")) explicitRooms.push("entry");

  return unique([...(ROLE_ROOMS[role] || ROLE_ROOMS.unknown), ...explicitRooms]);
}

function toInsight(input: ProductContextInput): ProductInsight {
  const role = inferRole(input);
  return {
    ...input,
    category: input.category || "",
    subcategory: input.subcategory || "",
    materials: input.materials || "",
    dimensions: input.dimensions || "",
    tags: input.tags || [],
    role,
    roomTags: inferRooms(role, input),
    materialTokens: extractMaterialTokens(input),
    normalizedBrand: normalizeText(input.brand),
  };
}

function roleWeight(a: string, b: string): number {
  // Overhead-led grounding priorities must not reverse into furniture-led lighting priorities.
  if (["pendant", "chandelier", "ceiling_light"].includes(a)) return PAIRING_WEIGHTS[a]?.[b] || 0;
  if (["pendant", "chandelier", "ceiling_light"].includes(b)) return PAIRING_WEIGHTS[a]?.[b] || 0;
  return Math.max(PAIRING_WEIGHTS[a]?.[b] || 0, PAIRING_WEIGHTS[b]?.[a] || 0);
}

function describePair(anchor: ProductInsight, candidate: ProductInsight): string {
  if (anchor.role === "dining_table" && candidate.role === "dining_chair") return "dining seating";
  if (anchor.role === "dining_table" && ["pendant", "chandelier"].includes(candidate.role)) return "over-table lighting";
  if (anchor.role === "dining_table" && ["sideboard", "credenza"].includes(candidate.role)) return "dining storage";
  if (anchor.role === "dining_table" && candidate.role === "rug") return "a zone-defining layer";
  if (["lounge_chair", "armchair", "chair"].includes(anchor.role) && candidate.role === "side_table") return "a companion surface";
  if (["lounge_chair", "armchair", "chair"].includes(anchor.role) && ["floor_lamp", "table_lamp"].includes(candidate.role)) return "layered lighting";
  if (["lounge_chair", "armchair", "chair"].includes(anchor.role) && candidate.role === "rug") return "softening the seating area";
  if (anchor.role === "side_table" && candidate.role === "table_lamp") return "accent lighting";
  if (anchor.role === "bed" && candidate.role === "bedside_table") return "bedside support";
  if (anchor.role === "bed" && candidate.role === "table_lamp") return "bedside lighting";
  if (anchor.role === "desk" && candidate.role === "desk_chair") return "work seating";

  return ROLE_LABELS[candidate.role] || "a compatible piece";
}

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function buildFitNote(candidate: ProductInsight, anchor: ProductInsight | null, sharedMaterials: string[], matchedRooms: string[]): string {
  if (anchor) {
    const specificMaterials = sharedMaterials.filter(token => !["wood", "stone", "metal", "fabric", "textile"].includes(token));
    const shared = specificMaterials.length ? specificMaterials : sharedMaterials;
    const material = shared.length > 0
      ? `${candidate.title}'s ${formatList(shared.slice(0, 2))} echoes the recorded materials of ${anchor.title}.`
      : materialFamilyOverlap(anchor.materialTokens, candidate.materialTokens).length > 0
        ? `Related ${formatList(materialFamilyOverlap(anchor.materialTokens, candidate.materialTokens))} finishes connect the two pieces without repeating the same material.`
        : "";
    const trait = sharedDesignTraits(anchor, candidate)[0];
    const aesthetic = trait ? `The recorded ${trait} character connects the two pieces.` : "";
    const roles: Record<string, string> = {
      side_table: `${candidate.title} introduces a companion surface beside ${anchor.title}, without adding another seating piece.`,
      coffee_table: `Gives ${anchor.title} a central surface and a lower horizontal register within the seating group.`,
      floor_lamp: `Adds a separate lighting layer beside ${anchor.title}, balancing the furniture with a vertical accent.`,
      table_lamp: `Brings a localized lighting layer to the setting around ${anchor.title}.`,
      rug: `Defines the furniture zone around ${anchor.title} with a continuous textile layer.`,
      dining_chair: `Introduces seating around ${anchor.title}, establishing a distinct rhythm at the dining table.`,
      sideboard: `Adds a storage register alongside ${anchor.title}, separating service from the dining surface.`,
      credenza: `Adds a separate storage register to the setting around ${anchor.title}.`,
      ottoman: `Introduces a footrest beside ${anchor.title}, extending the seating group without another chair back.`,
      pendant: `Introduces overhead illumination to the furniture setting anchored by ${anchor.title}.`,
      chandelier: `Adds an overhead focal point above the furniture setting anchored by ${anchor.title}.`,
    };
    const ownMaterials = candidate.materialTokens.filter(token => !["wood", "metal", "stone", "fabric", "textile"].includes(token)).slice(0, 2);
    const counterpoint = ownMaterials.length
      ? `Its recorded ${formatList(ownMaterials)} adds a distinct material accent beside ${anchor.title}.`
      : "";
    const detail = candidate.description?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0];
    if (isOverheadLighting(anchor)) {
      const overheadRoles: Record<string, string> = {
        dining_table: `Grounds the space beneath ${anchor.title} with a dining surface, balancing the overhead fixture with a horizontal furniture plane.`,
        dining_chair: `Establishes a dining seating rhythm beneath ${anchor.title}, bringing the overhead composition down to the furniture level.`,
        sideboard: `Balances ${anchor.title}'s overhead presence with a storage element along the room's perimeter.`,
        credenza: `Balances ${anchor.title}'s overhead presence with a storage element along the room's perimeter.`,
        console: `Gives the room beneath ${anchor.title} a console surface at its perimeter, counterbalancing the overhead focal point.`,
      };
      const overheadMaterial = ownMaterials.length
        ? `Its recorded ${formatList(ownMaterials)} introduces a material counterpoint below the fixture.` : "";
      return `${overheadRoles[candidate.role] || `Adds ${ROLE_LABELS[candidate.role] || "a furniture element"} to the room beneath ${anchor.title}, balancing its overhead presence at room level.`} ${material || aesthetic || overheadMaterial}`.trim();
    }
    return `${roles[candidate.role] || `Extends the composition around ${anchor.title} with ${describePair(anchor, candidate)}.`} ${material || aesthetic || counterpoint || (detail && detail.length <= 180 ? detail : "")}`.trim();
  }

  if (matchedRooms.length > 0) {
    return `Supports the same ${ROOM_LABELS[matchedRooms[0]] || "room"} scheme`;
  }

  if (sharedMaterials.length > 0) {
    return `Echoes the board's ${formatList(sharedMaterials.slice(0, 2))} palette`;
  }

  return "Fits the room composition better than lower-ranked options";
}

const PRIMARY_ROLES = new Set(["sofa", "armchair", "lounge_chair", "dining_table", "bed", "desk", "dining_chair", "chair"]);

export function selectFurnitureAnchors<T extends ProductContextInput>(items: T[]): T[] {
  const primary = items.filter(item => PRIMARY_ROLES.has(inferRole(item)));
  if (primary.length) return primary;
  return items.filter(item => !["pendant", "chandelier", "ceiling_light", "wall_light", "floor_lamp", "table_lamp", "rug", "mirror", "unknown"].includes(inferRole(item)));
}

/** Lighting-only boards have architectural references, never floor-furniture anchors. */
export function selectPairingReferences<T extends ProductContextInput>(items: T[]): T[] {
  const pinned = items.filter(item => item.pinnedAnchor);
  if (pinned.length) return pinned;
  const furniture = selectFurnitureAnchors(items);
  return furniture.length ? furniture : items;
}

const MATERIAL_FAMILIES: Record<string, string[]> = {
  wood: ["wood", "timber", "oak", "walnut", "ash", "rattan", "cane"],
  stone: ["stone", "marble", "travertine", "limestone", "granite", "alabaster"],
  metal: ["metal", "brass", "bronze", "copper", "steel"],
  textile: ["fabric", "textile", "linen", "wool", "velvet", "boucle"],
};

function materialFamilyOverlap(a: string[], b: string[]): string[] {
  return Object.entries(MATERIAL_FAMILIES).filter(([, tokens]) => tokens.some(token => a.includes(token)) && tokens.some(token => b.includes(token))).map(([family]) => family);
}

function sharedDesignTraits(a: ProductContextInput, b: ProductContextInput): string[] {
  const text = (item: ProductContextInput) => normalizeText([item.materials, item.description, ...(item.tags || [])].join(" "));
  return ["art deco", "mid-century", "modernist", "contemporary", "sculptural", "black", "white", "ivory", "warm", "patinated", "polished"].filter(trait => text(a).includes(trait) && text(b).includes(trait));
}

function buildBoardProfile(boardItems: ProductInsight[]) {
  const roomCounts: Record<string, number> = {};
  const desiredRoles: Record<string, number> = {};
  const presentRoles: Record<string, number> = {};
  const materialTokens = new Set<string>();

  const anchors = selectPairingReferences(boardItems);
  for (const item of boardItems) {
    presentRoles[item.role] = (presentRoles[item.role] || 0) + 1;

    if (!anchors.includes(item)) continue;

    for (const room of item.roomTags) {
      roomCounts[room] = (roomCounts[room] || 0) + 1;
    }

    for (const token of item.materialTokens) {
      materialTokens.add(token);
    }

    const pairings = PAIRING_WEIGHTS[item.role] || {};
    for (const [role, weight] of Object.entries(pairings)) {
      desiredRoles[role] = (desiredRoles[role] || 0) + weight;
    }
  }

  const dominantRooms = Object.entries(roomCounts)
    .filter(([room]) => room !== "general")
    .sort((a, b) => b[1] - a[1])
    .map(([room]) => room)
    .slice(0, 2);

  return {
    dominantRooms: dominantRooms.length > 0 ? dominantRooms : ["general"],
    desiredRoles,
    presentRoles,
    materialTokens: [...materialTokens],
  };
}

export function summarizeBoardIntent(boardInputs: ProductContextInput[]): BoardIntentSummary {
  const insights = boardInputs.map(toInsight);
  const profile = buildBoardProfile(insights);

  return {
    dominantRooms: profile.dominantRooms,
    presentRoles: unique(insights.map((item) => ROLE_LABELS[item.role] || item.role)),
    desiredRoles: Object.entries(profile.desiredRoles)
      .filter(([role]) => !insights.some(item => functionalType(item) === functionalType({ id: role, title: ROLE_LABELS[role] || role, brand: "" })))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([role]) => ROLE_LABELS[role] || role),
    materialTokens: profile.materialTokens,
  };
}

export function rankCatalogCandidates(boardInputs: ProductContextInput[], catalogInputs: ProductContextInput[]): RankedCatalogCandidate[] {
  const boardItems = boardInputs.map(toInsight);
  const anchors = selectPairingReferences(boardItems);
  const catalog = catalogInputs.filter(candidate => isFunctionalComplement(boardInputs, candidate)).map(toInsight);
  const boardProfile = buildBoardProfile(boardItems);

  return catalog
    .map((candidate) => {
      let bestAnchor: ProductInsight | null = null;
      let bestPairScore = -1000;
      let bestSharedMaterials: string[] = [];
      let bestRoomOverlap: string[] = [];

      for (const anchor of anchors) {
        const pairWeight = roleWeight(anchor.role, candidate.role);
        const roomOverlap = intersect(anchor.roomTags, candidate.roomTags);
        const materialOverlap = intersect(anchor.materialTokens, candidate.materialTokens);

        let pairScore = pairWeight * 4 + roomOverlap.length * 8 + materialOverlap.length * 5
          + materialFamilyOverlap(anchor.materialTokens, candidate.materialTokens).length * 4
          + sharedDesignTraits(anchor, candidate).length * 4;

        if (anchor.role === candidate.role) {
          pairScore -= ["dining_chair", "chair", "armchair", "lounge_chair"].includes(candidate.role) ? 4 : 14;
        }

        if (anchor.role.includes("table") && candidate.role.includes("table") && pairWeight < 6) {
          pairScore -= 12;
        }

        if (anchor.normalizedBrand && anchor.normalizedBrand === candidate.normalizedBrand) {
          pairScore -= 2;
        }

        if (pairScore > bestPairScore) {
          bestPairScore = pairScore;
          bestAnchor = anchor;
          bestSharedMaterials = materialOverlap;
          bestRoomOverlap = roomOverlap;
        }
      }

      const desiredRoleBonus = (boardProfile.desiredRoles[candidate.role] || 0) * 2;
      const dominantRoomOverlap = intersect(boardProfile.dominantRooms, candidate.roomTags).length;
      const boardMaterialOverlap = intersect(boardProfile.materialTokens, candidate.materialTokens).length;
      const presentRoleCount = boardProfile.presentRoles[candidate.role] || 0;

      let score = bestPairScore + desiredRoleBonus + dominantRoomOverlap * 6 + boardMaterialOverlap * 3;

      if (candidate.role === "unknown") score -= 12;
      if (candidate.roomTags.includes("general") && candidate.roomTags.length === 1) score -= 6;
      if (presentRoleCount > 0 && (boardProfile.desiredRoles[candidate.role] || 0) < 8) score -= 10;
      if (bestPairScore < 16 && desiredRoleBonus === 0 && boardMaterialOverlap === 0) score -= 14;

      return {
        ...candidate,
        score,
        fitNote: buildFitNote(candidate, bestAnchor, bestSharedMaterials, bestRoomOverlap),
        anchorTitle: bestAnchor?.title || "",
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function selectCandidateShortlist(ranked: RankedCatalogCandidate[], limit = 60): RankedCatalogCandidate[] {
  const chosen: RankedCatalogCandidate[] = [];
  const roleCounts: Record<string, number> = {};
  const brandCounts: Record<string, number> = {};

  for (const candidate of ranked) {
    if (candidate.score < 8 && chosen.length >= 20) continue;

    const roleCap = candidate.role === "dining_chair"
      ? 6
      : ["armchair", "lounge_chair", "chair"].includes(candidate.role)
        ? 4
        : 3;
    const brandKey = candidate.normalizedBrand || "__unknown__";

    if ((roleCounts[candidate.role] || 0) >= (limit <= 8 ? 2 : roleCap)) continue;
    if ((brandCounts[brandKey] || 0) >= (limit <= 8 ? 2 : 4)) continue;

    chosen.push(candidate);
    roleCounts[candidate.role] = (roleCounts[candidate.role] || 0) + 1;
    brandCounts[brandKey] = (brandCounts[brandKey] || 0) + 1;

    if (chosen.length >= limit) break;
  }

  return chosen.length > 0 ? chosen : ranked.slice(0, limit);
}