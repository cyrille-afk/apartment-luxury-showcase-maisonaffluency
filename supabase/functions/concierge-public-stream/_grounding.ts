// Deterministic grounding layer for concierge-public-stream.
//
// The public concierge previously had zero retrieval and relied on the system
// prompt's 5 name-drops to keep the model on-brand. That left every reply
// open to hallucinated designer names, invented ateliers, and made-up pieces.
//
// This module injects a verified roster snippet on every turn so the model
// can only cite names Maison Affluency actually represents. Two blocks:
//
//   • ROSTER_NAMES_BLOCK — a compact, cache-friendly bare-name list of ALL
//     published designers (~4.6 kB). Included in every request as an
//     authoritative allow-list. The model is instructed never to name a
//     designer, atelier, or piece not on the list.
//
//   • buildQuerySpecialties(query) — a lightweight per-turn slice: when the
//     user's message mentions a roster name, we append its full specialty
//     line so the model has a real fact to quote from instead of
//     paraphrasing training data.
//
// The roster is a build-time snapshot. Regenerate with the companion script
// in scripts/build-public-concierge-roster.ts after the designer table
// changes materially.

import { ROSTER, type RosterEntry } from "./_roster.ts";

/**
 * Precomputed lowercase name -> RosterEntry index for O(1) mention lookup.
 * Frozen at module load; the roster never mutates at runtime.
 */
const ROSTER_INDEX: ReadonlyMap<string, RosterEntry> = (() => {
  const map = new Map<string, RosterEntry>();
  for (const entry of ROSTER) {
    map.set(entry.name.toLowerCase(), entry);
  }
  return map;
})();

/**
 * The bare-name allow-list. This is the block that closes the hallucination
 * surface: the model has explicit, exhaustive knowledge of who is on the
 * roster and must refuse to invent any name that isn't here.
 *
 * Names are joined by " · " (compact + visually distinct in the prompt).
 * Roughly 4.6 kB — well under any model's system-prompt cache ceiling.
 */
export const ROSTER_NAMES_BLOCK: string = ROSTER
  .map((r) => r.name)
  .join(" · ");

/**
 * Extract specialty facts for any roster names mentioned in the user's
 * turn. Returns a newline-joined block of `Name — specialty` lines, or an
 * empty string when nothing on the roster is mentioned.
 *
 * Matching is case-insensitive substring on the roster name. This is
 * intentionally loose: "Do you carry Chareau?" should match "Pierre Chareau".
 * The trade-off is that a very short/generic roster name (e.g. "Ozone")
 * could match unrelated text — acceptable because the specialty line only
 * gives the model MORE truthful context, never overrides the allow-list.
 */
export function buildQuerySpecialties(query: string): string {
  if (!query || query.length < 3) return "";
  const q = query.toLowerCase();
  const hits: RosterEntry[] = [];
  for (const [key, entry] of ROSTER_INDEX) {
    // Fast reject on the first two chars — cheap prefilter over 276 entries.
    if (key.length < 3) continue;
    if (q.includes(key)) {
      hits.push(entry);
      continue;
    }
    // Also try the last name alone for multi-word entries (e.g. "Chareau"
    // should match "Pierre Chareau"). Only when the surname is ≥5 chars so
    // we don't hit generic tokens.
    const parts = key.split(/\s+/);
    if (parts.length > 1) {
      const surname = parts[parts.length - 1];
      if (surname.length >= 5 && q.includes(surname)) hits.push(entry);
    }
  }
  if (hits.length === 0) return "";
  // Dedupe (a query may hit a name and its surname).
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const h of hits) {
    if (seen.has(h.name)) continue;
    seen.add(h.name);
    if (h.specialty) lines.push(`${h.name} — ${h.specialty}`);
    else lines.push(h.name);
  }
  // Cap at 8 hits to keep the block bounded on a query that name-drops
  // heavily. The allow-list block already carries the full roster.
  return lines.slice(0, 8).join("\n");
}

/**
 * Assemble the full grounding block that gets appended to the system
 * prompt. Structure:
 *
 *   [Verified roster — 276 designers/ateliers]
 *   Name1 · Name2 · Name3 · ...
 *
 *   [Details for this query]
 *   Pierre Chareau — Radical light. Industrial modernism.
 *   Andrée Putman — Interior Design & Furniture
 *
 *   [Grounding rule]
 *   Cite names ONLY from the roster above. If asked about anyone not
 *   listed, say the gallery may still be able to source them and offer
 *   to note the enquiry — do NOT invent a bio, piece, or provenance.
 */
export function buildGroundingBlock(query: string): string {
  const specialties = buildQuerySpecialties(query);
  const parts: string[] = [
    "[Verified Maison Affluency roster — the ONLY designers, studios, and ateliers you may name]",
    ROSTER_NAMES_BLOCK,
  ];
  if (specialties) {
    parts.push("");
    parts.push("[Facts for this query — quote from these lines, don't paraphrase from memory]");
    parts.push(specialties);
  }
  parts.push("");
  parts.push(
    "[Grounding rule] Never name a designer, atelier, piece, exhibition, or " +
      "collaborator outside the roster above. When a visitor asks about someone " +
      "not listed, say the gallery may still be able to source them and offer " +
      "to note the enquiry for our director — do not fabricate a biography, " +
      "piece, price, provenance, or affiliation. Do not describe specific works " +
      "unless the visitor named them first.",
  );
  return parts.join("\n");
}

/** Testing helper — exposed so unit tests can assert the roster shape. */
export const _test = { ROSTER_INDEX, ROSTER };
