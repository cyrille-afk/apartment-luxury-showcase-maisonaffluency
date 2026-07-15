import React, { useMemo, useRef } from "react";
import { useSearchParams, useLocation, Link } from "react-router-dom";
import { ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Designer } from "@/hooks/useDesigner";
import { useDesignerFinishFamilies } from "@/hooks/useDesignerFinishFamilies";
import { pickMatchesCategoryFilter } from "@/lib/pickCategoryFilter";
import { originToCountries } from "@/lib/productOrigin";

/**
 * Extra facet sections (Finishes, Place of Origin) rendered INSIDE the
 * existing CategorySidebar on /designers. Categories are already handled
 * by CategorySidebar itself.
 *
 * URL params (kept stable): `finish`, `country`.
 */

const FINISH_LABELS: Record<string, string> = {
  metal: "Metal",
  wood: "Wood",
  fabric: "Fabric",
  glass: "Glass",
  stone: "Stone",
  leather: "Leather",
  composite: "Composite",
  ceramic: "Ceramic",
  other: "Other",
};
const FINISH_ORDER = ["metal", "wood", "fabric", "glass", "stone", "leather", "composite", "ceramic", "other"];

type Option = { value: string; label: string; count: number };

function buildHref(
  pathname: string,
  params: URLSearchParams,
  key: string,
  value: string | null,
  active: boolean,
): string {
  const next = new URLSearchParams(params);
  if (active || value === null) next.delete(key);
  else next.set(key, value);
  next.delete("letter");
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

interface Props {
  designers: Designer[];
  productPicks?: Array<{
    id: string;
    designer_id: string;
    category?: string | null;
    subcategory?: string | null;
    tags?: string[] | null;
    origin?: string | null;
  }>;
  activeCategory?: string | null;
  activeSubcategory?: string | null;
  /** Map of designer id → set of countries derived from their picks' origins. */
  designerCountriesById?: Map<string, Set<string>>;
}

const DesignerFacetsSidebar: React.FC<Props> = ({ designers, productPicks, activeCategory, activeSubcategory, designerCountriesById }) => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const scrollYRef = useRef(0);
  const activeFinish = searchParams.get("finish");
  const activeCountry = searchParams.get("country");

  const { data: finishMap } = useDesignerFinishFamilies();

  const { finishOptions, countryOptions } = useMemo(() => {
    const countryCounts = new Map<string, number>();
    const finishCounts = new Map<string, number>();
    if (productPicks) {
      for (const pick of productPicks) {
        if (!pickMatchesCategoryFilter(pick, activeCategory, activeSubcategory)) continue;
        const country = originToCountry(pick.origin);
        if (country) countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
        finishMap?.byPick.get(pick.id)?.forEach((family) => {
          finishCounts.set(family, (finishCounts.get(family) || 0) + 1);
        });
      }
    } else {
      // Designers mode: count each designer once per country derived from
      // their picks' `origin` fields. Falls back to nothing when a designer
      // has no origin data — accuracy over completeness.
      for (const d of designers) {
        const countries = designerCountriesById?.get(d.id);
        if (!countries) continue;
        countries.forEach((c) => countryCounts.set(c, (countryCounts.get(c) || 0) + 1));
      }
    }

    const finishes: Option[] = FINISH_ORDER
      .map((k) => ({ value: k, label: FINISH_LABELS[k], count: productPicks ? (finishCounts.get(k) || 0) : (finishMap?.counts.get(k) || 0) }))
      .filter((o) => o.count > 0);

    const countries: Option[] = [...countryCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: value, count }));
    return { finishOptions: finishes, countryOptions: countries };
  }, [designers, productPicks, activeCategory, activeSubcategory, finishMap, designerCountriesById]);

  if (!finishOptions.length && !countryOptions.length) return null;

  return (
    <div className="mt-6 flex flex-col">
      <Section
        heading="Finishes"
        paramKey="finish"
        options={finishOptions}
        active={activeFinish}
        pathname={location.pathname}
        params={searchParams}
        scrollYRef={scrollYRef}
      />
      <Section
        heading="Place of Origin"
        paramKey="country"
        options={countryOptions.slice(0, 20)}
        active={activeCountry}
        pathname={location.pathname}
        params={searchParams}
        scrollYRef={scrollYRef}
      />
      {/* SEO: emit crawlable links to every facet value */}
      <nav aria-hidden="true" className="sr-only">
        {finishOptions.map((o) => (
          <Link key={`finish-${o.value}`} to={buildHref(location.pathname, searchParams, "finish", o.value, false)}>{o.label}</Link>
        ))}
        {countryOptions.map((o) => (
          <Link key={`c-${o.value}`} to={buildHref(location.pathname, searchParams, "country", o.value, false)}>{o.label}</Link>
        ))}
      </nav>
    </div>
  );
};

interface SectionProps {
  heading: string;
  paramKey: "finish" | "country";
  options: Option[];
  active: string | null;
  pathname: string;
  params: URLSearchParams;
  scrollYRef: React.MutableRefObject<number>;
  defaultOpen?: boolean;
}

const Section: React.FC<SectionProps> = ({ heading, paramKey, options, active, pathname, params, scrollYRef, defaultOpen }) => {
  const [open, setOpen] = React.useState(defaultOpen || !!active);
  if (!options.length) return null;
  return (
    <div className="border-t border-border/20 py-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-2 px-1 text-left"
      >
        <span className="font-body text-[11px] uppercase tracking-[0.2em] text-foreground font-semibold">
          {heading}
          {active && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-foreground text-background text-[9px] w-4 h-4">1</span>
          )}
        </span>
        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <ul className="flex flex-col gap-0.5 pl-1 pb-2">
          {options.map((opt) => {
            const isActive = active === opt.value;
            const href = buildHref(pathname, params, paramKey, opt.value, isActive);
            return (
              <li key={opt.value}>
                <Link
                  to={href}
                  state={{ preserveScroll: true }}
                  rel={isActive ? undefined : "nofollow"}
                  aria-pressed={isActive}
                  preventScrollReset
                  onPointerDown={() => {
                    scrollYRef.current = window.scrollY;
                  }}
                  onClick={() => {
                    const y = scrollYRef.current || window.scrollY;
                    window.setTimeout(() => window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior }), 0);
                    window.setTimeout(() => window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior }), 120);
                  }}
                  className={cn(
                    "flex items-center justify-between rounded px-2 py-1.5 font-body text-[10px] tracking-[0.15em] transition-colors",
                    isActive ? "text-[hsl(var(--accent))] font-semibold" : "text-foreground hover:bg-muted",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {isActive && <X className="h-3 w-3" aria-hidden />}
                    {opt.label}
                  </span>
                  <span className="text-[9px] text-muted-foreground/70">{opt.count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default DesignerFacetsSidebar;
