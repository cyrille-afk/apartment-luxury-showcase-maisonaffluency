import { useMemo } from "react";
import { useDbCuratorPicks } from "@/hooks/useDbCuratorPicks";
import { getRoomPreviewScene, type RoomPreviewScene } from "@/lib/roomPreviewScenes";

type RotatingRoom = "bedroom" | "living-room" | "dining-room" | "office";

const ROOM_SUBCATEGORIES: Record<RotatingRoom, string[]> = {
  bedroom: ["Table Lights"],
  "living-room": ["Coffee Tables"],
  "dining-room": ["Dining Tables"],
  office: ["Desks", "Desk"],
};

/** A fresh, distinct public-catalog trio for each room mount, stable while it is open. */
export function useRoomPreviewScene(slug?: string | null): RoomPreviewScene {
  const { data: catalog } = useDbCuratorPicks();
  return useMemo(() => {
    const base = getRoomPreviewScene(slug);
    if (!slug || !(slug in ROOM_SUBCATEGORIES) || !catalog) return base;

    const subcategories = ROOM_SUBCATEGORIES[slug as RotatingRoom];
    const matches = catalog.filter(({ pick }) =>
      pick.id && pick.image &&
      (slug !== "office" || /\bdesk\b/i.test(pick.title)) &&
      subcategories.some((subcategory) =>
        pick.subcategory?.trim().toLowerCase() === subcategory.toLowerCase(),
      ),
    );
    if (matches.length < 3) return base;

    // Partial Fisher–Yates: exactly three unique indices, without sorting
    // randomly or mutating the query's shared catalog array.
    const pool = [...matches];
    const pieces = Array.from({ length: 3 }, (_, index) => {
      const randomIndex = index + Math.floor(Math.random() * (pool.length - index));
      [pool[index], pool[randomIndex]] = [pool[randomIndex], pool[index]];
      const { pick, designerName } = pool[index];
      return {
        src: pick.image || "",
        alt: `${pick.title} by ${designerName}`,
        name: pick.title,
        designer: designerName,
      };
    });

    return { ...base, pieces, highlightIndex: 0 };
  }, [catalog, slug]);
}