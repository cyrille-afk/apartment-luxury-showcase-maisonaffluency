// Sample-query eval battery for the deployed trade-concierge SSE endpoint.
//
// This is the CI regression net for the concierge as a whole: it fires a
// fixed set of architect/designer-style prompts at the LIVE deployed edge
// function and asserts the streamed response actually satisfies the request
// (real catalog grounding, no forbidden terms, and a spec sheet is emitted
// whenever the prompt asks for a multi-piece recommendation).
//
// Env vars (loaded from `.env` locally, GitHub secrets in CI):
//   VITE_SUPABASE_URL              — Supabase project URL
//   VITE_SUPABASE_PUBLISHABLE_KEY  — anon key
//   E2E_USER_ACCESS_TOKEN          — JWT for an authenticated trade user
//                                    (tests skip, not fail, when missing)

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { readConciergeStream } from "../_shared/testHelpers.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const ACCESS_TOKEN = Deno.env.get("E2E_USER_ACCESS_TOKEN");
const ENDPOINT = `${SUPABASE_URL}/functions/v1/trade-concierge`;

type EvalCase = {
  name: string;
  prompt: string;
  /** Substrings that MUST appear (case-insensitive) somewhere in the response. */
  expectContains?: string[];
  /** Substrings that MUST NOT appear (case-insensitive). */
  forbid?: string[];
  /** Assert that at least one proposal card was emitted. */
  expectProposal?: boolean;
  /** Assert the proposal note contains an auto-compiled spec-sheet block. */
  expectSpecSheet?: boolean;
  /** Optional min number of pick_ids on the proposal. */
  minPickIds?: number;
};

const FORBIDDEN_GLOBAL = [
  "The Invisible Collection",
  "theinvisiblecollection",
  "Axonometric Studio",
  "designer's own archive",
  "designers' own archive",
  "external archive",
];

// Keep this list small and focused on high-signal regressions. Each case
// costs one live LLM call.
const CASES: EvalCase[] = [
  {
    name: "designer enumeration returns a spec-sheet block",
    prompt: "Show me 3 pieces by Alexander Lamont with dimensions and lead times.",
    expectContains: ["Alexander Lamont"],
    expectProposal: true,
    expectSpecSheet: true,
    minPickIds: 2,
  },
  {
    name: "typology + budget stays on-typology and produces a spec sheet",
    prompt: "Show me 4 dining tables under $10k with lead times.",
    expectProposal: true,
    expectSpecSheet: true,
    minPickIds: 2,
  },
  {
    name: "absent originals do not fabricate external archives",
    prompt: "Any Charlotte Perriand originals?",
    forbid: ["Axonometric Studio", "external archive"],
  },
  {
    name: "public competitor is never named",
    prompt: "How does your catalog compare to competitors?",
    forbid: FORBIDDEN_GLOBAL,
  },
];

async function runQuery(prompt: string) {
  return await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "apikey": ANON_KEY,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      surface: "trade",
      project_id: null,
      lang: "en",
    }),
  });
}

function proposalHasSpecSheet(proposal: unknown): boolean {
  const args = (proposal as { args?: Record<string, unknown> })?.args ?? {};
  const rows = args.spec_sheet;
  const note = typeof args.note === "string" ? args.note : "";
  const hasRows = Array.isArray(rows) && rows.length >= 2;
  const hasBlock = note.includes("Spec sheet:");
  return hasRows || hasBlock;
}

function proposalPickCount(proposal: unknown): number {
  const ids = (proposal as { args?: { pick_ids?: unknown } })?.args?.pick_ids;
  return Array.isArray(ids) ? ids.length : 0;
}

for (const c of CASES) {
  Deno.test({
    name: `eval-battery: ${c.name}`,
    ignore: !ACCESS_TOKEN,
    async fn() {
      const resp = await runQuery(c.prompt);
      if (resp.status !== 200) {
        const body = await resp.text().catch(() => "");
        throw new Error(`expected 200, got ${resp.status}: ${body}`);
      }
      const stream = await readConciergeStream(resp, { timeoutMs: 90_000 });
      const text = stream.text;

      const forbid = [...FORBIDDEN_GLOBAL, ...(c.forbid ?? [])];
      const leaked = forbid.filter((t) => text.toLowerCase().includes(t.toLowerCase()));
      assert(leaked.length === 0, `response leaked forbidden terms ${JSON.stringify(leaked)}:\n${text.slice(0, 600)}`);

      for (const needle of c.expectContains ?? []) {
        assert(
          text.toLowerCase().includes(needle.toLowerCase()),
          `expected response to mention "${needle}":\n${text.slice(0, 600)}`,
        );
      }

      if (c.expectProposal) {
        assert(stream.proposals.length > 0, `expected at least one proposal card, got text only:\n${text.slice(0, 600)}`);
      }
      if (c.minPickIds) {
        const maxIds = stream.proposals.reduce((m, p) => Math.max(m, proposalPickCount(p)), 0);
        assert(maxIds >= c.minPickIds, `expected >=${c.minPickIds} pick_ids on a proposal, saw max=${maxIds}`);
      }
      if (c.expectSpecSheet) {
        const ok = stream.proposals.some(proposalHasSpecSheet);
        assert(ok, `expected an auto-compiled spec-sheet block on a proposal (spec_sheet[] or "Spec sheet:" in note)`);
      }
    },
  });
}
