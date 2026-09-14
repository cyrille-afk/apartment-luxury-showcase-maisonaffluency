/**
 * Showroom → Designers & Makers.
 *
 * Museum-grade alphabetical index of every published maker in the trade
 * catalogue. Unframed, shadowless cards on an alabaster canvas; clicking a
 * maker routes into the Product Grid filtered to that brand.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sortNameKey, lastNameInitial, displayDesignerName } from "@/lib/nameFormat";
import { cn } from "@/lib/utils";

interface DirectoryDesigner {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  specialty: string | null;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function thumb(url: string | null) {
  if (!url) return "";
  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    return url.replace("/upload/", "/upload/w_600,c_fill,g_auto,q_auto:good,f_auto/");
  }
  return url;
}

const ShowroomDesignerDirectory = ({
  onSelectDesigner,
}: {
  onSelectDesigner: (designer: DirectoryDesigner) => void;
}) => {
  const [letter, setLetter] = useState<string | null>(null);

  const { data: designers = [], isLoading } = useQuery({
    queryKey: ["showroom-designer-directory"],
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      // Only makers that actually carry showroom pieces.
      const { data, error } = await supabase
        .from("designers")
        .select("id, name, slug, image_url, specialty, designer_curator_picks!inner(id)")
        .eq("is_published", true)
        .not("slug", "is", null)
        .range(0, 9999);
      if (error) throw error;
      const byId = new Map<string, DirectoryDesigner>();
      (data || []).forEach((d: any) => {
        if (!byId.has(d.id)) {
          byId.set(d.id, {
            id: d.id,
            name: d.name,
            slug: d.slug,
            image_url: d.image_url,
            specialty: d.specialty,
          });
        }
      });
      return Array.from(byId.values()).sort((a, b) =>
        sortNameKey(a.name).localeCompare(sortNameKey(b.name)),
      );
    },
  });

  const activeLetters = useMemo(
    () => new Set(designers.map((d) => lastNameInitial(d.name))),
    [designers],
  );

  const visible = useMemo(
    () => (letter ? designers.filter((d) => lastNameInitial(d.name) === letter) : designers),
    [designers, letter],
  );

  return (
    <div className="bg-[#F9F8F6] -mx-4 px-4 py-10 md:-mx-6 md:px-6">
      {/* A–Z alpha slider */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#E5E5E5] pb-5">
        <button
          onClick={() => setLetter(null)}
          className={cn(
            "font-mono text-[10px] uppercase tracking-[0.15em] transition-colors",
            letter === null ? "text-foreground" : "text-muted-foreground/60 hover:text-foreground",
          )}
        >
          All
        </button>
        {LETTERS.map((l) => {
          const enabled = activeLetters.has(l);
          return (
            <button
              key={l}
              disabled={!enabled}
              onClick={() => setLetter(l)}
              className={cn(
                "font-mono text-[11px] tracking-[0.15em] transition-colors",
                !enabled && "text-muted-foreground/25 cursor-default",
                enabled && letter === l && "text-foreground underline underline-offset-[6px]",
                enabled && letter !== l && "text-muted-foreground/60 hover:text-foreground",
              )}
            >
              {l}
            </button>
          );
        })}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">
          {designers.length} Makers
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-12 pt-10">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] bg-black/5" />
              <div className="h-3 w-2/3 mt-4 bg-black/5" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-14 pt-10">
          {visible.map((d, i) => (
            <button
              key={d.id}
              onClick={() => onSelectDesigner(d.name)}
              className="group text-left"
            >
              <div
                className={cn(
                  "overflow-hidden bg-[#F2F1EE]",
                  i % 5 === 0 ? "aspect-[4/5]" : i % 5 === 3 ? "aspect-square" : "aspect-[3/4]",
                )}
              >
                {d.image_url ? (
                  <img
                    src={thumb(d.image_url)}
                    alt={displayDesignerName(d.name)}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                ) : null}
              </div>
              <h3 className="font-display text-base font-light mt-4 leading-snug text-foreground">
                {displayDesignerName(d.name)}
              </h3>
              {d.specialty ? (
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 mt-1.5 line-clamp-1">
                  {d.specialty}
                </p>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {!isLoading && visible.length === 0 && (
        <p className="py-20 text-center font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60">
          No makers under this letter
        </p>
      )}
    </div>
  );
};

export default ShowroomDesignerDirectory;
