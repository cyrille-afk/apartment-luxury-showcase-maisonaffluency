import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useDbCuratorPicks } from "@/hooks/useDbCuratorPicks";
import { useCategoryMenuCounts } from "@/hooks/useRoomMenuCounts";
import { productMenuImageIndex, productMenuImageSizes, resolveProductMenuCards, type ProductMenuLink } from "./productMenuImages";
import { seatingCardImage, seatingCardSrcSet } from "./seatingMenuImages";

interface Props {
  menu: { key: string; title: string; links: ProductMenuLink[] };
  visit: number;
  onCategoryLink: (category: string, subcategory?: string) => void;
}

export default function ProductCategoryDropdown({ menu, visit, onCategoryLink }: Props) {
  const isSeating = menu.key === "seating";
  const { data: catalogue = [] } = useDbCuratorPicks();
  const { data: counts } = useCategoryMenuCounts(menu.links.map((link) => ({ ...link, key: link.label })));
  const cards = useMemo(() => resolveProductMenuCards(menu.links, catalogue.map((item) => item.pick), isSeating).filter((card) => card.images.length > 0), [menu.links, catalogue, isSeating]);
  const trackImage = (label: string, interaction: "hover" | "click", index: number) => {
    if (isSeating) window.__lovableEvents?.track?.("project.seating_featured_image_interacted", { subcategory: label, interaction, image_index: index });
  };
  return (
    <div data-header-panel data-product-grid-panel={menu.key} className="relative grid grid-cols-[11rem_minmax(0,1fr)] gap-6 overflow-visible border-t border-border/50 bg-background p-7 shadow-xl">
      <div data-product-menu-sidebar data-seating-sidebar={isSeating ? "" : undefined} className="min-h-[190px] border-r border-border/60 pr-4">
        <div className="mb-5 font-body text-xs font-semibold uppercase tracking-widest text-foreground">{menu.title}</div>
        <div className="flex flex-col gap-0.5">
          {menu.links.map((link) => (
            <Button key={link.label} type="button" variant="ghost"
              onClick={() => {
                if (isSeating) window.__lovableEvents?.track?.("project.seating_subcategory_clicked", { subcategory: link.label });
                onCategoryLink(link.category, link.subcategory);
              }}
              className="h-auto justify-between gap-2 whitespace-normal rounded-none px-0 py-1 text-left font-body text-xs font-normal tracking-normal text-muted-foreground transition-colors duration-200 hover:bg-transparent hover:text-foreground focus-visible:outline-hidden">
              <span>{link.label}</span>
              {!isSeating && typeof counts?.[link.label] === "number" && <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">{counts[link.label]}</span>}
            </Button>
          ))}
        </div>
      </div>
      <div data-product-menu-grid data-seating-grid={isSeating ? "" : undefined} className="relative min-h-0 min-w-0">
        <div className="absolute inset-0 grid auto-cols-fr grid-flow-col gap-4">
          {cards.map((card) => {
            const index = productMenuImageIndex(visit, card.images);
            const image = card.images[index];
            return (
              <Button key={card.label} type="button" variant="ghost"
                onMouseEnter={() => trackImage(card.label, "hover", index)}
                onClick={() => { trackImage(card.label, "click", index); onCategoryLink(card.category, card.subcategory); }}
                className="group flex h-full min-h-0 min-w-0 flex-col items-stretch justify-start gap-0 rounded-none p-0 hover:bg-transparent focus-visible:outline-hidden">
                <span className="block min-h-0 w-full flex-1 overflow-hidden bg-accent/30">
                  {image && <img src={seatingCardImage(image)} srcSet={seatingCardSrcSet(image)} sizes={productMenuImageSizes(cards.length)} loading="lazy" decoding="async" width={320} height={400} alt={card.label} className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />}
                </span>
                <span className="flex h-10 shrink-0 items-center justify-center whitespace-normal text-center font-body text-xs font-normal tracking-normal text-muted-foreground transition-colors duration-300 group-hover:text-foreground">{card.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}