/** Designer SEO title/description builders shared by the profile page and its server-rendered head. */

export function displayName(name: string): string {
  if (name.includes(" - ")) {
    const [brand, ...rest] = name.split(" - ");
    return `${brand.trim()} — ${rest.join(" - ").trim()}`;
  }
  return name;
}

const DESIGNER_TITLE_OVERRIDES: Record<string, string> = {
  "christophe-delcourt": "Christophe Delcourt — Sculptural Furniture",
  "christophe-delcourt-cc-tapis": "Christophe Delcourt Rugs for cc-tapis Milan",
  "gaelle-lauriot-prevost": "Lauriot-Prévost & Perrault — Ozone Bronze Lighting",
  "gaelle-lauriot-prevost-dominique-perrault-cc-tapis": "Lauriot-Prévost & Perrault Rugs for cc-tapis Milan",
  "ozone": "Ozone Paris — Bronze Furniture & Lighting Editions",
  "ozone-light": "Ozone Light — Sculptural Bronze Lighting, Paris",
  "yabu-pushelberg": "Yabu Pushelberg — Interiors & Furniture Design",
  "yabu-pushelberg-man-of-parts": "Yabu Pushelberg for Man of Parts — Seating & Tables",
  "atelier-fevrier": "Atelier Février — Hand-Knotted Luxury Rugs from Nepal",
  "garnier-linker": "Garnier & Linker Furniture | Maison Affluency",
  "rowin-atelier": "RoWin Atelier Ceramics | Maison Affluency",
};

// Target Google's display bands: title 40-60 chars, description 140-160 chars.

// Deterministic 0..n-1 index from a slug so each designer gets a stable
// template choice without colliding with siblings.
function slugIndex(slug: string | null | undefined, n: number): number {
  if (!n) return 0;
  const s = (slug || "").toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ((h % n) + n) % n;
}

// Extract the leading product-category keyword from a free-text specialty
// ("Lighting, lacquer, parchment" → "lighting"). Falls back to generic
// "collectible design" when nothing usable is present.
function categoryKeyword(specialty?: string | null): string {
  const raw = (specialty || "").toLowerCase().replace(/[^a-z, &/-]+/g, " ").trim();
  if (!raw) return "collectible design";
  const first = raw.split(/[,/]| and /)[0].trim();
  return first || "collectible design";
}

export function designerSeoTitle(
  name: string,
  founder?: string | null,
  isChildDesigner?: boolean,
  slug?: string | null,
  specialty?: string | null,
): string {
  if (slug && DESIGNER_TITLE_OVERRIDES[slug]) return DESIGNER_TITLE_OVERRIDES[slug];
  const cleanName = displayName(name);
  const cleanFounder = founder?.trim();
  const kw = categoryKeyword(specialty);
  const kwTitle = kw.replace(/\b\w/g, (c) => c.toUpperCase());

  // Extract slug tokens not already represented in name/founder so pages like
  // /designers/ozone-light don't collide with /designers/ozone.
  const tokenize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const knownTokens = new Set([
    ...tokenize(cleanName),
    ...(cleanFounder ? tokenize(cleanFounder) : []),
  ]);
  const slugExtras = slug
    ? slug
        .split("-")
        .filter((t) => t && !knownTokens.has(t.toLowerCase()))
        .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
        .join(" ")
    : "";
  const displayedName = slugExtras ? `${cleanName} (${slugExtras})` : cleanName;

  const forCandidates: string[] = [];
  if (
    isChildDesigner &&
    cleanFounder &&
    cleanFounder !== cleanName &&
    !cleanName.toLowerCase().includes(cleanFounder.toLowerCase())
  ) {
    forCandidates.push(
      `${displayedName} for ${cleanFounder} — ${kwTitle} | Maison Affluency`,
      `${displayedName} ${kwTitle} for ${cleanFounder} | Maison Affluency`,
      `${displayedName} for ${cleanFounder} — Designer | Maison Affluency Singapore`,
      `${displayedName} for ${cleanFounder} — Maison Affluency Singapore`,
      `${displayedName} for ${cleanFounder} — Maison Affluency`,
    );
  }
  const soloCandidates: string[] = [
    `${displayedName} — ${kwTitle} | Maison Affluency Singapore`,
    `${displayedName} — Collectible ${kwTitle} | Maison Affluency`,
    `${displayedName} ${kwTitle} & Collectible Design | Maison Affluency`,
    `${displayedName} — Collectible Designer | Maison Affluency Singapore`,
    `${displayedName} — Designer | Maison Affluency Singapore`,
    `${displayedName} — Designer | Maison Affluency`,
    `${displayedName} — Maison Affluency Singapore`,
    `${displayedName} — Maison Affluency`,
  ];

  // Prefer disambiguating "for {founder}" titles when any fit the band; only
  // fall back to solo titles when no for-candidate fits. Within the in-band
  // set, vary the choice per-slug so siblings don't collapse to the same title.
  const pickInBand = (list: string[]) => {
    const inBand = list.filter((c) => c.length >= 40 && c.length <= 60);
    if (!inBand.length) return null;
    return inBand[slugIndex(slug, inBand.length)];
  };
  const fromFor = pickInBand(forCandidates);
  if (fromFor) return fromFor;
  const fromSolo = pickInBand(soloCandidates);
  if (fromSolo) return fromSolo;
  // Last resort: closest-to-50, but still prefer for-candidates when present
  // so child designers don't collapse to the same title as their parent.
  const pool = forCandidates.length ? forCandidates : soloCandidates;
  return pool.sort((a, b) => Math.abs(50 - a.length) - Math.abs(50 - b.length))[0];
}

export function designerSeoDescription(args: { name: string; founder?: string | null; specialty?: string | null; biography?: string | null; isChildDesigner?: boolean; slug?: string | null }) {
  const cleanName = displayName(args.name);
  const cleanFounder = args.founder?.trim();
  const rawBio = args.biography ? args.biography.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
  const genericAffiliation = /^designer\s+for\s+.+\.?$/i.test(rawBio);
  const usableBio = rawBio && !genericAffiliation ? rawBio : "";

  // Helper: trim to ≤160 at a word boundary, ending with "…" if cut.
  const clamp160 = (s: string) => {
    const clean = s.replace(/\s+/g, " ").trim();
    if (clean.length <= 160) return clean;
    const cut = clean.slice(0, 159);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:\s]+$/, "") + "…";
  };

  // Rich biography → let it stand alone. The first 160 chars of a real bio
  // are unique per designer, which is exactly what duplicate-description
  // scanners look for. No shared marketing suffix.
  if (usableBio.length >= 140) {
    return clamp160(usableBio);
  }

  // Thin/missing bio → build a per-designer sentence that varies by name,
  // specialty, founder and slug-derived template so siblings don't share
  // descriptions verbatim.
  const specialty = args.specialty?.trim().replace(/\.$/, "");
  const kw = categoryKeyword(specialty);
  const leadOptions = usableBio
    ? [usableBio]
    : specialty
      ? (args.isChildDesigner && cleanFounder
        ? [
            `${cleanName} designs ${specialty.toLowerCase()} for ${cleanFounder}.`,
            `${cleanName} — ${specialty} for ${cleanFounder}.`,
            `${specialty} by ${cleanName} for ${cleanFounder}.`,
          ]
        : [
            `${cleanName} — ${specialty}.`,
            `${cleanName}: collectible ${kw} and limited editions.`,
            `${specialty} by ${cleanName}.`,
          ])
      : [`${cleanName} — collectible ${kw}.`];
  const lead = leadOptions[slugIndex(args.slug, leadOptions.length)];

  const tailOptions = args.isChildDesigner && cleanFounder
    ? [
        ` Collectible pieces curated by Maison Affluency, Singapore.`,
        ` Trade-priced pieces from ${cleanFounder}, presented by Maison Affluency Singapore.`,
        ` Available to architects and designers via Maison Affluency Singapore.`,
      ]
    : [
        ` Collectible furniture, lighting and limited editions — Maison Affluency, Singapore.`,
        ` Curated by Maison Affluency Singapore for trade and private collectors worldwide.`,
        ` Apartment Gallery and trade catalogue — Maison Affluency, Singapore.`,
      ];
  const tail = tailOptions[slugIndex(args.slug, tailOptions.length)];
  return clamp160(`${lead}${tail}`);
}
