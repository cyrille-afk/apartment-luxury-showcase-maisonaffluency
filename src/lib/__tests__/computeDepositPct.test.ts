import { describe, it, expect } from "vitest";
import {
  computeWeightedDepositPct,
  isLineInStock,
  type DepositLineInput,
} from "../computeDepositPct";

/**
 * Guard-rail: the downloaded quote PDF must immediately reflect 100% upfront
 * payment terms as soon as a product's `stock_status_override` flips to
 * `in_stock`, or `lead_weeks_max_override` is set to 0. This mirrors the
 * deposit calculation performed at PDF-build time in
 * `src/components/trade/QuoteDetail.tsx`.
 */
describe("computeWeightedDepositPct — stock/lead overrides", () => {
  const baseLine: DepositLineInput = { lineCents: 100_000 };

  it("defaults to 60% when nothing is in stock", () => {
    expect(computeWeightedDepositPct([baseLine, baseLine])).toBeCloseTo(0.6, 10);
  });

  it("flips to 100% the moment stock_status_override === 'in_stock'", () => {
    const line = { ...baseLine, stock_status_override: "in_stock" };
    expect(isLineInStock(line)).toBe(true);
    expect(computeWeightedDepositPct([line])).toBe(1);
  });

  it("flips to 100% the moment lead_weeks_max_override === 0", () => {
    const line = { ...baseLine, lead_weeks_max_override: 0 };
    expect(isLineInStock(line)).toBe(true);
    expect(computeWeightedDepositPct([line])).toBe(1);
  });

  it("does NOT flip for lead_weeks_max_override > 0", () => {
    const line = { ...baseLine, lead_weeks_max_override: 8 };
    expect(isLineInStock(line)).toBe(false);
    expect(computeWeightedDepositPct([line])).toBeCloseTo(0.6, 10);
  });

  it("treats per-line lead_weeks_override of 0 as in-stock", () => {
    const line = { ...baseLine, lead_weeks_override: 0 };
    expect(computeWeightedDepositPct([line])).toBe(1);
  });

  it("respects an explicit deposit_pct_override even when in stock", () => {
    const line = {
      ...baseLine,
      stock_status_override: "in_stock",
      deposit_pct_override: 0.5,
    };
    expect(computeWeightedDepositPct([line])).toBe(0.5);
  });

  it("weights mixed in-stock / made-to-order lines correctly", () => {
    const inStock: DepositLineInput = {
      lineCents: 100_000,
      stock_status_override: "in_stock",
    };
    const mto: DepositLineInput = { lineCents: 100_000 };
    // (100k * 1.0 + 100k * 0.6) / 200k = 0.8
    expect(computeWeightedDepositPct([inStock, mto])).toBeCloseTo(0.8, 10);
  });

  it("simulates a stock_status_override flip producing a fresh 100% PDF total", () => {
    const line: DepositLineInput = { lineCents: 250_000 };
    // Before override: 60% deposit
    expect(computeWeightedDepositPct([line])).toBeCloseTo(0.6, 10);
    // After admin flips stock_status_override -> in_stock
    const flipped = { ...line, stock_status_override: "in_stock" };
    expect(computeWeightedDepositPct([flipped])).toBe(1);
  });

  it("simulates a lead_weeks_max_override -> 0 flip producing 100% upfront", () => {
    const line: DepositLineInput = { lineCents: 500_000, lead_weeks_max_override: 12 };
    expect(computeWeightedDepositPct([line])).toBeCloseTo(0.6, 10);
    const flipped = { ...line, lead_weeks_max_override: 0 };
    expect(computeWeightedDepositPct([flipped])).toBe(1);
  });

  it("ignores zero-value lines", () => {
    const lines: DepositLineInput[] = [
      { lineCents: 0, stock_status_override: "in_stock" },
      { lineCents: 100_000 },
    ];
    expect(computeWeightedDepositPct(lines)).toBeCloseTo(0.6, 10);
  });
});
