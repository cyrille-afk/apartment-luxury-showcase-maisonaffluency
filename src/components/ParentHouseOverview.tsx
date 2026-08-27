import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useParentBrandDesigners } from "@/hooks/useParentBrandDesigners";
import { cn } from "@/lib/utils";

/**
 * Parent-house overview section: lists every designer working under a parent
 * house (e.g. Veronese, Pouenat) as expandable rows. Collapsed rows show the
 * designer's name + specialty; expanding reveals portrait, bio excerpt and a
 * link to the full profile.
 */
export function ParentHouseOverview({ parentName }: { parentName: string }) {
  const { data: designers = [] } = useParentBrandDesigners(parentName);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  if (designers.length === 0) return null;

  return (
    <section className="mt-10 md:mt-14 border-t border-border/40 pt-6 md:pt-8">
      <div className="flex items-baseline justify-between mb-4 md:mb-6">
        <h2 className="font-display text-[11px] tracking-[0.28em] uppercase text-muted-foreground">
          The Designers of {parentName}
        </h2>
        <span className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">
          {designers.length} {designers.length === 1 ? "designer" : "designers"}
        </span>
      </div>

      <ul className="divide-y divide-border/30 border-y border-border/30">
        {designers.map((d) => {
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
