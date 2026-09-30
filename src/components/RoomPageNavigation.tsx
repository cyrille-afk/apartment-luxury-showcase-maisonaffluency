import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RoomSlug } from "@/lib/roomCategories";

type Category = { label: string; category: string; subcategories: string[] };
const roomLinks: { label: string; slug: RoomSlug }[] = [
  { label: "Living Rooms", slug: "living-room" },
  { label: "Office", slug: "office" },
  { label: "Dining", slug: "dining-room" },
  { label: "Bedroom", slug: "bedroom" },
];
const living: Category[] = [
  { label: "Seating", category: "Seating", subcategories: ["Sofas", "Armchairs", "Chairs", "Daybeds & Benches", "Ottomans & Stools"] },
  { label: "Tables", category: "Tables", subcategories: ["Coffee Tables", "Side Tables", "Consoles"] },
  { label: "Storage", category: "Storage", subcategories: ["Buffets, Cabinets And Sideboards", "Bookcases", "Bars"] },
  { label: "Lighting", category: "Lighting", subcategories: ["Floor Lights", "Table Lights", "Wall Lights", "Ceiling Lights"] },
  { label: "Rugs", category: "Rugs", subcategories: ["Hand-Knotted Rugs", "Hand-Tufted Rugs", "Hand-Woven Rugs"] },
  { label: "Décor", category: "Décor", subcategories: ["Mirrors", "Decorative Objects", "Cushions & Throws", "Vases & Vessels"] },
];
const office: Category[] = [
  { label: "Desks", category: "Tables", subcategories: ["Desks"] },
  { label: "Office Seating", category: "Seating", subcategories: ["Office Chairs", "Armchairs"] },
  { label: "Storage", category: "Storage", subcategories: ["Bookcases", "Buffets, Cabinets And Sideboards"] },
  { label: "Lighting", category: "Lighting", subcategories: ["Table Lights", "Floor Lights"] },
  { label: "Rugs", category: "Rugs", subcategories: ["Hand-Knotted Rugs", "Hand-Woven Rugs"] },
];
const dining: Category[] = [
  { label: "Dining Tables", category: "Tables", subcategories: ["Dining Tables"] },
  { label: "Dining Seating", category: "Seating", subcategories: ["Chairs", "Ottomans & Stools"] },
  { label: "Sideboards & Bars", category: "Storage", subcategories: ["Buffets, Cabinets And Sideboards", "Bars"] },
  { label: "Lighting", category: "Lighting", subcategories: ["Ceiling Lights", "Wall Lights", "Table Lights"] },
  { label: "Tableware", category: "Décor", subcategories: ["Tableware & Linens", "Candle Holders", "Vases & Vessels"] },
  { label: "Rugs", category: "Rugs", subcategories: ["Hand-Knotted Rugs", "Hand-Tufted Rugs", "Hand-Woven Rugs"] },
];
const bedroom: Category[] = [
  { label: "Beds", category: "Bedroom", subcategories: ["Beds", "Bedding", "Sofa-Beds"] },
  { label: "Bedside Tables", category: "Bedroom", subcategories: ["Bedside Tables"] },
  { label: "Bedroom Seating", category: "Seating", subcategories: ["Armchairs", "Daybeds & Benches", "Ottomans & Stools"] },
  { label: "Storage", category: "Storage", subcategories: ["Buffets, Cabinets And Sideboards", "Bookcases"] },
  { label: "Lighting", category: "Lighting", subcategories: ["Table Lights", "Wall Lights", "Floor Lights"] },
  { label: "Textiles & Décor", category: "Décor", subcategories: ["Cushions & Throws", "Mirrors", "Decorative Objects"] },
];

export default function RoomPageNavigation({ room }: { room: RoomSlug }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);
  const categories = room === "office" ? office : room === "dining-room" ? dining : room === "bedroom" ? bedroom : living;
  const navigateCategory = (category: string, subcategory?: string) => {
    const params = new URLSearchParams({ room, view: "grid", category });
    if (subcategory) params.set("subcategory", subcategory);
    navigate(`/search?${params}`);
  };
  return (
    <aside aria-label="Shop By Room" className="w-full shrink-0 border-b border-border bg-background px-5 py-6 md:w-56 md:border-b-0 md:border-r md:px-6 lg:w-64 lg:px-8">
      <h1 className="font-body text-sm font-bold text-foreground">Shop By Room</h1>
      <nav aria-label="Rooms" className="mt-3 flex flex-wrap gap-x-5 gap-y-1 md:flex-col md:gap-1">
        {roomLinks.map(({ label, slug }) => (
          <Button key={slug} type="button" variant="ghost" aria-current={room === slug ? "page" : undefined} onClick={() => navigate(`/search?room=${slug}&view=grid`)} className={cn("h-9 justify-start gap-2 rounded-none px-0 font-body text-xs hover:bg-transparent", room === slug ? "font-semibold text-foreground" : "text-muted-foreground")}>
            <ChevronRight className="size-3 shrink-0" strokeWidth={1.25} />{label}
          </Button>
        ))}
      </nav>
      <nav aria-label="Room categories" className="mt-5 border-t border-border pt-3">
        {categories.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between gap-1">
              <Button type="button" variant="ghost" onClick={() => navigateCategory(item.category)} className="h-9 min-w-0 flex-1 justify-start rounded-none px-0 font-body text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-foreground">{item.label}</Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Show ${item.label} options`} aria-expanded={expanded === item.label} onClick={() => setExpanded(expanded === item.label ? null : item.label)} className="size-9 shrink-0 rounded-none text-muted-foreground hover:bg-transparent hover:text-foreground"><ChevronRight className={cn("size-3 transition-transform", expanded === item.label && "rotate-90")} /></Button>
            </div>
            {expanded === item.label && <div className="mb-2 flex flex-col border-l border-border pl-4">{item.subcategories.map((sub) => <Button key={sub} type="button" variant="ghost" onClick={() => navigateCategory(item.category, sub)} className="h-auto min-h-8 justify-start whitespace-normal rounded-none px-0 py-1 text-left font-body text-xs font-normal leading-snug text-muted-foreground hover:bg-transparent hover:text-foreground">{sub}</Button>)}</div>}
          </div>
        ))}
      </nav>
    </aside>
  );
}
