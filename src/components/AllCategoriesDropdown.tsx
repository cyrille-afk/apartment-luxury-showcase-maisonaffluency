import { Button } from "@/components/ui/button";
import { useCategoryMenuCounts } from "@/hooks/useRoomMenuCounts";
import { CATALOGUE_DIRECTORY_COLUMNS, CATALOGUE_DIRECTORY_COUNT_ENTRIES } from "./catalogueDirectory";

interface Props {
  onCategoryLink: (category: string, subcategory?: string) => void;
  onFullCatalogue: () => void;
}

export default function AllCategoriesDropdown({ onCategoryLink, onFullCatalogue }: Props) {
  const { data: counts } = useCategoryMenuCounts(CATALOGUE_DIRECTORY_COUNT_ENTRIES);
  return (
    <div data-header-panel data-catalogue-directory className="catalogue-directory border-t border-border/20">
      <div className="mx-auto max-w-[1280px] px-6 py-8 lg:px-10">
        <Button variant="ghost" onClick={onFullCatalogue} className="mb-7 h-auto rounded-none p-0 font-body text-xs font-normal uppercase tracking-widest hover:bg-transparent hover:opacity-60">
          View All
        </Button>
        <div className="grid grid-cols-4 gap-6 lg:gap-10">
          {CATALOGUE_DIRECTORY_COLUMNS.map((column, index) => (
            <div key={index} className="min-w-0 space-y-7 border-l border-current/10 pl-5 first:border-0 first:pl-0 lg:pl-7">
              {column.map((group) => (
                <section key={group.category} data-directory-category={group.category} className="min-w-0">
                  <Button variant="ghost" onClick={() => onCategoryLink(group.category)} className="mb-3 h-auto justify-start rounded-none p-0 font-body text-xs font-bold uppercase tracking-widest hover:bg-transparent hover:opacity-60">
                    {group.category}
                  </Button>
                  <ul className="space-y-1">
                    {group.links.map((link) => {
                      const count = counts?.[`${link.category}:${link.subcategory}`];
                      return (
                        <li key={link.subcategory} className="min-w-0">
                          <Button variant="ghost" onClick={() => onCategoryLink(link.category, link.subcategory)} className="grid h-auto w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2 whitespace-normal rounded-none px-0 py-1 text-left font-body text-xs font-light leading-relaxed tracking-normal transition-opacity hover:bg-transparent hover:opacity-60 motion-reduce:transition-none">
                            <span className="min-w-0 text-balance">{link.label}</span>
                            {typeof count === "number" && <span className="shrink-0 text-[10px] tabular-nums opacity-60">{count}</span>}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}