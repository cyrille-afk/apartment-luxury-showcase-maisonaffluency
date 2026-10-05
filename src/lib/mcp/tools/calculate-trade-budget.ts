import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

// Maison Affluency Trade Margin Budget Calculator.
// Pure arithmetic — no database access, no caller identity required.

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default defineTool({
  name: "calculate_trade_budget",
  title: "Trade Margin Budget Calculator",
  description:
    "Calculates the Maison Affluency trade budget for a project or product selection: net trade cost after trade discount, logistics fee, total cost to the designer, suggested client price after the designer's markup, and designer net profit. All amounts are in the same currency as totalRetailValue. Pure calculation — no catalogue lookup.",
  inputSchema: {
    totalRetailValue: z
      .number()
      .positive()
      .describe("Total retail (RRP) value of the selection, in any single currency."),
    tradeDiscountPercentage: z
      .union([z.number(), z.enum(["Platinum Tier", "Gold Tier", "Silver Tier"])])
      .default(15)
      .describe(
        "Trade discount percentage off retail, or a Maison Affluency tier name. Defaults to 15 (Platinum Tier). Tiers: 'Platinum Tier' = 15%, 'Gold Tier' = 12%, 'Silver Tier' = 10%."
      ),
    logisticsFeePercentage: z
      .number()
      .min(0)
      .max(100)
      .default(5)
      .describe("Logistics/delivery fee as a percentage of the net trade cost. Defaults to 5 (Singapore delivery)."),
    clientMarkupPercentage: z
      .number()
      .min(0)
      .max(500)
      .optional()
      .describe("Designer's markup percentage on top of total cost, to derive the suggested client price. Optional; omit for cost-only breakdown."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (input) => {
    const totalRetailValue = input.totalRetailValue;
    const logisticsFeePercentage = input.logisticsFeePercentage;
    const clientMarkupPercentage = input.clientMarkupPercentage;
    const markup = clientMarkupPercentage ?? 0;

    // Resolve tier names ("Platinum Tier" etc.) to their discount percentage.
    const TIER_DISCOUNTS: Record<string, number> = {
      "Platinum Tier": 15,
      "Gold Tier": 12,
      "Silver Tier": 10,
    };
    const tradeDiscountPercentage =
      typeof input.tradeDiscountPercentage === "string"
        ? TIER_DISCOUNTS[input.tradeDiscountPercentage] ?? 15
        : input.tradeDiscountPercentage;

    const netTradeCost = round2(totalRetailValue * (1 - tradeDiscountPercentage / 100));
    const logisticsCost = round2(netTradeCost * (logisticsFeePercentage / 100));
    const totalCostToDesigner = round2(netTradeCost + logisticsCost);
    const suggestedClientPrice = round2(totalCostToDesigner * (1 + markup / 100));
    const designerNetProfit = round2(suggestedClientPrice - totalCostToDesigner);

    // Label the discount line with the tier when the percentage matches a tier.
    const tierLabel = Object.entries(TIER_DISCOUNTS).find(
      ([, pct]) => pct === tradeDiscountPercentage
    )?.[0];

    const summary = [
      "MAISON AFFLUENCY — TRADE MARGIN BUDGET",
      "",
      `Retail value ............... ${fmt(totalRetailValue)}`,
      `Trade discount (${tradeDiscountPercentage}%${tierLabel ? ` ${tierLabel}` : ""}) ...... −${fmt(round2(totalRetailValue - netTradeCost))}`,
      `Net trade cost ............. ${fmt(netTradeCost)}`,
      `Logistics (${logisticsFeePercentage}%) ............ ${fmt(logisticsCost)}`,
      `Total cost to designer ..... ${fmt(totalCostToDesigner)}`,
      `Client markup (${markup}%) ......... ${fmt(round2(suggestedClientPrice - totalCostToDesigner))}`,
      `Suggested client price ..... ${fmt(suggestedClientPrice)}`,
      `Designer net profit ........ ${fmt(designerNetProfit)}`,
      "",
      "All figures in the same currency as the retail value supplied.",
    ].join("\n");

    return {
      content: [{ type: "text", text: summary }],
      structuredContent: {
        netTradeCost,
        logisticsCost,
        totalCostToDesigner,
        suggestedClientPrice,
        designerNetProfit,
      },
    };
  },
});
