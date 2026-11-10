import { useMemo } from "react";
import { compileBoardDraftQuote, type BoardDraftSource } from "@/lib/boardDraftQuote";

/** Derived, board-scoped review snapshot: approval changes never create orders or invoices. */
export function useDraftQuoteCompiler(items: BoardDraftSource[], discount: number, multiplier: number) {
  return useMemo(() => compileBoardDraftQuote(items, discount, multiplier), [items, discount, multiplier]);
}