// Unit tests for `resolveRequirementsEnforcement` — the precedence rules that
// decide whether the requirements validator runs in fail-open (default) or
// fail-closed (blocks card emission) mode.
//
// Precedence:
//   1. CONCIERGE_REQUIREMENTS_ENFORCEMENT=closed → closed
//   2. CONCIERGE_REQUIREMENTS_ENFORCEMENT=open   → open (wins over legacy)
//   3. CONCIERGE_REQUIREMENTS_STRICT=true|1|yes  → closed (legacy fallback)
//   4. anything else / missing                   → open

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveRequirementsEnforcement } from "./_requirements_enforcement.ts";

Deno.test("enforcement — defaults to 'open' when no env vars are set", () => {
  assertEquals(resolveRequirementsEnforcement({}), "open");
});

Deno.test("enforcement — CONCIERGE_REQUIREMENTS_ENFORCEMENT=closed → closed", () => {
  assertEquals(
    resolveRequirementsEnforcement({ CONCIERGE_REQUIREMENTS_ENFORCEMENT: "closed" }),
    "closed",
  );
});

Deno.test("enforcement — explicit 'open' overrides legacy STRICT=true", () => {
  assertEquals(
    resolveRequirementsEnforcement({
      CONCIERGE_REQUIREMENTS_ENFORCEMENT: "open",
      CONCIERGE_REQUIREMENTS_STRICT: "true",
    }),
    "open",
  );
});

Deno.test("enforcement — legacy STRICT=true → closed", () => {
  assertEquals(
    resolveRequirementsEnforcement({ CONCIERGE_REQUIREMENTS_STRICT: "true" }),
    "closed",
  );
});

Deno.test("enforcement — legacy STRICT accepts '1' and 'yes'", () => {
  assertEquals(resolveRequirementsEnforcement({ CONCIERGE_REQUIREMENTS_STRICT: "1" }), "closed");
  assertEquals(resolveRequirementsEnforcement({ CONCIERGE_REQUIREMENTS_STRICT: "yes" }), "closed");
});

Deno.test("enforcement — case-insensitive + trims whitespace", () => {
  assertEquals(
    resolveRequirementsEnforcement({ CONCIERGE_REQUIREMENTS_ENFORCEMENT: "  CLOSED  " }),
    "closed",
  );
  assertEquals(
    resolveRequirementsEnforcement({ CONCIERGE_REQUIREMENTS_STRICT: " True " }),
    "closed",
  );
});

Deno.test("enforcement — unknown values fall back to 'open'", () => {
  assertEquals(
    resolveRequirementsEnforcement({
      CONCIERGE_REQUIREMENTS_ENFORCEMENT: "strict",
      CONCIERGE_REQUIREMENTS_STRICT: "no",
    }),
    "open",
  );
});

Deno.test("enforcement — null / empty strings behave like missing vars", () => {
  assertEquals(
    resolveRequirementsEnforcement({
      CONCIERGE_REQUIREMENTS_ENFORCEMENT: "",
      CONCIERGE_REQUIREMENTS_STRICT: null,
    }),
    "open",
  );
});
