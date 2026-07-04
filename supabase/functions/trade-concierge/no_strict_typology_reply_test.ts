import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildNoStrictTypologyReply } from "./_no_strict_typology_reply.ts";

// Regression: previously this template read as a fabricated self-correction
// ("You're right — I won't present adjacent pieces…") and advertised a
// non-existent "Axonometric Studio archives" fallback search. Neither
// pattern is allowed to come back.

const FORBIDDEN_PATTERNS: RegExp[] = [
  /you'?re right/i,
  /i won'?t present/i,
  /adjacent pieces/i,
  /credible edit/i,
  /axonometric/i,
  /archives?/i,
  /designers'?\s+own\s+collections?/i,
  /expand (the|my) search/i,
  /apolog(y|ise|ize)/i,
  /sorry/i,
];

for (const typology of ["dining_table", "table"] as const) {
  Deno.test(`buildNoStrictTypologyReply(${typology}) — no fake apology, no external archive claim`, () => {
    const reply = buildNoStrictTypologyReply(typology);
    assert(reply.length > 0, "reply must not be empty");
    for (const pat of FORBIDDEN_PATTERNS) {
      assert(
        !pat.test(reply),
        `reply must not match ${pat} — got: ${JSON.stringify(reply)}`,
      );
    }
    // Must clearly signal the suppression happened and stay concise.
    assertStringIncludes(reply.toLowerCase(), "tearsheet");
    assert(reply.length < 400, `reply should stay concise; got ${reply.length} chars`);
    // Must be prefixed with blank lines so it never glues onto prior streamed prose.
    assert(reply.startsWith("\n\n"), "reply must start with blank lines to separate from prior stream");
  });
}
