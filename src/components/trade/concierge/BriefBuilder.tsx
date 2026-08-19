import React, { useEffect, useRef, useState } from "react";
import { Bookmark, BookmarkPlus, ChevronDown, ChevronRight, ClipboardPaste, Trash2, X } from "lucide-react";
import { BrandPicker } from "@/components/trade/concierge/BrandPicker";
import { updateConciergeSession } from "@/hooks/useConciergeSession";
import brandCategoriesRaw from "@/data/brandCategories.json";

// Typology token → catalogue category. Ordered so more specific tokens
// (e.g. "coffee table", "floor lamp") match before generic ones ("table",
// "lamp"). Add tokens as new archetypes appear in briefs.
const TYPOLOGY_TO_CATEGORY: { re: RegExp; category: keyof typeof brandCategoriesRaw }[] = [
  // Lighting — floor/table/pendant/ceiling/sconce/chandelier/lamp
  { re: /\b(floor\s*lamp|table\s*lamp|pendant|ceiling\s*light|chandelier|sconce|wall\s*light|lantern|lighting|lamps?)\b/i, category: "lighting" as never },
  // Rugs
  { re: /\b(rugs?|carpet|kilim|dhurrie)\b/i, category: "rugs" as never },
  // Tables — dining/coffee/side/console
  { re: /\b(dining\s*table|coffee\s*table|side\s*table|console|tables?|desk)\b/i, category: "tables" as never },
  // Storage
  { re: /\b(cabinet|sideboard|credenza|shelving|bookcase|dresser|chest|armoire|storage)\b/i, category: "storage" as never },
  // Bedroom
  { re: /\b(bed|headboard|nightstand|bedside|bedroom)\b/i, category: "bedroom" as never },
  // Decor
  { re: /\b(vase|sculpture|object|screen|mirror|art|decor)\b/i, category: "decor" as never },
  // Seating — sectional/sofa/accent chair/armchair/lounge/bench/stool/ottoman
  { re: /\b(sectional|sofa|settee|loveseat|accent\s*chair|armchair|lounge\s*chair|dining\s*chair|chairs?|bench|stool|ottoman|pouf|banquette|seating)\b/i, category: "seating" as never },
];

// Anchor brand picks per category — always present when the typology maps
// there. Apparatus is the anchor for lighting so briefs that request
// floor/ceiling lights auto-include it. Keep the list short (2 brands per
// category) so the References field stays legible.
const CATEGORY_ANCHOR_BRANDS: Record<string, string[]> = {
  lighting: ["Apparatus", "Serge Mouille"],
  seating: ["Man of Parts", "De La Espada"],
  tables: ["Collection Particulière", "Alinea"],
  storage: ["De La Espada", "Alexander Lamont"],
  rugs: ["CC-Tapis", "Apparatus"],
  decor: ["Alexander Lamont", "L'Objet"],
  bedroom: ["Pierre Frey", "Bruno Moinard Editions"],
};

function stripBrandQualifier(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

function suggestBrandsFromTypology(typology: string): string[] {
  const hits = new Set<string>();
  for (const { re, category } of TYPOLOGY_TO_CATEGORY) {
    if (re.test(typology)) {
      const anchors = CATEGORY_ANCHOR_BRANDS[category as string] || [];
      for (const b of anchors) hits.add(b);
    }
  }
  return Array.from(hits);
}

function parseReferenceBrands(value: string): string[] {
  if (!value.trim()) return [];
  const normalizedLegacyDefault = value.replace(/\s*\/\s*/g, " / ").trim().toLowerCase();
  if (normalizedLegacyDefault === "man of parts / collection particulière / de la espada / leo sentou") return [];
  // Any placeholder token (contains a bracketed [example] or leading "e.g.")
  // is treated as empty — it must never be parsed into a selected brand chip.
  if (/\[.*\]|^\s*e\.g\./i.test(value)) return [];
  const out: string[] = [];
  let buf = "";
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "/" && depth === 0) {
      const t = stripBrandQualifier(buf);
      if (t) out.push(t);
      buf = "";
    } else {
      buf += ch;
    }
  }
  const t = stripBrandQualifier(buf);
  if (t) out.push(t);
  const seen = new Set<string>();
  return out.filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sanitizeReferences(value: string): string {
  return parseReferenceBrands(value).join(" / ");
}

function mergeReferenceBrands(current: string, suggested: string[]): string {
  const existing = parseReferenceBrands(current);
  const seen = new Set(existing.map((n) => n.toLowerCase()));
  const merged = [...existing];
  for (const name of suggested) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(name);
  }
  return merged.join(" / ");
}


export type BriefValues = {
  block1: {
    projectProfile: string;
    zone: string;
    environment: string;
    timeline: string;
  };
  block2: {
    typology: string;
    maxFootprint: string;
    clearance: string;
    materials: string;
  };
  block3: {
    vibe: string;
    references: string;
    palette: string;
  };
  block4: string;
};

const DEFAULT_VALUES: BriefValues = {
  block1: {
    projectProfile: "[typology, city/area]",
    zone: "[room, ceiling height]",
    environment: "[humidity, sun exposure, glazing]",
    timeline: "Handover in [N] weeks (max lead time [N] weeks).",
  },
  block2: {
    typology: "[e.g. sectional + accent chairs]",
    maxFootprint: "length ≤ [mm], depth ≤ [mm]",
    clearance: "min [mm] perimeter pathway",
    materials: "[performance criteria, exclusions]",
  },
  block3: {
    vibe: "[e.g. Japandi-Luxe, Italian Minimalism]",
    references: "[e.g. Man of Parts / Collection Particulière]",
    palette: "[materials + finishes]",
  },
  block4:
    "Return 3 layout configurations. For every piece, output a strict Architectural Specification Schedule:\nProduct Name · Designer · Exact mm Dimensions · Verified Finish Options · Lead Time · Cloudinary image URL · Supabase CAD/BIM URL.\nNo conversational intro.",
};

// Header labels used in the formatted brief sent to Felix. Do NOT change the
// "Block N —" prefixes; parseBrief() relies on them.
const BLOCK_LABELS: Record<string, string> = {
  block1: "Block 1 — Spatial & Project Context",
  block2: "Block 2 — Hard Technical Parameters",
  block3: "Block 3 — Aesthetic & Visual DNA",
  block4: "Block 4 — Output Execution Protocol",
};

// UI-only labels — the visible section headings in the builder. Kept short so
// the user isn't distracted by "Block 1/2/3" numbering.
const UI_BLOCK_LABELS: Record<string, string> = {
  block1: "Spatial & Project Context",
  block2: "Hard Technical Parameters",
  block3: "Aesthetic & Visual DNA",
};

const FIELD_LABELS: { key: keyof BriefValues["block1"] | keyof BriefValues["block2"] | keyof BriefValues["block3"]; label: string }[] = [
  { key: "projectProfile", label: "PROJECT PROFILE" },
  { key: "zone", label: "ZONE" },
  { key: "environment", label: "ENVIRONMENT" },
  { key: "timeline", label: "TIMELINE" },
  { key: "typology", label: "TYPOLOGY" },
  { key: "maxFootprint", label: "MAX FOOTPRINT" },
  { key: "clearance", label: "CLEARANCE" },
  { key: "materials", label: "MATERIALS" },
  { key: "vibe", label: "VIBE" },
  { key: "references", label: "REFERENCES" },
  { key: "palette", label: "PALETTE" },
];

function formatBrief(values: BriefValues): string {
  return [
    `${BLOCK_LABELS.block1}\nPROJECT PROFILE: ${values.block1.projectProfile}\nZONE: ${values.block1.zone}\nENVIRONMENT: ${values.block1.environment}\nTIMELINE: ${values.block1.timeline}`,
    `${BLOCK_LABELS.block2}\nTYPOLOGY: ${values.block2.typology}\nMAX FOOTPRINT: ${values.block2.maxFootprint}\nCLEARANCE: ${values.block2.clearance}\nMATERIALS: ${values.block2.materials}`,
    `${BLOCK_LABELS.block3}\nVIBE: ${values.block3.vibe}\nREFERENCES: ${values.block3.references}\nPALETTE: ${values.block3.palette}`,
    `${BLOCK_LABELS.block4}\n${values.block4}`,
  ].join("\n\n");
}

// Alternative section headers we recognize when a brief isn't using the
// canonical "Block N —" prefixes (e.g. templates written with markdown ###
// headings like "### PROJECT CONTEXT").
const ALT_BLOCK_HEADERS: { pattern: RegExp; block: "block1" | "block2" | "block3" | "block4" }[] = [
  { pattern: /project\s*context|spatial\s*&?\s*project/i, block: "block1" },
  { pattern: /hard\s*(technical\s*)?parameters|sql\s*constraints/i, block: "block2" },
  { pattern: /aesthetic\s*(dna|&?\s*visual)|vector\s*match/i, block: "block3" },
  { pattern: /execution\s*(directive|protocol)|output\s*execution/i, block: "block4" },
];

// Field label aliases → canonical field key per block. Order matters: the
// first matching alias wins, so put more specific labels first.
const FIELD_ALIASES: Record<"block1" | "block2" | "block3", Record<string, string[]>> = {
  block1: {
    projectProfile: ["PROJECT PROFILE", "PROJECT TYPE"],
    zone: ["ZONE"],
    environment: ["ENVIRONMENT"],
    timeline: ["TIMELINE", "LOGISTICS DEADLINE", "DEADLINE", "LEAD TIME"],
  },
  block2: {
    typology: ["TYPOLOGY"],
    maxFootprint: ["MAX FOOTPRINT", "TABLE DIMENSIONS", "DIMENSIONS", "FOOTPRINT"],
    clearance: ["CLEARANCE", "CHAIR CLEARANCE"],
    materials: ["MATERIALS", "MATERIAL PERFORMANCE", "MATERIAL"],
  },
  block3: {
    vibe: ["VIBE", "DESIGN PROFILE", "STYLE"],
    references: ["REFERENCES", "DESIGN BRAND/STYLES", "DESIGN BRANDS", "BRAND REFERENCES"],
    palette: ["PALETTE", "PALETTE & TEXTURES", "PALETTE AND TEXTURES"],
  },
};

function classifyHeader(text: string): "block1" | "block2" | "block3" | "block4" | null {
  const m = text.match(/^Block\s+(\d)\b/i);
  if (m) {
    const n = m[1];
    if (n === "1") return "block1";
    if (n === "2") return "block2";
    if (n === "3") return "block3";
    if (n === "4") return "block4";
  }
  for (const { pattern, block } of ALT_BLOCK_HEADERS) {
    if (pattern.test(text)) return block;
  }
  return null;
}

function parseBrief(text: string): { values: BriefValues; prefix: string; suffix: string } {
  // Match either canonical "Block N — ..." headers OR markdown-style
  // "### <SECTION NAME>" / "## <SECTION NAME>" headers so pasted templates
  // that use "### PROJECT CONTEXT" still auto-fill the builder.
  const headerRegex = /^(?:Block\s+\d+\s*—\s*.*?|#{1,6}\s+.+?)\s*$/gim;
  const rawHeaders: { text: string; index: number; block: "block1" | "block2" | "block3" | "block4" }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRegex.exec(text)) !== null) {
    const block = classifyHeader(m[0]);
    if (block) rawHeaders.push({ text: m[0], index: m.index, block });
  }

  if (rawHeaders.length === 0 || rawHeaders[0].block !== "block1") {
    return { values: DEFAULT_VALUES, prefix: text, suffix: "" };
  }

  const prefix = text.slice(0, rawHeaders[0].index).trim();
  const blockBodies: Record<string, string> = {};
  for (let i = 0; i < rawHeaders.length; i++) {
    const start = rawHeaders[i].index + rawHeaders[i].text.length;
    const end = i + 1 < rawHeaders.length ? rawHeaders[i + 1].index : text.length;
    blockBodies[rawHeaders[i].text] = text.slice(start, end).trim();
  }

  const values: BriefValues = JSON.parse(JSON.stringify(DEFAULT_VALUES));

  for (const header of rawHeaders) {
    const body = blockBodies[header.text] || "";
    if (header.block === "block1") {
      for (const [key, aliases] of Object.entries(FIELD_ALIASES.block1)) {
        const v = extractFirstField(body, aliases);
        if (v) (values.block1 as Record<string, string>)[key] = v;
      }
    } else if (header.block === "block2") {
      for (const [key, aliases] of Object.entries(FIELD_ALIASES.block2)) {
        const v = extractFirstField(body, aliases);
        if (v) (values.block2 as Record<string, string>)[key] = v;
      }
    } else if (header.block === "block3") {
      for (const [key, aliases] of Object.entries(FIELD_ALIASES.block3)) {
        const v = extractFirstField(body, aliases);
        if (v) (values.block3 as Record<string, string>)[key] = v;
      }
      values.block3.references = sanitizeReferences(values.block3.references);
    } else if (header.block === "block4") {
      values.block4 = body || DEFAULT_VALUES.block4;
    }
  }

  const lastHeader = rawHeaders[rawHeaders.length - 1];
  const suffix = text.slice(lastHeader.index + lastHeader.text.length + blockBodies[lastHeader.text].length).trim();

  return { values, prefix, suffix };
}

// Escape a label for use inside a RegExp — labels may contain "&", "/", etc.
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractField(body: string, label: string): string | null {
  // Allow an optional leading bullet ("- ", "* ", "• ") and optional bold
  // markers ("**LABEL**:") so lines like "- ZONE: ..." are recognized.
  const regex = new RegExp(
    `^\\s*(?:[-*•]\\s+)?\\*{0,2}${escapeRe(label)}\\*{0,2}\\s*:\\s*(.*)$`,
    "im"
  );
  const match = body.match(regex);
  if (match && match[1] !== undefined) {
    const value = match[1].trim();
    return value ? value : null;
  }
  return null;
}

function extractFirstField(body: string, labels: string[]): string | null {
  for (const label of labels) {
    const v = extractField(body, label);
    if (v) return v;
  }
  return null;
}

// Free-form prose extractor. Pulls zone (room + ceiling height), max footprint
// (from "5x6m" style room dimensions), and typology (furniture terms mentioned)
// out of ordinary sentences so pastes without "Block N —" or "###" headers
// still fill the builder fields, not just the free-form notes area.
const PROSE_FURNITURE_TOKEN_RE = /\b(sectional\s+sofas?|sectionals?|sofas?|settees?|loveseats?|accent\s+chairs?|arm\s*chairs?|lounge\s+chairs?|dining\s+chairs?|chairs?|side\s+tables?|coffee\s+tables?|dining\s+tables?|consoles?|desks?|tables?|benches|bench|stools?|ottomans?|poufs?|floor\s+lamps?|table\s+lamps?|pendants?|chandeliers?|sconces?|wall\s+lights?|lamps?|rugs?|mirrors?|cabinets?|sideboards?|credenzas?|shelving|bookcases?|dressers?|chests?|armoires?|beds?|headboards?|nightstands?|bedsides?)\b/gi;

const PROSE_DEFERRAL_RE = /\b(at a later (?:date|stage|time)|later on|later date|another time|down the (?:road|line)|for (?:a )?later|not (?:now|yet|for now)|(?:for|in) a later phase|excluding|except(?:\s+for)?|leaving out|skip(?:ping)?|omit(?:ting)?|will (?:select|pick|choose|source|find|decide|specify)\b[^.?!\n]*\b(later|another time|down the (?:road|line))|(?:pick|choose|select|source|specify|decide)\s+(?:on\s+)?(?:the\s+)?[^.?!\n]*\b(later|another time|down the (?:road|line)))\b/i;

function splitProseClauses(text: string): string[] {
  return text.split(/(?<=[.?!])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

function normalizeProseFurnitureToken(token: string): string {
  const s = token.toLowerCase().replace(/\s+/g, " ").trim();
  if (/^sectional(\s+sofa)?s?$/.test(s)) return "sectional sofas";
  if (/^arm\s*chairs?$/.test(s)) return "armchairs";
  if (/^side\s+tables?$/.test(s)) return "side tables";
  if (/^coffee\s+tables?$/.test(s)) return "coffee tables";
  if (/^dining\s+tables?$/.test(s)) return "dining tables";
  if (/^floor\s+lamps?$/.test(s)) return "floor lamps";
  if (/^table\s+lamps?$/.test(s)) return "table lamps";
  if (/^accent\s+chairs?$/.test(s)) return "accent chairs";
  if (/^lounge\s+chairs?$/.test(s)) return "lounge chairs";
  if (/^dining\s+chairs?$/.test(s)) return "dining chairs";
  if (/^wall\s+lights?$/.test(s)) return "wall lights";
  if (s.endsWith("y")) return s.slice(0, -1) + "ies";
  if (/(s|x|z|ch|sh)$/.test(s)) return s;
  if (s.endsWith("s")) return s;
  return s + "s";
}

function collapseProseFurnitureTokens(tokens: string[]): string[] {
  const set = new Set(tokens);
  const drop = (parent: string, ...children: string[]) => {
    if (children.some((c) => set.has(c))) set.delete(parent);
  };
  drop("tables", "side tables", "coffee tables", "dining tables");
  drop("chairs", "armchairs", "accent chairs", "lounge chairs", "dining chairs");
  drop("lamps", "floor lamps", "table lamps");
  drop("sofas", "sectional sofas");
  return Array.from(set);
}

function extractProseFurnitureTypology(text: string): string[] {
  const kept = new Set<string>();
  for (const clause of splitProseClauses(text)) {
    if (PROSE_DEFERRAL_RE.test(clause)) continue;
    const raw = clause.match(PROSE_FURNITURE_TOKEN_RE) || [];
    for (const tok of raw) kept.add(normalizeProseFurnitureToken(tok));
  }
  return collapseProseFurnitureTokens(Array.from(kept));
}

function extractProseFields(text: string): { zone?: string; maxFootprint?: string; typology?: string; vibe?: string } {
  const out: { zone?: string; maxFootprint?: string; typology?: string; vibe?: string } = {};
  const src = text.replace(/\s+/g, " ");

  // Zone: <room> + optional ceiling height.
  const ROOMS = ["living", "dining", "kitchen", "bedroom", "master", "study", "library", "foyer", "entryway", "powder", "guest", "family", "media", "lounge", "office", "home office"];
  const roomRe = new RegExp(`\\b(${ROOMS.join("|")})(?:\\s*room)?\\b`, "i");
  const roomM = src.match(roomRe);
  const ceilRe = /(?:(\d+(?:\.\d+)?)\s*(m|cm|mm|["'])\s*(?:high\s*)?ceiling|ceiling(?:\s*height)?(?:\s*of)?\s*(\d+(?:\.\d+)?)\s*(m|cm|mm|["']))/i;
  const ceilM = src.match(ceilRe);
  if (roomM || ceilM) {
    const parts: string[] = [];
    if (roomM) {
      const r = roomM[1].toLowerCase();
      parts.push(r.charAt(0).toUpperCase() + r.slice(1));
    }
    if (ceilM) {
      const v = ceilM[1] || ceilM[3];
      const u = (ceilM[2] || ceilM[4] || "m").toLowerCase();
      parts.push(`${v}${u} ceiling`);
    }
    out.zone = parts.join(" — ");
  }

  // Max footprint from "AxB m" / "A × B cm" style room dimensions.
  const dimRe = /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(m|cm|mm)?\b/i;
  const dimM = src.match(dimRe);
  if (dimM) {
    const unit = (dimM[3] || "m").toLowerCase();
    const toMm = (n: number) => unit === "mm" ? n : unit === "cm" ? n * 10 : n * 1000;
    const a = toMm(parseFloat(dimM[1]));
    const b = toMm(parseFloat(dimM[2]));
    const max = Math.max(a, b);
    const min = Math.min(a, b);
    out.maxFootprint = `length ≤ ${max}mm, depth ≤ ${min}mm`;
  }

  const vibeM = src.match(/\b(?:in|with)\s+(?:an?\s+)?((?:(?!\b(?:in|with)\b)[a-z-]+\s+){0,6}[a-z-]+)\s+(?:manner|style|vibe|atmosphere|aesthetic)\b/i);
  if (vibeM) out.vibe = vibeM[1].replace(/\s+/g, " ").trim().toLowerCase();

  const found = extractProseFurnitureTypology(text);
  if (found.length) out.typology = found.join(", ");

  return out;
}

type ObjectBlock = "block1" | "block2" | "block3";

function updateBlockField<B extends ObjectBlock>(
  values: BriefValues,
  block: B,
  field: keyof BriefValues[B],
  value: string
): BriefValues {
  const target = values[block] as Record<string, string>;
  return {
    ...values,
    [block]: {
      ...target,
      [field]: value,
    },
  };
}

const DRAFT_STORAGE_KEY = "concierge:briefBuilder:draft";

type BriefDraft = {
  values: BriefValues;
  prefix: string;
  suffix: string;
};

function loadDraft(): BriefDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BriefDraft>;
    if (!parsed || typeof parsed !== "object" || !parsed.values) return null;
    const v = parsed.values as Partial<BriefValues>;
    const merged: BriefValues = {
      block1: { ...DEFAULT_VALUES.block1, ...(v.block1 || {}) },
      block2: { ...DEFAULT_VALUES.block2, ...(v.block2 || {}) },
      block3: { ...DEFAULT_VALUES.block3, ...(v.block3 || {}) },
      block4: typeof v.block4 === "string" ? v.block4 : DEFAULT_VALUES.block4,
    };
    merged.block3.references = sanitizeReferences(merged.block3.references);
    const hasRealDraft =
      JSON.stringify(merged) !== JSON.stringify(DEFAULT_VALUES) ||
      !!(typeof parsed.prefix === "string" && parsed.prefix.trim()) ||
      !!(typeof parsed.suffix === "string" && parsed.suffix.trim());
    if (!hasRealDraft) return null;
    return {
      values: merged,
      prefix: typeof parsed.prefix === "string" ? parsed.prefix : "",
      suffix: typeof parsed.suffix === "string" ? parsed.suffix : "",
    };
  } catch {
    return null;
  }
}

function saveDraft(draft: BriefDraft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // ignore quota / serialization errors
  }
}

const PRESETS_STORAGE_KEY = "concierge:briefBuilder:presets";

type BriefPreset = {
  id: string;
  name: string;
  values: BriefValues;
  prefix: string;
  suffix: string;
  savedAt: number;
};

function loadPresets(): BriefPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p) => p && typeof p.id === "string" && typeof p.name === "string" && p.values,
    ) as BriefPreset[];
  } catch {
    return [];
  }
}

function savePresets(list: BriefPreset[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function summarizePreset(p: BriefPreset): string {
  const parts = [
    p.values.block1?.zone,
    p.values.block2?.typology,
    p.values.block3?.vibe,
  ]
    .map((s) => (s && !s.trim().startsWith("[") ? s.trim() : ""))
    .filter(Boolean);
  return parts.join(" · ");
}




const EXPANDED_STORAGE_PREFIX = "concierge:briefBuilder:expanded";
// Legacy global key — read once as fallback so existing users keep their layout
// the first time they open the builder after this change.
const LEGACY_EXPANDED_STORAGE_KEY = "concierge:briefBuilder:expanded";

type ExpandedSections = Record<ObjectBlock, boolean>;

const DEFAULT_EXPANDED: ExpandedSections = {
  block1: true,
  block2: true,
  block3: true,
};

// Scope the expanded/collapsed layout per active trade project so switching
// projects restores that project's preferred section layout. Falls back to a
// shared "global" bucket when no project is active.
function getProjectScope(): string {
  if (typeof window === "undefined") return "global";
  try {
    const id = window.sessionStorage.getItem("trade:lastProjectFilter");
    return id && id.trim() ? id : "global";
  } catch {
    return "global";
  }
}

function expandedStorageKey(scope: string): string {
  return `${EXPANDED_STORAGE_PREFIX}:${scope}`;
}

function coerceExpanded(parsed: unknown): ExpandedSections | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  return {
    block1: !!p.block1,
    block2: !!p.block2,
    block3: !!p.block3,
  };
}

function loadExpanded(scope: string): ExpandedSections {
  if (typeof window === "undefined") return DEFAULT_EXPANDED;
  try {
    const raw = window.localStorage.getItem(expandedStorageKey(scope));
    if (raw) {
      const parsed = coerceExpanded(JSON.parse(raw));
      if (parsed) return parsed;
    }
    // First open in this scope: seed from legacy global key if present.
    const legacy = window.localStorage.getItem(LEGACY_EXPANDED_STORAGE_KEY);
    if (legacy) {
      const parsed = coerceExpanded(JSON.parse(legacy));
      if (parsed) return parsed;
    }
    return DEFAULT_EXPANDED;
  } catch {
    return DEFAULT_EXPANDED;
  }
}

function saveExpanded(scope: string, state: ExpandedSections) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(expandedStorageKey(scope), JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}
function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-lg border border-border bg-background px-2.5 py-1.5 font-body text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </label>
  );
}


export function BriefBuilder({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (next: string) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<BriefValues>(DEFAULT_VALUES);
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const lastEmitted = useRef<string>("");
  const restoredRef = useRef(false);
  const scopeRef = useRef<string>(getProjectScope());
  const [expanded, setExpanded] = useState<ExpandedSections>(() => loadExpanded(scopeRef.current));

  // Re-read the scope + its saved layout whenever the active project changes
  // while the builder is mounted (e.g. user switches project filter).
  useEffect(() => {
    const sync = () => {
      const next = getProjectScope();
      if (next === scopeRef.current) return;
      scopeRef.current = next;
      setExpanded(loadExpanded(next));
    };
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  // On mount: if the composer already contains a recognizable brief (e.g. the
  // user pasted a template before opening the builder), parse THAT and skip
  // draft restore — otherwise the saved draft would wipe the paste. Only fall
  // back to the saved draft when the composer has nothing parseable.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const parsedFromValue = value ? parseBrief(value) : null;
    const hasParsedContent =
      !!parsedFromValue &&
      JSON.stringify(parsedFromValue.values) !== JSON.stringify(DEFAULT_VALUES);

    if (hasParsedContent && parsedFromValue) {
      setValues(parsedFromValue.values);
      setPrefix(parsedFromValue.prefix);
      setSuffix(parsedFromValue.suffix);
      const formatted = formatBrief(parsedFromValue.values);
      const parts = [parsedFromValue.prefix, formatted, parsedFromValue.suffix].filter(Boolean);
      const nextText = parts.join("\n\n");
      lastEmitted.current = nextText;
      saveDraft({
        values: parsedFromValue.values,
        prefix: parsedFromValue.prefix,
        suffix: parsedFromValue.suffix,
      });
      onChange(nextText);
      return;
    }

    const draft = loadDraft();
    if (!draft) return;
    setValues(draft.values);
    setPrefix(draft.prefix);
    setSuffix(draft.suffix);
    const formatted = formatBrief(draft.values);
    const parts = [draft.prefix, formatted, draft.suffix].filter(Boolean);
    const nextText = parts.join("\n\n");
    lastEmitted.current = nextText;
    onChange(nextText);
  }, [onChange, value]);

  useEffect(() => {
    if (!restoredRef.current) return;
    const formatted = formatBrief(values);
    const current = prefix + (prefix ? "\n\n" : "") + formatted + (suffix ? "\n\n" : "") + suffix;
    if (value === current || value === lastEmitted.current) return;

    const parsed = parseBrief(value);
    setValues(parsed.values);
    setPrefix(parsed.prefix);
    setSuffix(parsed.suffix);
  }, [value]);

  const emit = (nextValues: BriefValues, nextPrefix: string, nextSuffix: string) => {
    const formatted = formatBrief(nextValues);
    const parts = [nextPrefix, formatted, nextSuffix].filter(Boolean);
    const nextText = parts.join("\n\n");
    lastEmitted.current = nextText;
    saveDraft({ values: nextValues, prefix: nextPrefix, suffix: nextSuffix });
    // Mirror the composed brief into the cross-surface concierge session so
    // the Tearsheet Builder and Quote flow can carry the brief forward.
    updateConciergeSession({ briefText: nextText });
    onChange(nextText);
  };

  const setBlockField = <B extends ObjectBlock>(
    block: B,
    field: keyof BriefValues[B],
    nextValue: string
  ) => {
    let nextValues = updateBlockField(values, block, field, nextValue);
    // Auto-suggest References from Typology — the moment the user types a
    // real Typology, map its tokens to in-catalogue brands and MERGE them
    // into References. This preserves manually chosen brands while ensuring
    // lighting requests automatically include Apparatus.
    if (block === "block2" && field === "typology") {
      const typText = String(nextValue || "").trim();
      const normalizedTemplate = DEFAULT_VALUES.block2.typology.replace(/[\[\]]/g, "").trim().toLowerCase();
      const normalizedTypology = typText.replace(/[\[\]]/g, "").trim().toLowerCase();
      const isPlaceholder = !normalizedTypology || normalizedTypology === normalizedTemplate;
      // Only auto-seed References when the user hasn't picked any brand yet.
      // Once they select even one brand, we respect their curation and never
      // silently merge anchor brands on subsequent typology edits.
      const currentRefs = parseReferenceBrands(nextValues.block3.references);
      const refsIsEmpty = currentRefs.length === 0;
      if (!isPlaceholder && refsIsEmpty) {
        const suggested = suggestBrandsFromTypology(typText);
        if (suggested.length) {
          const nextReferences = mergeReferenceBrands("", suggested);
          nextValues = {
            ...nextValues,
            block3: { ...nextValues.block3, references: nextReferences },
          };
        }
      }
    }
    setValues(nextValues);
    emit(nextValues, prefix, suffix);
  };

  const setBlock4 = (next: string) => {
    const nextValues = { ...values, block4: next };
    setValues(nextValues);
    emit(nextValues, prefix, suffix);
  };

  const toggleSection = (block: ObjectBlock) => {
    const next = { ...expanded, [block]: !expanded[block] };
    setExpanded(next);
    saveExpanded(scopeRef.current, next);
  };

  // Merge a pasted brief into the current builder state without wiping
  // fields the user already filled in. Only fields the paste actually
  // supplied (i.e. differ from DEFAULT_VALUES) overwrite the current values.
  const [pasteStatus, setPasteStatus] = useState<null | "ok" | "notes" | "empty" | "denied">(null);
  const [pasteFallbackOpen, setPasteFallbackOpen] = useState(false);
  const [pasteFallbackText, setPasteFallbackText] = useState("");
  const [presets, setPresets] = useState<BriefPreset[]>(() => loadPresets());
  const [presetsMenuOpen, setPresetsMenuOpen] = useState(false);
  const [presetStatus, setPresetStatus] = useState<null | "saved" | "loaded" | "exists" | "empty">(null);

  const flashPresetStatus = (s: "saved" | "loaded" | "exists" | "empty") => {
    setPresetStatus(s);
    setTimeout(() => setPresetStatus(null), 2000);
  };

  const handleSavePreset = () => {
    const isEmpty = JSON.stringify(values) === JSON.stringify(DEFAULT_VALUES) && !prefix.trim() && !suffix.trim();
    if (isEmpty) {
      flashPresetStatus("empty");
      return;
    }
    const defaultName = summarizePreset({
      id: "", name: "", values, prefix, suffix, savedAt: 0,
    }) || "Untitled preset";
    const name = window.prompt("Name this brief preset", defaultName);
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    const existing = presets.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
    if (existing && !window.confirm(`A preset named "${trimmed}" exists. Overwrite?`)) return;
    const next: BriefPreset = {
      id: existing?.id || `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      values: JSON.parse(JSON.stringify(values)),
      prefix,
      suffix,
      savedAt: Date.now(),
    };
    const list = existing
      ? presets.map((p) => (p.id === existing.id ? next : p))
      : [next, ...presets];
    setPresets(list);
    savePresets(list);
    flashPresetStatus("saved");
  };

  const handleLoadPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    const nextValues: BriefValues = {
      block1: { ...DEFAULT_VALUES.block1, ...(p.values.block1 || {}) },
      block2: { ...DEFAULT_VALUES.block2, ...(p.values.block2 || {}) },
      block3: { ...DEFAULT_VALUES.block3, ...(p.values.block3 || {}) },
      block4: typeof p.values.block4 === "string" ? p.values.block4 : DEFAULT_VALUES.block4,
    };
    setValues(nextValues);
    setPrefix(p.prefix || "");
    setSuffix(p.suffix || "");
    emit(nextValues, p.prefix || "", p.suffix || "");
    setPresetsMenuOpen(false);
    flashPresetStatus("loaded");
  };

  const handleDeletePreset = (id: string) => {
    if (!window.confirm("Delete this preset?")) return;
    const list = presets.filter((p) => p.id !== id);
    setPresets(list);
    savePresets(list);
  };


  const applyPastedText = (text: string): "ok" | "notes" | "empty" => {
    if (!text || !text.trim()) return "empty";
    const parsed = parseBrief(text);
    const merged: BriefValues = {
      block1: { ...values.block1 },
      block2: { ...values.block2 },
      block3: { ...values.block3 },
      block4: values.block4,
    };
    let filled = 0;
    (Object.keys(parsed.values.block1) as (keyof BriefValues["block1"])[]).forEach((k) => {
      if (parsed.values.block1[k] !== DEFAULT_VALUES.block1[k]) {
        merged.block1[k] = parsed.values.block1[k];
        filled++;
      }
    });
    (Object.keys(parsed.values.block2) as (keyof BriefValues["block2"])[]).forEach((k) => {
      if (parsed.values.block2[k] !== DEFAULT_VALUES.block2[k]) {
        merged.block2[k] = parsed.values.block2[k];
        filled++;
      }
    });
    (Object.keys(parsed.values.block3) as (keyof BriefValues["block3"])[]).forEach((k) => {
      if (parsed.values.block3[k] !== DEFAULT_VALUES.block3[k]) {
        merged.block3[k] = parsed.values.block3[k];
        filled++;
      }
    });
    if (parsed.values.block4 !== DEFAULT_VALUES.block4) {
      merged.block4 = parsed.values.block4;
      filled++;
    }

    // Free-form prose extraction — pulls zone/max footprint/typology out of
    // sentences like "The Living room is 5x6m with a 4m high ceiling.
    // Sectional sofas, accent chairs…" so pastes without block headers still
    // populate the builder fields (not just the free-form notes area).
    const prose = extractProseFields(text);
    if (prose.zone && merged.block1.zone !== prose.zone) {
      merged.block1.zone = prose.zone;
      filled++;
    }
    if (prose.maxFootprint && merged.block2.maxFootprint !== prose.maxFootprint) {
      merged.block2.maxFootprint = prose.maxFootprint;
      filled++;
    }
    // Typology from prose ALWAYS overrides — a fresh paste is the user's most
    // recent intent and should replace any earlier auto-prefill.
    if (prose.typology) {
      if (merged.block2.typology !== prose.typology) filled++;
      merged.block2.typology = prose.typology;
    }
    if (prose.vibe && merged.block3.vibe !== prose.vibe) {
      merged.block3.vibe = prose.vibe;
      filled++;
    }

    // When the paste is free-form prose (no recognisable block headers),
    // parseBrief returns prefix=<the whole text>. Merge it with any existing
    // prefix rather than replacing so a previous freeform note isn't wiped.
    const pastedPrefix = parsed.prefix?.trim() || "";
    const pastedSuffix = parsed.suffix?.trim() || "";
    const nextPrefix = pastedPrefix
      ? (prefix && !prefix.includes(pastedPrefix) ? `${prefix}\n\n${pastedPrefix}` : pastedPrefix)
      : prefix;
    const nextSuffix = pastedSuffix || suffix;
    setValues(merged);
    setPrefix(nextPrefix);
    setSuffix(nextSuffix);
    emit(merged, nextPrefix, nextSuffix);
    if (filled > 0) return "ok";
    // No structured fields matched, but we did capture the prose as notes.
    if (pastedPrefix || pastedSuffix) return "notes";
    return "empty";
  };

  const handlePasteBrief = async () => {
    // Inside the Lovable preview iframe, navigator.clipboard.readText() is
    // blocked by permissions policy — fall back to a manual paste box.
    const canReadClipboard =
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.readText === "function";
    if (!canReadClipboard) {
      setPasteFallbackText("");
      setPasteFallbackOpen(true);
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      const status = applyPastedText(text);
      setPasteStatus(status);
      setTimeout(() => setPasteStatus(null), 2500);
    } catch {
      // Permission denied (typical in embedded/preview iframes) → open fallback.
      setPasteFallbackText("");
      setPasteFallbackOpen(true);
    }
  };

  const handleFallbackApply = () => {
    const status = applyPastedText(pasteFallbackText);
    if (status === "empty") {
      // Keep the dialog open so the user doesn't lose what they typed.
      setPasteStatus("empty");
      setTimeout(() => setPasteStatus(null), 2500);
      return;
    }
    setPasteFallbackOpen(false);
    setPasteFallbackText("");
    setPasteStatus(status);
    setTimeout(() => setPasteStatus(null), 2500);
  };





  const SectionHeader = ({
    title,
    open,
    onToggle,
  }: {
    title: string;
    open: boolean;
    onToggle: () => void;
  }) => (
    <button
      type="button"
      onClick={onToggle}
      className="mb-2 flex w-full items-center justify-between font-heading text-[12px] font-semibold text-accent"
      aria-expanded={open}
      aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
    >
      <span>{title}</span>
      {open ? (
        <ChevronDown className="h-3.5 w-3.5" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5" />
      )}
    </button>
  );


  return (
    <div className="mb-2 rounded-xl border border-accent/40 bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          Brief Builder
        </span>
        <div className="flex items-center gap-1.5">
          {pasteStatus === "ok" && (
            <span className="font-body text-[10px] uppercase tracking-[0.12em] text-accent">
              Filled from clipboard
            </span>
          )}
          {pasteStatus === "notes" && (
            <span className="font-body text-[10px] uppercase tracking-[0.12em] text-accent">
              Added as free-form notes
            </span>
          )}
          {pasteStatus === "empty" && (
            <span className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Nothing to apply
            </span>
          )}
          {pasteStatus === "denied" && (
            <span className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Clipboard blocked
            </span>
          )}
          {presetStatus === "saved" && (
            <span className="font-body text-[10px] uppercase tracking-[0.12em] text-accent">Preset saved</span>
          )}
          {presetStatus === "loaded" && (
            <span className="font-body text-[10px] uppercase tracking-[0.12em] text-accent">Preset loaded</span>
          )}
          {presetStatus === "empty" && (
            <span className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Nothing to save</span>
          )}
          <button
            type="button"
            onClick={handleSavePreset}
            className="flex items-center gap-1 rounded-md border border-accent/40 px-2 py-1 font-body text-[11px] text-accent hover:bg-accent/10"
            aria-label="Save current brief as preset"
            title="Save current brief as preset"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            Save preset
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPresetsMenuOpen((o) => !o)}
              className="flex items-center gap-1 rounded-md border border-accent/40 px-2 py-1 font-body text-[11px] text-accent hover:bg-accent/10"
              aria-haspopup="menu"
              aria-expanded={presetsMenuOpen}
              aria-label="Load a saved preset"
              title="Load a saved preset"
            >
              <Bookmark className="h-3.5 w-3.5" />
              Presets{presets.length ? ` (${presets.length})` : ""}
              <ChevronDown className="h-3 w-3" />
            </button>
            {presetsMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-[90]"
                  onClick={() => setPresetsMenuOpen(false)}
                  aria-hidden="true"
                />
                <div
                  role="menu"
                  className="absolute right-0 top-full z-[95] mt-1 w-72 overflow-hidden rounded-md border border-accent/40 bg-background shadow-xl"
                >
                  {presets.length === 0 ? (
                    <div className="px-3 py-2 font-body text-[11px] text-muted-foreground">
                      No presets yet. Fill the brief and click "Save preset".
                    </div>
                  ) : (
                    <ul className="max-h-72 overflow-y-auto py-1">
                      {presets.map((p) => {
                        const summary = summarizePreset(p);
                        return (
                          <li
                            key={p.id}
                            className="group flex items-start gap-2 px-2 py-1.5 hover:bg-accent/10"
                          >
                            <button
                              type="button"
                              onClick={() => handleLoadPreset(p.id)}
                              className="flex-1 text-left"
                              role="menuitem"
                            >
                              <div className="font-body text-[11px] font-medium text-foreground">
                                {p.name}
                              </div>
                              {summary && (
                                <div className="font-body text-[10px] text-muted-foreground line-clamp-2">
                                  {summary}
                                </div>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePreset(p.id)}
                              className="mt-0.5 rounded p-1 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                              aria-label={`Delete preset ${p.name}`}
                              title="Delete preset"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handlePasteBrief}
            className="flex items-center gap-1 rounded-md border border-accent/40 px-2 py-1 font-body text-[11px] text-accent hover:bg-accent/10"
            aria-label="Paste the full architectural brief"
            title="Paste the full architectural brief from clipboard"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            Paste the full architectural brief
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-foreground/10"
            aria-label="Close brief builder"
            title="Close brief builder"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {(prefix || suffix) && (
          <section>
            <div className="mb-2 font-heading text-[12px] font-semibold text-accent">
              Notes
            </div>
            <textarea
              value={[prefix, suffix].filter(Boolean).join("\n\n")}
              onChange={(e) => {
                const next = e.target.value;
                setPrefix(next);
                setSuffix("");
                emit(values, next, "");
              }}
              rows={4}
              className="w-full rounded-md border border-accent/30 bg-background/60 p-2 font-body text-[12px] outline-none focus:border-accent"
              placeholder="Free-form notes captured from your paste…"
            />
          </section>
        )}

        <section>


          <SectionHeader
            title={UI_BLOCK_LABELS.block1}
            open={expanded.block1}
            onToggle={() => toggleSection("block1")}
          />
          <div className={expanded.block1 ? "grid grid-cols-1 sm:grid-cols-2 gap-2.5" : "hidden"}>
            <Field
              label="Project Profile"
              value={values.block1.projectProfile}
              placeholder="[typology, city/area]"
              onChange={(v) => setBlockField("block1", "projectProfile", v)}
            />
            <Field
              label="Zone"
              value={values.block1.zone}
              placeholder="[room, ceiling height]"
              onChange={(v) => setBlockField("block1", "zone", v)}
            />
            <Field
              label="Environment"
              value={values.block1.environment}
              placeholder="[humidity, sun exposure, glazing]"
              onChange={(v) => setBlockField("block1", "environment", v)}
            />
            <Field
              label="Timeline"
              value={values.block1.timeline}
              placeholder="Handover in [N] weeks (max lead time [N] weeks)."
              onChange={(v) => setBlockField("block1", "timeline", v)}
            />
          </div>
        </section>

        <section>
          <SectionHeader
            title={UI_BLOCK_LABELS.block2}
            open={expanded.block2}
            onToggle={() => toggleSection("block2")}
          />
          <div className={expanded.block2 ? "grid grid-cols-1 sm:grid-cols-2 gap-2.5" : "hidden"}>
            <Field
              label="Typology"
              value={values.block2.typology}
              placeholder="[e.g. sectional + accent chairs]"
              onChange={(v) => setBlockField("block2", "typology", v)}
            />
            <Field
              label="Max Footprint"
              value={values.block2.maxFootprint}
              placeholder="length ≤ [mm], depth ≤ [mm]"
              onChange={(v) => setBlockField("block2", "maxFootprint", v)}
            />
            <Field
              label="Clearance"
              value={values.block2.clearance}
              placeholder="min [mm] perimeter pathway"
              onChange={(v) => setBlockField("block2", "clearance", v)}
            />
            <Field
              label="Materials"
              value={values.block2.materials}
              placeholder="[performance criteria, exclusions]"
              onChange={(v) => setBlockField("block2", "materials", v)}
            />
          </div>
        </section>

        <section>
          <SectionHeader
            title={UI_BLOCK_LABELS.block3}
            open={expanded.block3}
            onToggle={() => toggleSection("block3")}
          />
          <div className={expanded.block3 ? "grid grid-cols-1 sm:grid-cols-2 gap-2.5" : "hidden"}>
            <Field
              label="Vibe"
              value={values.block3.vibe}
              placeholder="[e.g. Japandi-Luxe, Italian Minimalism]"
              onChange={(v) => setBlockField("block3", "vibe", v)}
            />
            <BrandPicker
              value={values.block3.references}
              onChange={(v) => setBlockField("block3", "references", v)}
            />
            <Field
              label="Palette"
              value={values.block3.palette}
              placeholder="[materials + finishes]"
              onChange={(v) => setBlockField("block3", "palette", v)}
            />
          </div>
        </section>

        {/* Block 4 (Output Execution Protocol) is intentionally hidden from
            the user — it's a fixed internal directive that ships with every
            brief. The value is still preserved via `values.block4` and emitted
            through formatBrief so the model always receives it. */}

      </div>

      {pasteFallbackOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPasteFallbackOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-accent/40 bg-background p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-heading text-[12px] font-semibold uppercase tracking-[0.12em] text-accent">
                Paste brief
              </span>
              <button
                type="button"
                onClick={() => setPasteFallbackOpen(false)}
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-2 font-body text-[11px] text-muted-foreground">
              Paste the full architectural brief here (⌘/Ctrl+V) and hit Apply. For example:
              <span className="mt-1 block italic text-muted-foreground/80">
                "The living room is 5×6m with a 4m high ceiling. I'm looking to furnish it in an understated luxury manner — sofa, armchairs, coffee table and side table. I'll select the rug and chandelier at a later date."
              </span>
            </p>
            <textarea
              autoFocus
              value={pasteFallbackText}
              onChange={(e) => setPasteFallbackText(e.target.value)}
              rows={10}
              className="w-full rounded-md border border-accent/30 bg-muted/30 p-2 font-body text-[12px] outline-none focus:border-accent"
              placeholder="e.g. The living room is 5×6m with a 4m high ceiling. Understated luxury — sofa, armchairs, coffee table and side table. Rug and chandelier to be selected later."
            />
            {(() => {
              const t = pasteFallbackText.trim();
              if (!t) return null;
              const parsed = parseBrief(t);
              const prose = extractProseFields(t);
              const clean = (s?: string, defaultVal?: string) => {
                if (!s) return "";
                const t = s.trim();
                if (!t) return "";
                if (defaultVal && t === defaultVal.trim()) return "";
                // Treat unfilled placeholders (any bracketed token like [mm], [N]) as empty
                if (/\[[^\]]*\]/.test(t)) return "";
                return t;
              };
              const preview = {
                Zone: clean(parsed.values.block1.zone, DEFAULT_VALUES.block1.zone) || clean(prose.zone) || "—",
                "Max Footprint": clean(parsed.values.block2.maxFootprint, DEFAULT_VALUES.block2.maxFootprint) || clean(prose.maxFootprint) || "—",
                Typology: clean(parsed.values.block2.typology, DEFAULT_VALUES.block2.typology) || clean(prose.typology) || "—",
                Vibe: clean(parsed.values.block3.vibe, DEFAULT_VALUES.block3.vibe) || clean(prose.vibe) || "—",
              };
              const anyDetected = Object.values(preview).some((v) => v && v !== "—");
              return (
                <div className="mt-3 rounded-md border border-accent/30 bg-accent/5 p-2">
                  <div className="mb-1 font-heading text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                    {anyDetected ? "Detected fields (live preview)" : "No fields detected yet"}
                  </div>
                  <dl className="grid grid-cols-[110px_1fr] gap-x-2 gap-y-1 font-body text-[11px]">
                    {Object.entries(preview).map(([k, v]) => (
                      <React.Fragment key={k}>
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className={v === "—" ? "text-muted-foreground/60" : "text-foreground"}>{v}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                </div>
              );
            })()}

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPasteFallbackOpen(false)}
                className="rounded-md px-3 py-1 font-body text-[11px] text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFallbackApply}
                disabled={!pasteFallbackText.trim()}
                className="rounded-md border border-accent/40 bg-accent/10 px-3 py-1 font-body text-[11px] text-accent hover:bg-accent/20 disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
