import React, { useMemo } from "react";
import { useSearchParams, useLocation, Link } from "react-router-dom";
import { X } from "lucide-react";
import brandCategories from "@/data/brandCategories.json";
import type { Designer } from "@/hooks/useDesigner";

/**
 * Filter chips for the /designers hub.
 *
 * Facets:
 *  - era        Pre-1950 · Mid-Century · Contemporary (from designers.era)
 *  - country    France, Italy, … (from designers.country)
 *  - discipline seating, lighting, tables, … (from src/data/brandCategories.json)
 *
 * The chips are rendered as real `<Link>` anchors with a canonical `href` so
 * crawlers can follow every filter combination. Clicking updates the URL via
 * React Router (which back-populates the DesignersDirectory filter state).
 */

const ERA_LABELS: Record<string, string> = {
  pre_1950: "Pre-1950",
  mid_century: "Mid-Century",
  contemporary: "Contemporary",
};
const ERA_ORDER = ["pre_1950", "mid_century", "contemporary"];

const DISCIPLINE_LABELS: Record<string, string> = {
  seating: "Seating",
  lighting: "Lighting",
  tables: "Tables",
  storage: "Storage",
  rugs: "Rugs",
  decor: "Décor",
  bedroom: "Bedroom",
};
const DISCIPLINE_ORDER = [
  "seating",
  "lighting",
  "tables",
  "storage",
  "rugs",
  "decor",
  "bedroom",
];

/** name (or founder) → set of discipline keys */
function buildDisciplineIndex(): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const [discipline, names] of Object.entries(
    brandCategories as Record<string, string[]>,
  )) {
    for (const raw of names) {
      const key = raw.toLowerCase();
      if (!index.has(key)) index.set(key, new Set());
      index.get(key)!.add(discipline);
    }
  }
  return index;
}
const DISCIPLINE_INDEX = buildDisciplineIndex();

export function getDesignerDisciplines(d: Pick<Designer, "name" | "founder">): Set<string> {
  const out = new Set<string>();
  for (const key of [d.name, d.founder]) {
    if (!key) continue;
    const hit = DISCIPLINE_INDEX.get(key.toLowerCase());
    if (hit) hit.forEach((v) => out.add(v));
  }
  return out;
}

/** Build an `href` that toggles a single facet value. */
function buildHref(
  pathname: string,
  params: URLSearchParams,
  key: string,
  value: string | null,
  active: boolean,
): string {
  const next = new URLSearchParams(params);
  if (active || value === null) {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  // Never carry alphabet jump state across facet changes.
  next.delete("letter");
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

interface Props {
  designers: Designer[];
}

const DesignerFacetChips: React.FC<Props> = ({ designers }) => {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const activeEra = searchParams.get("era");
  const activeCountry = searchParams.get("country");
  const activeDiscipline = searchParams.get("discipline");

  // Only show chip values that have at least one designer, so the hub never
  // links to empty result pages.
  const { eraOptions, countryOptions, disciplineOptions } = useMemo(() => {
    const eraCounts = new Map<string, number>();
    const countryCounts = new Map<string, number>();
    const disciplineCounts = new Map<string, number>();

    for (const d of designers) {
      if (d.era) eraCounts.set(d.era, (eraCounts.get(d.era) || 0) + 1);
      if (d.country) countryCounts.set(d.country, (countryCounts.get(d.country) || 0) + 1);
      const disc = getDesignerDisciplines(d);
      disc.forEach((k) => disciplineCounts.set(k, (disciplineCounts.get(k) || 0) + 1));
    }

    const eras = ERA_ORDER.filter((k) => eraCounts.get(k)).map((k) => ({
      value: k,
      label: ERA_LABELS[k],
      count: eraCounts.get(k)!,
    }));
    const countries = [...countryCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: value, count }));
    const disciplines = DISCIPLINE_ORDER.filter((k) => disciplineCounts.get(k)).map((k) => ({
      value: k,
      label: DISCIPLINE_LABELS[k] || k,
      count: disciplineCounts.get(k)!,
    }));

    return { eraOptions: eras, countryOptions: countries, disciplineOptions: disciplines };
  }, [designers]);

  const anyActive = !!(activeEra || activeCountry || activeDiscipline);

  const renderGroup = (
    heading: string,
    key: "era" | "country" | "discipline",
    active: string | null,
    options: { value: string; label: string; count: number }[],
  ) => {
    if (!options.length) return null;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground shrink-0 mr-1">
          {heading}
        </span>
        {options.map((opt) => {
          const isActive = active === opt.value;
          const href = buildHref(location.pathname, searchParams, key, opt.value, isActive);
          return (
            <Link
              key={opt.value}
              to={href}
              rel={isActive ? undefined : "nofollow"}
              aria-pressed={isActive}
              className={[
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                isActive
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:border-foreground/60",
              ].join(" ")}
            >
              <span>{opt.label}</span>
              <span
                className={
                  isActive ? "opacity-70" : "text-muted-foreground"
                }
              >
                {opt.count}
              </span>
              {isActive && <X className="h-3 w-3" aria-hidden />}
            </Link>
          );
        })}
      </div>
    );
  };

  if (
    !eraOptions.length &&
    !countryOptions.length &&
    !disciplineOptions.length
  ) {
    return null;
  }

  const clearHref = location.pathname;

  return (
    <section
      aria-label="Filter designers"
      className="mx-auto w-full max-w-7xl px-4 md:px-8 pt-6 pb-4"
    >
      <div className="flex flex-col gap-3">
        {renderGroup("Era", "era", activeEra, eraOptions)}
        {renderGroup("Discipline", "discipline", activeDiscipline, disciplineOptions)}
        {renderGroup("Country", "country", activeCountry, countryOptions.slice(0, 14))}
        {anyActive && (
          <div>
            <Link
              to={clearHref}
              className="text-xs uppercase tracking-[0.18em] text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Clear all filters
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

export default DesignerFacetChips;
