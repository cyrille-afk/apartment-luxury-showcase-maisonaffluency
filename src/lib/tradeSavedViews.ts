/** Saved Trade Gallery views (search + filters + sort), stored per browser. */
import type { TradeSortMode } from "@/lib/tradeSort";

export interface TradeSavedView {
  id: string;
  name: string;
  search: string;
  brand: string;
  category: string;
  subcategory: string;
  edition: string;
  sortBy: TradeSortMode;
  createdAt: number;
}

const KEY = "ma_trade_gallery_saved_views_v1";

export function readSavedViews(): TradeSavedView[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(views: TradeSavedView[]) {
  localStorage.setItem(KEY, JSON.stringify(views));
}
export const writeSavedViews = write;

/** Saves a view; a view with the same name (case-insensitive) is replaced. */
export function saveView(view: Omit<TradeSavedView, "id" | "createdAt">): TradeSavedView[] {
  const name = view.name.trim() || "Untitled view";
  const others = readSavedViews().filter((v) => v.name.toLowerCase() !== name.toLowerCase());
  const next = [
    ...others,
    { ...view, name, id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: Date.now() },
  ];
  write(next);
  return next;
}

export function deleteView(id: string): TradeSavedView[] {
  const next = readSavedViews().filter((v) => v.id !== id);
  write(next);
  return next;
}
