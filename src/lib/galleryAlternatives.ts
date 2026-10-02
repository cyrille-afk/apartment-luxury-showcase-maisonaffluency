type GalleryAlternative = {
  id: string;
  title: string;
  subtitle?: string | null;
  brand_name: string;
  category?: string | null;
  subcategory?: string | null;
  image_url?: string | null;
};

const norm = (value?: string | null) => (value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const matchesSub = (pick: GalleryAlternative, subs: string[]) => subs.includes(norm(pick.subcategory));
const isBarHeight = (title: string) => /\b(bar\s?stool|bar\s?chair|bar|counter|high\s?stool)\b/.test(norm(title));
  const isWallArt = (pick: GalleryAlternative) =>
  matchesSub(pick, ["wall decor", "wall art", "art", "artworks"])
  || (norm(pick.category) === "decor" && /\b(diasec|photograph|painting|artwork|canvas)\b/.test(norm(`${pick.title} ${pick.subtitle}`)));

/** Select like-for-like public gallery alternatives; the wall-art exception also admits wall mirrors. */
export function galleryAlternatives<T extends GalleryAlternative>(
  hotspotName: string,
  source: T | null,
  publicPicks: T[],
  limit = 3,
): T[] {
  const name = norm(hotspotName);
  const sub = norm(source?.subcategory);
  const sourceTitle = norm(source?.title || hotspotName);
  const sourceBrand = norm(source?.brand_name);
  const pool = publicPicks.filter((pick) => pick.image_url && pick.id !== source?.id && norm(pick.title) !== sourceTitle && norm(pick.title) !== name);
  const collect = (...groups: T[][]) => [...new Map(groups.flat().map((pick) => [pick.id, pick])).values()].slice(0, limit);

  // A wall-mounted artwork is catalogued as "Decorative Objects"; don't offer
  // unrelated vases. Prefer the artist's other works, then wall art and mirrors.
  if (/\b(diasec|photograph|painting|artwork|canvas|wall art)\b/.test(name) || (source && isWallArt(source))) {
    const art = pool.filter(isWallArt);
    const sameArtist = pool.filter((pick) => sourceBrand && norm(pick.brand_name) === sourceBrand && (isWallArt(pick) || (norm(pick.category) === "decor" && sub === norm(pick.subcategory))));
    return collect(sameArtist, art, pool.filter((pick) => matchesSub(pick, ["mirrors"])));
  }

  const typeRules: Array<[RegExp, string[], (pick: T) => boolean]> = [
    [/\b(wallcover\w*|wallpaper\w*|scenic|mural)\b/, ["wallcoverings", "wall decor"], () => true],
    [/\b(chandelier|pendant|suspension|ceiling|flush mount|plafonnier)\b/, ["ceiling lights"], () => true],
    [/\b(floor lamp|floor light)\b/, ["floor lights"], (pick) => !/\b(table lamp|table light|wall lamp|wall light)\b/.test(norm(pick.title))],
    [/\b(sconce|wall lamp|wall light)\b/, ["wall lights"], () => true],
    [/\b(table lamp|table light)\b/, ["table lights", "table lamps", "table lamp"], () => true],
    [/\b(lamp|light)\b/, sub ? [sub] : [], () => true],
    [/\b(rug|carpet)\b/, ["hand knotted rugs", "hand tufted rugs"], () => true],
    [/\b(vase|vessel|bowl|geode|centerpiece)s?\b/, ["vases vessels"], () => true],
    [/\bmirror\b/, ["mirrors"], () => true],
    [/\b(bar stool|barstool|counter stool|bar chair)\b/, ["ottomans stools", "stools"], (pick) => isBarHeight(pick.title)],
    [/\b(stool|ottoman|pouffe)\b/, ["ottomans stools", "stools", "stools side tables"], (pick) => !isBarHeight(pick.title) && /\b(stool|ottoman|pouffe)\b/.test(norm(pick.title))],
    [/\b(nightstand|bedside)\b/, ["bedside tables"], () => true],
    [/\bcoffee table\b/, ["coffee tables"], () => true],
    [/\bside table\b/, ["side tables", "side table"], () => true],
    [/\bdining table\b/, ["dining tables", "dining table"], () => true],
    [/\bdesk\b/, ["desks", "desk"], () => true],
    [/\bconsole\b/, ["consoles"], () => true],
    [/\b(credenza|sideboard|buffet|cabinet|enfilade|bahut)s?\b/, ["buffets cabinets and sideboards", "cabinets"], () => true],
    [/\bsofa\b/, ["sofas", "sofa"], () => true],
    [/\barmchair\b/, ["armchairs"], () => true],
    [/\bchairs?\b/, ["chairs"], () => true],
  ];
  const rule = typeRules.find(([pattern]) => pattern.test(name));
  const targets = rule?.[1].length ? rule[1] : sub ? [sub] : [];
  const accepts = rule?.[2] || (() => true);
  return targets.length ? pool.filter((pick) => matchesSub(pick, targets) && accepts(pick)).slice(0, limit) : [];
}