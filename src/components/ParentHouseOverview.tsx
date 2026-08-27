import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Search, X } from "lucide-react";
import { useParentBrandDesigners } from "@/hooks/useParentBrandDesigners";
import { cn } from "@/lib/utils";

/** Accent/case-insensitive fold for search matching. */
const fold = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * Parent-house overview section: lists every designer working under a parent
 * house (e.g. Veronese, Pouenat) as expandable rows. Collapsed rows show the
 * designer's name + specialty; expanding reveals portrait, bio excerpt and a
 * link to the full profile. A search field and specialty filters appear when
 * the roster is large enough to warrant them.
 */
export function ParentHouseOverview({ parentName }: { parentName: string }) {
  const { data: designers = [] } = useParentBrandDesigners(parentName);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
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
        fold(d.specialty || "").includes(q) ||
        fold(d.bioExcerpt || "").includes(q)
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
        <div className="mb-4 md:mb-6 space-y-3">
          <div className="relative">
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
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSpecialty(null)}
                className={cn(
                  "font-body text-[10px] uppercase tracking-[0.18em] px-3 py-1.5 border transition-colors",
                  specialty === null
                    ? "border-foreground text-foreground"
                    : "border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/50"
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
                    "font-body text-[10px] uppercase tracking-[0.18em] px-3 py-1.5 border transition-colors",
                    specialty === s
                      ? "border-foreground text-foreground"
                      : "border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/50"
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

      <ul className="divide-y divide-border/30 border-y border-border/30">
        {filtered.map((d) => {

          const open = openSlug === d.slug;
          return (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => setOpenSlug(open ? null : d.slug)}
                aria-expanded={open}
                className="w-full flex items-center justify-between gap-4 py-3 md:py-4 text-left group"
              >
                <span className="min-w-0 flex items-baseline gap-3">
                  <span className="font-display text-base md:text-lg text-foreground group-hover:text-foreground/80 transition-colors truncate">
                    {d.name}
                  </span>
                  {d.specialty && (
                    <span className="hidden sm:inline font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 truncate">
                      {d.specialty}
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300",
                    open && "rotate-180"
                  )}
                />
              </button>

              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-out",
                  open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
              >
                <div className="overflow-hidden">
                  <div className="flex gap-4 md:gap-6 pb-5 md:pb-6 items-start">
                    {d.image && (
                      <Link
                        to={`/designers/${d.slug}`}
                        className="shrink-0 w-20 md:w-28 aspect-[3/4] overflow-hidden bg-neutral-100 block"
                      >
                        <img
                          src={d.image}
                          alt={d.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </Link>
                    )}
                    <div className="min-w-0 flex-1">
                      {d.specialty && (
                        <p className="sm:hidden font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 mb-1">
                          {d.specialty}
                        </p>
                      )}
                      {d.bioExcerpt && (
                        <p className="font-body text-sm leading-relaxed text-foreground/80 line-clamp-3">
                          {d.bioExcerpt}
                        </p>
                      )}
                      <Link
                        to={`/designers/${d.slug}`}
                        className="inline-block mt-3 font-body text-[11px] uppercase tracking-[0.2em] text-foreground border-b border-foreground/40 pb-0.5 hover:border-foreground transition-colors"
                      >
                        View Profile
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
