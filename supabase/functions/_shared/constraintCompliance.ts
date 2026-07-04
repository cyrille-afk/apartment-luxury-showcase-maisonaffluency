// Builds a "constraint compliance" summary for the spec-sheet/tearsheet card.
// Given the constraints extracted from the user's brief and the hydrated picks,
// enumerate each constraint and mark which picks satisfy it (✓ / ✗ / ?).

import {
  parseDimensionsToMm,
  type DimensionConstraints,
  type ParsedRowDimensions,
} from "./dimensionConstraints.ts";
import {
  resolveRowLeadTime,
  type LeadTimeConstraints,
  type BrandLeadTimeEntry,
} from "./leadTimeConstraints.ts";

export type ComplianceStatus = "pass" | "fail" | "unknown";

export type PieceCompliance = {
  pick_id: string;
  title: string;
  status: ComplianceStatus;
  observed: string | null; // human-readable observed value on the piece
};

export type ConstraintCompliance = {
  key: string;                // e.g. "maxLengthMm"
  label: string;              // human-readable
  target: string;             // e.g. "≤ 240 cm"
  pieces: PieceCompliance[];
  passCount: number;
  failCount: number;
  unknownCount: number;
};

export type CompliancePiece = {
  id: string;
  title: string;
  dimensions?: string | null;
  lead_time?: string | null;
  stock_status?: string | null;
  brand_name?: string | null;
  designer_name?: string | null;
  price_cents?: number | null;
  currency?: string | null;
};

const mmToCm = (mm: number) => Math.round(mm / 10);

function labelForDim(key: keyof DimensionConstraints): { label: string; targetPrefix: string; axis: keyof ParsedRowDimensions } {
  const map: Record<keyof DimensionConstraints, { label: string; targetPrefix: string; axis: keyof ParsedRowDimensions }> = {
    maxLengthMm:      { label: "Max length",      targetPrefix: "≤", axis: "lengthMm" },
    minLengthMm:      { label: "Min length",      targetPrefix: "≥", axis: "lengthMm" },
    maxWidthMm:       { label: "Max width",       targetPrefix: "≤", axis: "widthMm" },
    minWidthMm:       { label: "Min width",       targetPrefix: "≥", axis: "widthMm" },
    maxDepthMm:       { label: "Max depth",       targetPrefix: "≤", axis: "depthMm" },
    minDepthMm:       { label: "Min depth",       targetPrefix: "≥", axis: "depthMm" },
    maxHeightMm:      { label: "Max height",      targetPrefix: "≤", axis: "heightMm" },
    minHeightMm:      { label: "Min height",      targetPrefix: "≥", axis: "heightMm" },
    maxDiameterMm:    { label: "Max diameter",    targetPrefix: "≤", axis: "diameterMm" },
    minDiameterMm:    { label: "Min diameter",    targetPrefix: "≥", axis: "diameterMm" },
    minSeatDepthMm:   { label: "Min seat depth",  targetPrefix: "≥", axis: "seatDepthMm" },
    maxSeatDepthMm:   { label: "Max seat depth",  targetPrefix: "≤", axis: "seatDepthMm" },
    maxSeatHeightMm:  { label: "Max seat height", targetPrefix: "≤", axis: "seatHeightMm" },
    minSeatHeightMm:  { label: "Min seat height", targetPrefix: "≥", axis: "seatHeightMm" },
  };
  return map[key];
}

function checkDimConstraint(
  key: keyof DimensionConstraints,
  limitMm: number,
  parsed: ParsedRowDimensions,
): { status: ComplianceStatus; observed: string | null } {
  const info = labelForDim(key);
  const value = parsed[info.axis];
  if (value == null) return { status: "unknown", observed: null };
  const isMax = key.startsWith("max");
  const pass = isMax ? value <= limitMm : value >= limitMm;
  return { status: pass ? "pass" : "fail", observed: `${mmToCm(value)} cm` };
}

export function buildConstraintCompliance(params: {
  dim?: DimensionConstraints | null;
  lead?: LeadTimeConstraints | null;
  budgetCents?: number | null;
  budgetCurrency?: string | null;
  pieces: CompliancePiece[];
  brandLeadIndex?: Map<string, BrandLeadTimeEntry> | null;
}): ConstraintCompliance[] {
  const { dim, lead, budgetCents, budgetCurrency, pieces, brandLeadIndex } = params;
  const out: ConstraintCompliance[] = [];

  // --- Dimension constraints ---
  if (dim) {
    const parsedByPiece = new Map<string, ParsedRowDimensions>();
    for (const p of pieces) parsedByPiece.set(p.id, parseDimensionsToMm(p.dimensions || ""));

    for (const key of Object.keys(dim) as (keyof DimensionConstraints)[]) {
      const limit = dim[key];
      if (typeof limit !== "number") continue;
      const info = labelForDim(key);
      const pieceRows: PieceCompliance[] = pieces.map((p) => {
        const parsed = parsedByPiece.get(p.id)!;
        const chk = checkDimConstraint(key, limit, parsed);
        return { pick_id: p.id, title: p.title, status: chk.status, observed: chk.observed };
      });
      out.push({
        key,
        label: info.label,
        target: `${info.targetPrefix} ${mmToCm(limit)} cm`,
        pieces: pieceRows,
        passCount: pieceRows.filter((r) => r.status === "pass").length,
        failCount: pieceRows.filter((r) => r.status === "fail").length,
        unknownCount: pieceRows.filter((r) => r.status === "unknown").length,
      });
    }
  }

  // --- Lead-time constraints ---
  if (lead) {
    const parsedLead = new Map<string, ReturnType<typeof resolveRowLeadTime>>();
    for (const p of pieces) parsedLead.set(p.id, resolveRowLeadTime(p, brandLeadIndex ?? null));

    if (lead.inStockOnly) {
      const pieceRows: PieceCompliance[] = pieces.map((p) => {
        const parsed = parsedLead.get(p.id);
        if (!parsed) return { pick_id: p.id, title: p.title, status: "unknown", observed: null };
        const status: ComplianceStatus = parsed.isInStock ? "pass" : "fail";
        return { pick_id: p.id, title: p.title, status, observed: parsed.isInStock ? "in stock" : `${parsed.minWeeks}–${parsed.maxWeeks} wks` };
      });
      out.push({
        key: "inStockOnly",
        label: "In stock only",
        target: "in stock",
        pieces: pieceRows,
        passCount: pieceRows.filter((r) => r.status === "pass").length,
        failCount: pieceRows.filter((r) => r.status === "fail").length,
        unknownCount: pieceRows.filter((r) => r.status === "unknown").length,
      });
    } else {
      if (typeof lead.maxWeeks === "number") {
        const cap = lead.maxWeeks;
        const pieceRows: PieceCompliance[] = pieces.map((p) => {
          const parsed = parsedLead.get(p.id);
          if (!parsed) return { pick_id: p.id, title: p.title, status: "unknown", observed: null };
          const observed = parsed.isInStock ? "in stock" : (parsed.minWeeks === parsed.maxWeeks ? `${parsed.maxWeeks} wks` : `${parsed.minWeeks}–${parsed.maxWeeks} wks`);
          const status: ComplianceStatus = parsed.minWeeks <= cap ? "pass" : "fail";
          return { pick_id: p.id, title: p.title, status, observed };
        });
        out.push({
          key: "maxLeadWeeks",
          label: "Max lead time",
          target: `≤ ${cap} wks`,
          pieces: pieceRows,
          passCount: pieceRows.filter((r) => r.status === "pass").length,
          failCount: pieceRows.filter((r) => r.status === "fail").length,
          unknownCount: pieceRows.filter((r) => r.status === "unknown").length,
        });
      }
      if (typeof lead.minWeeks === "number") {
        const floor = lead.minWeeks;
        const pieceRows: PieceCompliance[] = pieces.map((p) => {
          const parsed = parsedLead.get(p.id);
          if (!parsed) return { pick_id: p.id, title: p.title, status: "unknown", observed: null };
          const observed = parsed.isInStock ? "in stock" : (parsed.minWeeks === parsed.maxWeeks ? `${parsed.maxWeeks} wks` : `${parsed.minWeeks}–${parsed.maxWeeks} wks`);
          const status: ComplianceStatus = parsed.maxWeeks >= floor ? "pass" : "fail";
          return { pick_id: p.id, title: p.title, status, observed };
        });
        out.push({
          key: "minLeadWeeks",
          label: "Min lead time",
          target: `≥ ${floor} wks`,
          pieces: pieceRows,
          passCount: pieceRows.filter((r) => r.status === "pass").length,
          failCount: pieceRows.filter((r) => r.status === "fail").length,
          unknownCount: pieceRows.filter((r) => r.status === "unknown").length,
        });
      }
    }
  }

  // --- Budget ceiling (per-piece) ---
  if (typeof budgetCents === "number" && budgetCents > 0) {
    const cur = budgetCurrency || "EUR";
    const pieceRows: PieceCompliance[] = pieces.map((p) => {
      if (typeof p.price_cents !== "number" || p.price_cents <= 0) {
        return { pick_id: p.id, title: p.title, status: "unknown", observed: "Price on Request" };
      }
      const status: ComplianceStatus = p.price_cents <= budgetCents ? "pass" : "fail";
      return { pick_id: p.id, title: p.title, status, observed: `${p.currency || cur} ${Math.round(p.price_cents / 100).toLocaleString("en-US")}` };
    });
    out.push({
      key: "maxUnitBudget",
      label: "Max unit budget",
      target: `≤ ${cur} ${Math.round(budgetCents / 100).toLocaleString("en-US")}`,
      pieces: pieceRows,
      passCount: pieceRows.filter((r) => r.status === "pass").length,
      failCount: pieceRows.filter((r) => r.status === "fail").length,
      unknownCount: pieceRows.filter((r) => r.status === "unknown").length,
    });
  }

  return out;
}

/** Render a compact plain-text summary suitable for the tearsheet `note`. */
export function renderComplianceNote(compliance: ConstraintCompliance[]): string {
  if (!compliance.length) return "";
  const lines: string[] = ["Constraint compliance:"];
  for (const c of compliance) {
    const total = c.pieces.length;
    const bits: string[] = [`${c.passCount}/${total} pass`];
    if (c.failCount) bits.push(`${c.failCount} fail`);
    if (c.unknownCount) bits.push(`${c.unknownCount} unknown`);
    lines.push(`• ${c.label} (${c.target}) — ${bits.join(", ")}`);
    // list any failures explicitly so the reader knows which pieces to swap
    const fails = c.pieces.filter((p) => p.status === "fail");
    if (fails.length) {
      lines.push(`   ✗ ${fails.map((f) => `${f.title}${f.observed ? ` (${f.observed})` : ""}`).join("; ")}`);
    }
  }
  return lines.join("\n");
}
