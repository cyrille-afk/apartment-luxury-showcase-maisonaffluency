import React, { useMemo, useState } from "react";
import { useSearchParams, useLocation, Link } from "react-router-dom";
import { SlidersHorizontal, X, ChevronDown } from "lucide-react";
import brandCategories from "@/data/brandCategories.json";
import type { Designer } from "@/hooks/useDesigner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/**
 * Filter panel for the /designers hub.
 *
 * Facets (URL params kept stable for crawlability & back-compat):
 *  - era        → shown as "Period"           (Pre-1950 · Mid-Century · Contemporary)
 *  - discipline → shown as "Category"         (from src/data/brandCategories.json)
 *  - country    → shown as "Place of Origin"
 *
 * Rendered inside a single Filter button (à la 1stdibs) with collapsible
 * sections. Each option is a real <Link> so crawlers can follow every
 * filter combination.
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
  next.delete("letter");
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

interface Props {
  designers: Designer[];
}

type Option = { value: string; label: string; count: number };

const DesignerFacetChips: React.FC<Props> = ({ designers }) => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const activeEra = searchParams.get("era");
  const activeCountry = searchParams.get("country");
  const activeDiscipline = searchParams.get("discipline");

  const activeCount =
    (activeEra ? 1 : 0) + (activeCountry ? 1 : 0) + (activeDiscipline ? 1 : 0);

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

    const eras: Option[] = ERA_ORDER.filter((k) => eraCounts.get(k)).map((k) => ({
      value: k,
      label: ERA_LABELS[k],
      count: eraCounts.get(k)!,
    }));
    const countries: Option[] = [...countryCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: value, count }));
    const disciplines: Option[] = DISCIPLINE_ORDER.filter((k) => disciplineCounts.get(k)).map((k) => ({
      value: k,
      label: DISCIPLINE_LABELS[k] || k,
      count: disciplineCounts.get(k)!,
    }));

    return { eraOptions: eras, countryOptions: countries, disciplineOptions: disciplines };
  }, [designers]);

  if (!eraOptions.length && !countryOptions.length && !disciplineOptions.length) {
    return null;
  }

  const clearHref = location.pathname;

  const renderSection = (
    heading: string,
    key: "era" | "discipline" | "country",
    active: string | null,
    options: Option[],
    defaultOpen = false,
  ) => {
    if (!options.length) return null;
    const isOpen = defaultOpen || !!active;
    return (
      <Collapsible defaultOpen={isOpen} className="border-b border-border last:border-b-0">
        <CollapsibleTrigger className="group flex w-full items-center justify-between py-3 text-left">
          <span className="text-xs uppercase tracking-[0.18em] text-foreground">
            {heading}
            {active && (
              <span className="ml-2 inline-block rounded-full bg-foreground text-background px-1.5 py-0.5 text-[10px] leading-none">
                1
              </span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pb-3">
          <ul className="flex flex-col gap-1">
            {options.map((opt) => {
              const isActive = active === opt.value;
              const href = buildHref(location.pathname, searchParams, key, opt.value, isActive);
              return (
                <li key={opt.value}>
                  <Link
                    to={href}
                    rel={isActive ? undefined : "nofollow"}
                    aria-pressed={isActive}
                    className={[
                      "flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-foreground text-background"
                        : "text-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-2">
                      {isActive && <X className="h-3 w-3" aria-hidden />}
                      {opt.label}
                    </span>
                    <span className={isActive ? "opacity-70 text-xs" : "text-muted-foreground text-xs"}>
                      {opt.count}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <section
      aria-label="Filter designers"
      className="mx-auto w-full max-w-7xl px-4 md:px-8 pt-6 pb-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-xs uppercase tracking-[0.18em] text-foreground hover:border-foreground/60 transition-colors"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filter
              {activeCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-foreground text-background text-[10px] leading-none w-5 h-5">
                  {activeCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-4">
            <div className="flex flex-col">
              {renderSection("Period", "era", activeEra, eraOptions, true)}
              {renderSection("Category", "discipline", activeDiscipline, disciplineOptions)}
              {renderSection("Place of Origin", "country", activeCountry, countryOptions.slice(0, 20))}
            </div>
            {activeCount > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <Link
                  to={clearHref}
                  onClick={() => setOpen(false)}
                  className="text-xs uppercase tracking-[0.18em] text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Clear all filters
                </Link>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Active filter summary chips (visible outside the popover) */}
        {activeEra && (
          <ActiveChip
            label={ERA_LABELS[activeEra] || activeEra}
            href={buildHref(location.pathname, searchParams, "era", activeEra, true)}
          />
        )}
        {activeDiscipline && (
          <ActiveChip
            label={DISCIPLINE_LABELS[activeDiscipline] || activeDiscipline}
            href={buildHref(location.pathname, searchParams, "discipline", activeDiscipline, true)}
          />
        )}
        {activeCountry && (
          <ActiveChip
            label={activeCountry}
            href={buildHref(location.pathname, searchParams, "country", activeCountry, true)}
          />
        )}
      </div>

      {/* SEO: emit crawlable links to every facet value even when the popover is closed. */}
      <nav aria-hidden="true" className="sr-only">
        {eraOptions.map((o) => (
          <Link key={`era-${o.value}`} to={buildHref(location.pathname, searchParams, "era", o.value, false)}>
            {o.label}
          </Link>
        ))}
        {disciplineOptions.map((o) => (
          <Link key={`disc-${o.value}`} to={buildHref(location.pathname, searchParams, "discipline", o.value, false)}>
            {o.label}
          </Link>
        ))}
        {countryOptions.map((o) => (
          <Link key={`c-${o.value}`} to={buildHref(location.pathname, searchParams, "country", o.value, false)}>
            {o.label}
          </Link>
        ))}
      </nav>
    </section>
  );
};

function ActiveChip({ label, href }: { label: string; href: string }) {
  return (
    <Link
      to={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-foreground bg-foreground px-3 py-1 text-xs text-background hover:opacity-80 transition-opacity"
    >
      <span>{label}</span>
      <X className="h-3 w-3" aria-hidden />
    </Link>
  );
}

export default DesignerFacetChips;
