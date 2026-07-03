// Requirements-diff enforcement mode resolver.
//
// Extracted to its own module so tests can exercise the precedence rules
// without importing the whole trade-concierge/index.ts module (which pulls
// in the entire streaming pipeline).
//
// Precedence:
//   1. CONCIERGE_REQUIREMENTS_ENFORCEMENT=closed → closed
//   2. CONCIERGE_REQUIREMENTS_ENFORCEMENT=open   → open (wins over legacy)
//   3. CONCIERGE_REQUIREMENTS_STRICT=true|1|yes  → closed (legacy fallback)
//   4. anything else / missing                   → open

export type RequirementsEnforcement = "open" | "closed";

export function resolveRequirementsEnforcement(env: {
  CONCIERGE_REQUIREMENTS_ENFORCEMENT?: string | null;
  CONCIERGE_REQUIREMENTS_STRICT?: string | null;
}): RequirementsEnforcement {
  const explicit = (env.CONCIERGE_REQUIREMENTS_ENFORCEMENT || "").toLowerCase().trim();
  if (explicit === "closed") return "closed";
  if (explicit === "open") return "open";
  const legacy = (env.CONCIERGE_REQUIREMENTS_STRICT || "").toLowerCase().trim();
  if (legacy === "true" || legacy === "1" || legacy === "yes") return "closed";
  return "open";
}
