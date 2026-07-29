export type RequestedTypology =
  | "dining_table"
  | "table"
  | "seating"
  | "lighting"
  | "storage"
  | "bedroom_furniture"
  | "rugs"
  | "decor";

export function typologyLabel(typology: RequestedTypology | RequestedTypology[] | null): string {
  if (Array.isArray(typology)) {
    const labels = typology.map((t) => typologyLabel(t)).filter(Boolean);
    if (labels.length === 0) return "piece";
    if (labels.length === 1) return labels[0];
    return labels.join(" + ");
  }
  if (typology === "dining_table") return "dining table";
  if (typology === "table") return "table";
  if (typology === "seating") return "seating";
  if (typology === "lighting") return "lighting";
  if (typology === "storage") return "storage";
  if (typology === "bedroom_furniture") return "bedroom furniture";
  if (typology === "rugs") return "rugs";
  if (typology === "decor") return "decorative objects";
  return "piece";
}

export function buildNoStrictTypologyReply(typology: RequestedTypology | RequestedTypology[]): string {
  const label = typologyLabel(typology);
  // Prepended blank lines so this release notice never glues onto whatever
  // prose the model already streamed in the same turn (which read as a
  // fabricated self-correction / apology). Must not invent an apology or
  // advertise external archives — enforced by no_strict_typology_reply_test.ts.
  return `\n\n_(A tearsheet draft was suppressed: fewer than 2 true ${label}s matched this brief in the curated selection. Ask me to broaden the typology or relax a constraint if you'd like me to try again.)_`;
}
