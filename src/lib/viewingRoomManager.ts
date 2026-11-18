import { z } from "zod";
import { has3dAsset } from "./visualiserCatalog";

export const managerBoardsSchema = z.array(z.object({
  id: z.string(), title: z.string(), items: z.array(z.object({
    id: z.string(), name: z.string().nullable(), image: z.string().nullable(), glb_url: z.string().nullable(),
    price_cents: z.number().nullable(), price_from: z.boolean(),
  })),
}));
export type ManagerBoard = z.infer<typeof managerBoardsSchema>[number];
export function managerBoardSummary(board: ManagerBoard) {
  const ready = board.items.filter(has3dAsset).length;
  return { count: board.items.length, ready, isReady: board.items.length > 0 && ready === board.items.length,
    totalCents: board.items.reduce((sum, item) => sum + (item.price_cents ?? 0), 0),
    unpriced: board.items.filter(item => item.price_cents == null).length,
    from: board.items.some(item => item.price_from) };
}