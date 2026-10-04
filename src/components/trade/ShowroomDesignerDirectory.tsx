/**
 * Showroom → Designers & Makers.
 *
 * Fluid, full-width alphabetical index of every published maker in the trade
 * catalogue. Prominent A–Z navigation, full-bleed black-and-white portrait
 * cards on a responsive 1→6 column grid; clicking a maker routes into their
 * trade gallery page.
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
  productImageUrl: string | null;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function thumb(url: string | null) {
  if (!url) return "";
  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    return url.replace("/upload/", "/upload/w_800,c_fill,g_auto,q_auto:good,f_auto/");
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
      // Only makers that actually carry showroom pieces. The inner join also
      // gives us each designer's curated product imagery for the hover reveal.
      const { data, error } = await supabase
        .from("designers")
        .select("id, name, slug, image_url, specialty, designer_curator_picks!inner(id, image_url)")
        .eq("is_published", true)
        .not("slug", "is", null)
        .range(0, 9999);
      if (error) throw error;
      const byId = new Map<string, DirectoryDesigner>();
      (data || []).forEach((d: any) => {
        if (byId.has(d.id)) return;
        const productImage =
          (d.designer_curator_picks || []).find((p: any) => p.image_url)?.image_url || null;
        byId.set(d.id, {
          id: d.id,
          name: d.name,
          slug: d.slug,
          image_url: d.image_url,
          specialty: d.specialty,
          productImageUrl: productImage,
        });
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
    <div className="bg-[#F9F8F6] -mx-4 px-4 py-10 md:-mx-6 md:px-6 lg:-mx-10 lg:px-10">
      {/* Prominent A–Z navigation */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-[#E5E5E5] pb-4">
        <button
          onClick={() => setLetter(null)}
          className={cn(
            "px-3 py-2 font-body text-base tracking-[0.08em] transition-colors",
            letter === null
              ? "font-semibold text-foreground underline decoration-foreground underline-offset-[10px]"
              : "text-muted-foreground/60 hover:text-foreground",
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
                "px-3 py-2 font-body text-base tracking-[0.08em] transition-colors",
                !enabled && "text-muted-foreground/25 cursor-default",
                enabled &&
                  letter === l &&
                  "font-semibold text-foreground underline decoration-foreground underline-offset-[10px]",
                enabled && letter !== l && "text-muted-foreground/60 hover:text-foreground",
              )}
            >
              {l}
            </button>
          );
        })}
        <span className="ml-auto pl-4 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">
          {designers.length} Makers
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-6 gap-y-12 pt-10">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] bg-black/5" />
              <div className="h-3 w-2/3 mt-4 bg-black/5" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-6 gap-y-14 pt-10">
          {visible.map((d) => (
            <button key={d.id} onClick={() => onSelectDesigner(d)} className="group text-left">
              {/* Signature-product hover reveal: portrait in full colour
                  fades out over the curated piece underneath. */}
              <div className="relative overflow-hidden bg-[#F2F1EE] aspect-[3/4]">
                {d.productImageUrl ? (
                  <img
                    src={thumb(d.productImageUrl)}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : null}
                {d.image_url ? (
                  <img
                    src={thumb(d.image_url)}
                    alt={displayDesignerName(d.name)}
                    loading="lazy"
                    className={cn(
                      "relative h-full w-full object-cover object-top transition-opacity duration-500",
                      d.productImageUrl && "group-hover:opacity-0",
                    )}
                  />
                ) : null}
              </div>
              <h3 className="font-display text-lg font-light mt-4 leading-snug text-foreground line-clamp-1">
                {displayDesignerName(d.name)}
              </h3>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 mt-1.5 line-clamp-1 min-h-[15px]">
                {d.specialty || " "}
              </p>
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
