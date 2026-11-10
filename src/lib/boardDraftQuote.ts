import { clientUnitCents, tradePriceCents } from "@/lib/tradePricing";

export type BoardDraftSource = {
  id: string; product_id: string; product_name: string; approval_status: string;
  quantity: number; currency: string; retailCents: number | null; netCents?: number | null;
  finish: { label: string; top?: string | null; base?: string | null; top_image?: string | null; base_image?: string | null; extra?: { name: string; img: string | null }[] } | null;
  requested: boolean;
};

export function latestBoardFinishRequests(entries: { id: string; item_id: string; comment: string | null; created_at: string }[]) {
  const result: Record<string, string> = {};
  for (const entry of [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))) {
    const value = entry.comment?.match(/^Finish request:\s*([^\r\n]+)$/)?.[1]?.trim();
    if (value && !(entry.item_id in result)) result[entry.item_id] = value;
  }
  return result;
}

export function compileBoardDraftQuote(sources: BoardDraftSource[], discount: number, multiplier: number) {
  const lines = sources.filter((item) => item.approval_status === "approved").map((item) => {
    const quantity = Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : null;
    const net = item.netCents ?? tradePriceCents(item.retailCents, discount);
    const client = clientUnitCents(item.retailCents, discount, multiplier);
    return { ...item, quantity, netUnitCents: net, clientUnitCents: client,
      netTotalCents: quantity !== null && net !== null ? quantity * net : null,
      clientTotalCents: quantity !== null && client !== null ? quantity * client : null };
  });
  const totals: Record<string, { net: number; client: number }> = {};
  for (const line of lines) {
    if (line.netTotalCents === null || line.clientTotalCents === null) continue;
    const total = totals[line.currency] ?? { net: 0, client: 0 };
    totals[line.currency] = { net: total.net + line.netTotalCents, client: total.client + line.clientTotalCents };
  }
  return { lines, totals, ready: lines.length > 0 && lines.every((line) => line.quantity !== null && line.netUnitCents !== null && line.clientUnitCents !== null), reviewOnly: true as const };
}