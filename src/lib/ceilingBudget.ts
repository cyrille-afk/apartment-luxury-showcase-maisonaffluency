export interface CeilingBudgetInput {
  targetCeilingCents: number;
  clientMarkupPct: number;
  tradeDiscountPct: number;
  tierLabel?: string | null;
}

export interface CeilingBudgetSummary extends CeilingBudgetInput {
  designerNetProfitCents: number;
  maxDesignerCostCents: number;
  tradeSourcingMarkdownCents: number;
  netPurchasingBudgetCents: number;
}

/**
 * Top-down budget arithmetic uses the client ceiling as the fixed endpoint.
 * Percentages are whole percentages (15 means 15%, not 0.15).
 */
export function calculateCeilingBudget(input: CeilingBudgetInput): CeilingBudgetSummary {
  const targetCeilingCents = Math.max(0, Math.round(input.targetCeilingCents));
  const clientMarkupPct = Math.max(0, Number(input.clientMarkupPct) || 0);
  const tradeDiscountPct = Math.min(100, Math.max(0, Number(input.tradeDiscountPct) || 0));
  const maxDesignerCostCents = Math.round(targetCeilingCents / (1 + clientMarkupPct / 100));
  const designerNetProfitCents = targetCeilingCents - maxDesignerCostCents;
  const tradeSourcingMarkdownCents = Math.round(maxDesignerCostCents * tradeDiscountPct / 100);
  const netPurchasingBudgetCents = maxDesignerCostCents - tradeSourcingMarkdownCents;

  return {
    ...input,
    targetCeilingCents,
    clientMarkupPct,
    tradeDiscountPct,
    designerNetProfitCents,
    maxDesignerCostCents,
    tradeSourcingMarkdownCents,
    netPurchasingBudgetCents,
  };
}