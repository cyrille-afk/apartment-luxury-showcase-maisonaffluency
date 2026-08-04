import { memo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

/**
 * CuratorsPicksGrid
 *
 * Ultra-luxury, mobile-first product grid (2 cols on mobile → 3 on desktop).
 * Each card cross-fades on an infinite 4s cycle between the isolated studio
 * shot (State A) and an atmospheric lifestyle photo (State B).
 *
 * Colour is scoped through local CSS vars on the section wrapper so the block
 * can stay editorial-black without hardcoding utility colours in the markup.
 */

export interface CuratorPickCard {
  id: string;
  name: string;
  price: string;
  /** State A — isolated studio product shot */
  studioImage: string;
  /** State B — ambient / lifestyle interior shot */
  ambientImage: string;
  href: string;
  designer?: string;
}

export const curatorsPicksMock: CuratorPickCard[] = [
  {
    id: "lantern-table-lamp",
    name: "Lantern Table Lamp",
    price: "From $5,950",
    designer: "Apparatus",
    studioImage:
      "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80",
    ambientImage:
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=80",
    href: "/designers/apparatus-studio",
  },
  {
    id: "segment-console-table",
    name: "Segment Console Table",
    price: "From $57,000",
    designer: "Apparatus",
    studioImage:
      "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=900&q=80",
    ambientImage:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=80",
    href: "/designers/apparatus-studio",
  },
  {
    id: "lariat-pendant-light",
    name: "Lariat Pendant Light",
    price: "From $3,450",
    designer: "Apparatus",
    studioImage:
      "https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?auto=format&fit=crop&w=900&q=80",
    ambientImage:
      "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=900&q=80",
    href: "/designers/apparatus-studio",
  },
  {
    id: "pars-cocktail-table",
    name: "Pars Cocktail Table",
    price: "From $6,400",
    designer: "Apparatus",
    studioImage:
      "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=900&q=80",
    ambientImage:
      "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=900&q=80",
    href: "/designers/apparatus-studio",
  },
  {
    id: "signal-y-table-lamp",
    name: "Signal Y Table Lamp",
    price: "From $7,250",
    designer: "Apparatus",
    studioImage:
      "https://images.unsplash.com/photo-1517991104123-1d56a6e81ed9?auto=format&fit=crop&w=900&q=80",
    ambientImage:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
    href: "/designers/apparatus-studio",
  },
  {
    id: "tassel-57-pendant",
    name: "Tassel 57 Pendant",
    price: "From $46,670",
    designer: "Apparatus",
    studioImage:
      "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=900&q=80",
    ambientImage:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80",
    href: "/designers/apparatus-studio",
  },
];

/** 4s loop: 2s hold, 2s blend. GPU-composited (opacity only). */
const CROSSFADE = {
  opacity: [0, 0, 1, 1, 0],
  transition: {
    duration: 4,
    times: [0, 0.4, 0.5, 0.9, 1],
    ease: "easeInOut" as const,
    repeat: Infinity,
  },
};

const Card = memo(function Card({
  item,
  index,
  onOpen,
}: {
  item: CuratorPickCard;
  index: number;
  onOpen: (href: string) => void;
}) {
  return (
    <a
      href={item.href}
      onPointerUp={(e) => {
        // Pointer-up fires before click/tap-delay heuristics → zero double-tap lag.
        if (e.button !== 0 || e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        onOpen(item.href);
      }}
      onClick={(e) => e.preventDefault()}
      className="group block text-left touch-manipulation select-none"
      aria-label={`${item.name} — ${item.price}`}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[hsl(var(--picks-plate))] [transform:translateZ(0)]">
        <img
          src={item.studioImage}
          alt={item.name}
          loading={index < 2 ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover will-change-[opacity]"
        />
        <motion.img
          src={item.ambientImage}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          initial={{ opacity: 0 }}
          animate={CROSSFADE}
          style={{ animationDelay: `${index * 220}ms` }}
          transition={{ delay: index * 0.22 }}
          className="absolute inset-0 h-full w-full object-cover will-change-[opacity] [transform:translateZ(0)]"
        />
      </div>

      <div className="pt-3 sm:pt-4">
        {item.designer && (
          <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--picks-muted))]">
            {item.designer}
          </p>
        )}
        <h3 className="mt-1 font-display text-[15px] leading-snug text-[hsl(var(--picks-fg))] sm:text-lg">
          {item.name}
        </h3>
        <p className="mt-1 font-sans text-[11px] tracking-[0.14em] text-[hsl(var(--picks-muted))]">
          {item.price}
        </p>
      </div>
    </a>
  );
});

export default function CuratorsPicksGrid({
  items = curatorsPicksMock,
  title = "Curators' Picks",
}: {
  items?: CuratorPickCard[];
  title?: string;
}) {
  const navigate = useNavigate();

  return (
    <section
      style={
        {
          "--picks-bg": "0 0% 0%",
          "--picks-plate": "0 0% 6%",
          "--picks-fg": "0 0% 98%",
          "--picks-muted": "0 0% 62%",
        } as React.CSSProperties
      }
      className="bg-[hsl(var(--picks-bg))] px-4 py-12 sm:px-8 sm:py-20"
    >
      <header className="mb-8 sm:mb-12">
        <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--picks-muted))]">
          Maison Affluency
        </p>
        <h2 className="mt-2 font-display text-2xl text-[hsl(var(--picks-fg))] sm:text-4xl">
          {title}
        </h2>
      </header>

      <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-14">
        {items.map((item, i) => (
          <Card key={item.id} item={item} index={i} onOpen={(href) => navigate(href)} />
        ))}
      </div>
    </section>
  );
}
