import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useParentBrandDesigners } from "@/hooks/useParentBrandDesigners";
import { cn } from "@/lib/utils";

/** Accent/case-insensitive fold for search matching. */
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Parent-house roster index: a uniform editorial grid listing every designer
 * under a parent house (e.g. Veronese, Pouenat). Portrait-only cards route
 * directly to each designer's page. A search field and minimalist uppercase
 * text-tag filters appear when the roster is large enough to warrant them.
 */
export function ParentHouseOverview({ parentName }: { parentName: string }) {
  const { data: designers = [] } = useParentBrandDesigners(parentName);
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState<string | null>(null);

  const specialties = useMemo(() => {
    const set = new Set<string>();
    designers.forEach((d) => d.specialty && set.add(d.specialty.trim()));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [designers]);

  const filtered = useMemo(() => {
    const q = fold(query);
    return designers.filter((d) => {
      if (specialty && (d.specialty || "").trim() !== specialty) return false;
      if (!q) return true;
      return (
        fold(d.name).includes(q) ||
        fold(d.specialty || "").includes(q)
      );
    });
  }, [designers, query, specialty]);

  if (designers.length === 0) return null;

  const showControls = designers.length > 5;

  return (
    <section className="mt-10 md:mt-14 border-t border-border/40 pt-6 md:pt-8">
      <div className="flex items-baseline justify-between mb-4 md:mb-6">
        <h2 className="font-display text-[11px] tracking-[0.28em] uppercase text-muted-foreground">
          The Designers of {parentName}
        </h2>
        <span className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">
          {filtered.length === designers.length
            ? `${designers.length} ${designers.length === 1 ? "designer" : "designers"}`
            : `${filtered.length} / ${designers.length}`}
        </span>
      </div>

      {showControls && (
        <div className="mb-6 md:mb-8 space-y-3">
          <div className="relative max-w-xs">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search designers"
              aria-label={`Search the designers of ${parentName}`}
              className="w-full bg-transparent border-0 border-b border-border/40 focus:border-foreground/60 outline-none pl-6 pr-6 py-2 font-body text-sm placeholder:text-muted-foreground/60 transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {specialties.length > 1 && (
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
              <button
                type="button"
                onClick={() => setSpecialty(null)}
                className={cn(
                  "font-body text-[10px] uppercase tracking-[0.18em] transition-colors",
                  specialty === null
                    ? "text-foreground border-b border-foreground pb-0.5"
                    : "text-muted-foreground/70 hover:text-foreground"
                )}
              >
                All
              </button>
              {specialties.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpecialty(specialty === s ? null : s)}
                  className={cn(
                    "font-body text-[10px] uppercase tracking-[0.18em] transition-colors",
                    specialty === s
                      ? "text-foreground border-b border-foreground pb-0.5"
                      : "text-muted-foreground/70 hover:text-foreground"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 && (
        <p className="font-body text-sm text-muted-foreground py-6">
          No designers match your search.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-12">
        {filtered.map((d) => (
          <Link
            key={d.id}
            to={`/designers/${d.slug}`}
            className="group block"
          >
            <div className="w-full aspect-[3/4] bg-neutral-50 overflow-hidden">
              {d.image ? (
                <img
                  src={d.image}
                  alt={d.name}
                  loading="lazy"
                  decoding="async"
                  className="object-cover w-full h-full transition-all duration-300 grayscale opacity-90 contrast-[1.02] group-hover:grayscale-0 group-hover:opacity-100 group-hover:contrast-[1.10] group-hover:scale-[1.02]"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="font-display text-xl text-muted-foreground/20">
                    {d.name.charAt(0)}
                  </span>
                </div>
              )}
            </div>
            <p className="mt-3 font-body text-[11px] md:text-xs uppercase tracking-[0.18em] text-foreground leading-tight line-clamp-1">
              {d.name}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
