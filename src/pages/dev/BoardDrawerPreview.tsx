import { useState } from "react";
import { ProjectBoardDrawer } from "@/components/trade/ProjectBoardDrawer";
import type { PickPreview } from "@/lib/tradeConciergeStream";

const MOCK = [
  {
    id: "1",
    title: "X Stool (Round) c. 1934",
    brand_name: "Jean-Michel Frank",
    image_url: "",
    price_cents: 368000,
    currency: "EUR",
    lead_time: "14 weeks",
  },
  {
    id: "2",
    title: "Soleil Coffee Table c. 1930",
    brand_name: "Jean-Michel Frank",
    image_url: "",
    price_cents: 598000,
    currency: "EUR",
    lead_time: "",
  },
] as unknown as PickPreview[];

export default function BoardDrawerPreview() {
  const [open, setOpen] = useState(true);
  const [items, setItems] = useState<PickPreview[]>(MOCK);
  return (
    <div className="min-h-screen bg-background p-10">
      <button onClick={() => setOpen(true)} className="rounded-full border px-4 py-2">
        Open board drawer
      </button>
      <ProjectBoardDrawer
        open={open}
        onClose={() => setOpen(false)}
        items={items}
        projectName="Preview Project"
        onRemove={(id) => setItems((p) => p.filter((i) => i.id !== id))}
      />
    </div>
  );
}
