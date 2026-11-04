import { useEffect, useMemo, useRef } from "react";
import { useDbCuratorPicks, type DbProductItem } from "@/hooks/useDbCuratorPicks";
import { getRoomPreviewScene, type RoomPreviewScene } from "@/lib/roomPreviewScenes";
import { preloadImage } from "@/lib/curatorPickPreload";

type RotatingRoom = "bedroom" | "living-room" | "dining-room" | "office";

const ROOM_SUBCATEGORIES: Record<RotatingRoom, string[]> = {
  bedroom: ["Table Lights"],
  "living-room": ["Coffee Tables"],
  "dining-room": ["Dining Tables"],
  office: ["Desks", "Desk"],
};

const productHref = ({ pick, designerId }: DbProductItem) =>
  `/designers/${designerId}/${pick.slug || pick.id}`;

/** A fresh, distinct public-catalog trio for each room mount, stable while it is open. */
export function resolveRoomPreviewScene(catalog: DbProductItem[] | undefined, slug?: string | null, isLoading = false): RoomPreviewScene {
    const base = getRoomPreviewScene(slug);
    if (!slug || !(slug in ROOM_SUBCATEGORIES)) return base;
    if (!catalog) return isLoading ? { ...base, pending: true } : base;

    // Static fallback pieces still link when their title exists in the public catalog.
    const byTitle = new Map(catalog.map((item) => [item.pick.title.trim().toLowerCase(), item]));
    const linkedBase = {
      ...base,
      pieces: base.pieces.map((piece) => {
        const match = piece.name ? byTitle.get(piece.name.trim().toLowerCase()) : undefined;
        return match ? { ...piece, href: productHref(match) } : piece;
      }),
    };

    const subcategories = ROOM_SUBCATEGORIES[slug as RotatingRoom];
    const seen = new Set<string>();
    const matches = catalog.filter(({ pick }) => {
      if (!pick.id || !pick.image) return false;
      if (slug === "office" && !/\bdesk\b/i.test(pick.title)) return false;
      if (!subcategories.some((subcategory) => pick.subcategory?.trim().toLowerCase() === subcategory.toLowerCase())) return false;
      // Brand/designer twins share the same image or base title — keep one.
      const titleKey = pick.title.toLowerCase().split(/\s+(?:by|for)\s+/)[0].trim();
      if (seen.has(pick.image) || seen.has(titleKey)) return false;
      seen.add(pick.image); seen.add(titleKey);
      return true;
    });
    if (matches.length < 3) return linkedBase;

    // Partial Fisher–Yates: exactly three unique indices, without sorting
    // randomly or mutating the query's shared catalog array.
    const pool = [...matches];
    const pieces = Array.from({ length: 3 }, (_, index) => {
      const randomIndex = index + Math.floor(Math.random() * (pool.length - index));
      [pool[index], pool[randomIndex]] = [pool[randomIndex], pool[index]];
      const item = pool[index];
      return {
        src: item.pick.image || "",
        alt: `${item.pick.title} by ${item.designerName}`,
        name: item.pick.title,
        designer: item.designerName,
        href: productHref(item),
      };
    });

    return { ...base, pieces, highlightIndex: 0 };
}

export function useRoomPreviewScene(slug?: string | null, prepared?: RoomPreviewScene): RoomPreviewScene {
  const { data: catalog, isLoading } = useDbCuratorPicks();
  return useMemo(() => prepared ?? resolveRoomPreviewScene(catalog, slug, isLoading), [catalog, isLoading, slug, prepared]);
}

/** Prepare the next room trio before it mounts, keeping per-opening variation. */
export function useWarmRoomPreviewScenes(catalog: DbProductItem[] | undefined, visit: string) {
  const next = useRef<{ catalog: DbProductItem[]; scenes: Record<string, RoomPreviewScene> } | null>(null);
  const scenes = useMemo(() => {
    if (catalog && next.current?.catalog === catalog) return next.current.scenes;
    return Object.fromEntries(Object.keys(ROOM_SUBCATEGORIES).map((slug) => [slug, resolveRoomPreviewScene(catalog, slug, !catalog)]));
  }, [catalog, visit]);
  useEffect(() => {
    if (!catalog) return;
    const prepared = Object.fromEntries(Object.keys(ROOM_SUBCATEGORIES).map((slug) => [slug, resolveRoomPreviewScene(catalog, slug)]));
    next.current = { catalog, scenes: prepared };
    for (const scene of [...Object.values(scenes), ...Object.values(prepared)]) {
      void preloadImage(scene.previewImage.src, "low");
      scene.pieces.forEach((piece) => { void preloadImage(piece.src, "low"); });
    }
  }, [catalog, scenes]);
  return scenes;
}
