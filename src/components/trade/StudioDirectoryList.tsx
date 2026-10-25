import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { cldResponsiveImg } from "@/lib/cloudinary";

export type DirectoryEntry = {
  id: string;
  slug: string;
  name: string;
  founder: string | null;
  specialty: string;
  image_url: string;
  isAtelierCard?: boolean;
  productCount: number;
};

export type DirectoryProduct = { id: string; product_name: string; image_url: string | null; category?: string | null };

type Props = {
  entries: DirectoryEntry[];
  productsByBrand: Map<string, DirectoryProduct[]>;
  childrenByFounder: Map<string, DirectoryEntry[]>;
  onOpenProfile: (slug: string) => void;
  onOpenProduct: (id: string) => void;
};

const norm = (v: string | null | undefined) => (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function ProfileDetails({ entry, products, houseMembers, onOpenProfile, onOpenProduct }: {
  entry: DirectoryEntry; products: DirectoryProduct[]; houseMembers: DirectoryEntry[];
  onOpenProfile: (slug: string) => void; onOpenProduct: (id: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["studio-directory-profile", entry.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("designers")
        .select("philosophy, notable_works, collab_brands, country, era")
        .eq("id", entry.id)
        .maybeSingle();
      return data;
    },
    staleTime: 10 * 60_000,
  });

  const brands = new Set<string>();
  if (entry.founder && norm(entry.founder) !== norm(entry.name)) brands.add(entry.founder);
  for (const m of houseMembers) brands.add(m.name);
  for (const b of (data?.collab_brands as string[] | null) || []) if (b) brands.add(b);

  const philosophy = (data?.philosophy || "").trim();
  const featured = products.filter((p) => p.image_url).slice(0, 4);

  return (
    <div className="grid gap-6 border-t border-border px-4 py-5 md:grid-cols-[1.1fr_1.4fr_0.8fr] md:px-6">
      <section>
        <h4 className="mb-2 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Philosophy</h4>
        {isLoading ? (
          <div className="h-16 animate-pulse rounded bg-muted/40" />
        ) : philosophy ? (
          <p className="font-serif text-sm leading-relaxed text-foreground/85 line-clamp-[8] whitespace-pre-line">{philosophy}</p>
        ) : (
          <p className="font-body text-xs italic text-muted-foreground">{entry.specialty || "Philosophy to be published."}</p>
        )}
        {(data?.country || data?.era) && (
          <p className="mt-3 font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {[data?.country, data?.era].filter(Boolean).join(" · ")}
          </p>
        )}
      </section>

      <section>
        <h4 className="mb-2 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          Featured work{products.length ? ` · ${products.length} pieces` : ""}
        </h4>
        {featured.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {featured.map((p) => (
              <button key={p.id} onClick={() => onOpenProduct(p.id)} className="group text-left">
                <div className="aspect-square overflow-hidden rounded bg-muted/20">
                  <img
                    {...cldResponsiveImg(p.image_url!, { widths: [160, 240, 320], sizes: "160px", quality: "auto:eco" })}
                    alt={p.product_name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <p className="mt-1 truncate font-body text-[11px] text-foreground group-hover:underline">{p.product_name}</p>
              </button>
            ))}
          </div>
        ) : data?.notable_works ? (
          <p className="font-body text-xs leading-relaxed text-foreground/80 line-clamp-6">{data.notable_works}</p>
        ) : (
          <p className="font-body text-xs italic text-muted-foreground">No pieces in the catalogue yet.</p>
        )}
      </section>

      <section>
        <h4 className="mb-2 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          {entry.isAtelierCard ? "Represented designers" : "Brands & houses"}
        </h4>
        {brands.size ? (
          <ul className="flex flex-wrap gap-1.5">
            {[...brands].map((b) => {
              const member = houseMembers.find((m) => m.name === b);
              return (
                <li key={b}>
                  {member ? (
                    <button onClick={() => onOpenProfile(member.slug)} className="rounded-full border border-border px-2.5 py-1 font-body text-[10px] text-foreground hover:border-primary/50 hover:text-primary">{b}</button>
                  ) : (
                    <span className="inline-block rounded-full border border-border px-2.5 py-1 font-body text-[10px] text-muted-foreground">{b}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="font-body text-xs italic text-muted-foreground">Independent studio.</p>
        )}
        <button
          onClick={() => onOpenProfile(entry.slug)}
          className="mt-4 font-body text-[10px] uppercase tracking-[0.15em] text-primary hover:underline"
        >
          Open full profile →
        </button>
      </section>
    </div>
  );
}

export default function StudioDirectoryList({ entries, productsByBrand, childrenByFounder, onOpenProfile, onOpenProduct }: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOpen((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
      {entries.map((e) => {
        const isOpen = open.has(e.id);
        const members = e.isAtelierCard ? childrenByFounder.get(norm(e.name)) || [] : [];
        const products = [
          ...(productsByBrand.get(norm(e.name)) || []),
          ...members.flatMap((m) => productsByBrand.get(norm(m.name)) || []),
        ];
        return (
          <li key={e.id}>
            <button
              onClick={() => toggle(e.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/30 md:px-6"
            >
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-muted/30">
                {e.image_url && (
                  <img {...cldResponsiveImg(e.image_url, { widths: [96], sizes: "48px", quality: "auto:eco" })} alt="" loading="lazy" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[15px] text-foreground">
                  {e.name}
                  {e.isAtelierCard && <span className="ml-2 align-middle font-body text-[9px] uppercase tracking-[0.15em] text-primary">Atelier</span>}
                </p>
                <p className="truncate font-body text-xs text-muted-foreground">
                  {e.specialty || (e.founder && e.founder !== e.name ? e.founder : "")}
                </p>
              </div>
              <span className="hidden font-body text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
                {products.length} {products.length === 1 ? "piece" : "pieces"}
              </span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <ProfileDetails entry={e} products={products} houseMembers={members} onOpenProfile={onOpenProfile} onOpenProduct={onOpenProduct} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
