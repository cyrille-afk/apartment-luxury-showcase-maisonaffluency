export type RequestedTypology = "dining_table" | "table";

export function typologyLabel(typology: RequestedTypology | null): string {
  if (typology === "dining_table") return "dining table";
  if (typology === "table") return "table";
  return "piece";
}

export function buildNoStrictTypologyReply(typology: RequestedTypology): string {
  const label = typologyLabel(typology);
  // Prepended blank lines so this release notice never glues onto whatever
  // prose the model already streamed in the same turn (which read as a
  // fabricated self-correction / apology). Must not invent an apology or
  // advertise external archives — enforced by no_strict_typology_reply_test.ts.
  return `\n\n_(A tearsheet draft was suppressed: fewer than 2 true ${label}s matched this brief in the curated selection. Ask me to broaden the typology or relax a constraint if you'd like me to try again.)_`;
}
