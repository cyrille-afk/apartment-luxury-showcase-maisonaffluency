import React, { useMemo } from "react";
import { useSearchParams, useLocation, Link } from "react-router-dom";
import { ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Designer } from "@/hooks/useDesigner";

/**
 * Extra facet sections (Period, Place of Origin) rendered INSIDE the
 * existing CategorySidebar on /designers. Categories are already handled
 * by CategorySidebar itself. Options are real <Link>s so every filter
 * combination stays crawlable.
 *
 * URL params (kept stable): `era`, `country`.
 */

const ERA_LABELS: Record<string, string> = {
  pre_1950: "Pre-1950",
  mid_century: "Mid-Century",
  contemporary: "Contemporary",
};
const ERA_ORDER = ["pre_1950", "mid_century", "contemporary"];

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
}

const DesignerFacetsSidebar: React.FC<Props> = ({ designers }) => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const activeEra = searchParams.get("era");
  const activeCountry = searchParams.get("country");

  const { eraOptions, countryOptions } = useMemo(() => {
    const eraCounts = new Map<string, number>();
    const countryCounts = new Map<string, number>();
    for (const d of designers) {
      const era = (d as any).era;
      const country = (d as any).country;
      if (era) eraCounts.set(era, (eraCounts.get(era) || 0) + 1);
      if (country) countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
    }
    const eras: Option[] = ERA_ORDER.filter((k) => eraCounts.get(k)).map((k) => ({
      value: k,
      label: ERA_LABELS[k],
      count: eraCounts.get(k)!,
    }));
    const countries: Option[] = [...countryCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: value, count }));
    return { eraOptions: eras, countryOptions: countries };
  }, [designers]);

  if (!eraOptions.length && !countryOptions.length) return null;

  return (
    <div className="mt-6 flex flex-col">
      <Section
        heading="Period"
        paramKey="era"
        options={eraOptions}
        active={activeEra}
        pathname={location.pathname}
        params={searchParams}
        defaultOpen
      />
      <Section
        heading="Place of Origin"
        paramKey="country"
        options={countryOptions.slice(0, 20)}
        active={activeCountry}
        pathname={location.pathname}
        params={searchParams}
      />
      {/* SEO: emit crawlable links to every facet value */}
      <nav aria-hidden="true" className="sr-only">
        {eraOptions.map((o) => (
          <Link key={`era-${o.value}`} to={buildHref(location.pathname, searchParams, "era", o.value, false)}>{o.label}</Link>
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
  paramKey: "era" | "country";
  options: Option[];
  active: string | null;
  pathname: string;
  params: URLSearchParams;
  defaultOpen?: boolean;
}

const Section: React.FC<SectionProps> = ({ heading, paramKey, options, active, pathname, params, defaultOpen }) => {
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
                  rel={isActive ? undefined : "nofollow"}
                  aria-pressed={isActive}
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
