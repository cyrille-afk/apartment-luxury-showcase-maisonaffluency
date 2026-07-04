// Automated regression suite for the SIGNED-IN /trade concierge.
//
// Runs common designer-name queries against `trade-concierge` and verifies
// the response mentions at least one catalog item that actually exists in
// `designer_curator_picks` for that designer. This is the regression net
// for bugs like "the concierge cannot answer 'What Alexander Lamont items
// do you have?'".
//
// Companion suite: `supabase/functions/concierge-public-stream/index.test.ts`
// asserts the public surface stays ungrounded.
//
// Env vars (loaded from `.env`):
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_PUBLISHABLE_KEY
//   E2E_USER_ACCESS_TOKEN   — JWT for an authenticated trade user. Test is
//                             skipped (not failed) when missing.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { readConciergeStream, streamContainsAny } from "../_shared/testHelpers.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const ACCESS_TOKEN = Deno.env.get("E2E_USER_ACCESS_TOKEN");
const ENDPOINT = `${SUPABASE_URL}/functions/v1/trade-concierge`;

// Designers with fully-priced catalogs (see memory: "25 published designers
// with every curator pick priced"). Each entry is a designer to ask about;
// expected catalog items are resolved live from designer_curator_picks so
// the test stays honest against schema drift.
const DESIGNER_QUERIES: { designer: string; prompt: string }[] = [
  { designer: "Alexander Lamont", prompt: "What Alexander Lamont items do you have?" },
  { designer: "Apparatus Studio", prompt: "Show me pieces by Apparatus Studio." },
  { designer: "Pierre Augustin Rose", prompt: "Do you carry Pierre Augustin Rose?" },
];

async function fetchCatalogTitles(designer: string): Promise<string[]> {
  const sb = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // designer_curator_picks_public is the anon-safe view of the catalog.
  const { data, error } = await sb
    .from("designer_curator_picks_public")
    .select("title, designer_name")
    .ilike("designer_name", designer)
    .limit(50);
  if (error) throw new Error(`catalog lookup failed for ${designer}: ${error.message}`);
  return (data ?? [])
    .map((r) => (r as { title?: string | null }).title ?? "")
    .filter((t) => typeof t === "string" && t.trim().length > 2);
}

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

function proposalPickIds(stream: { proposals: unknown[] }): string[] {
  const ids: string[] = [];
  for (const proposal of stream.proposals) {
    const pickIds = (proposal as { args?: { pick_ids?: unknown } })?.args?.pick_ids;
    if (Array.isArray(pickIds)) ids.push(...pickIds.filter((id): id is string => typeof id === "string"));
  }
  return Array.from(new Set(ids));
}

async function fetchPickRowsByIds(ids: string[]) {
  if (!ids.length) return [];
  const sb = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: picks, error: picksError } = await sb
    .from("designer_curator_picks_public")
    .select("id, title, category, subcategory, trade_price_cents, currency")
    .in("id", ids);
  if (picksError) throw new Error(`pick lookup failed: ${picksError.message}`);
  return (picks ?? []).map((p) => ({ ...p, title: (p as { title?: string }).title, price_cents: (p as { trade_price_cents?: number | null }).trade_price_cents ?? null }));
}

function rowIsDiningTable(row: { title?: string | null; category?: string | null; subcategory?: string | null }): boolean {
  const hay = `${row.title || ""} ${row.category || ""} ${row.subcategory || ""}`.toLowerCase();
  return /\bdining\b/.test(hay) && /\btables?\b/.test(hay) && !/\b(lamp|lighting|sconce|chandelier|cabinet|sideboard|bookcase|shelf)\b/.test(hay);
}

const FORBIDDEN_RESPONSE_TERMS = [
  "Axonometric Studio",
  "designer's own archive",
  "designers' own archive",
  "external archive",
  "The Invisible Collection",
];

function assertNoForbiddenTerms(text: string) {
  const leaked = FORBIDDEN_RESPONSE_TERMS.filter((term) => text.toLowerCase().includes(term.toLowerCase()));
  assert(leaked.length === 0, `response leaked forbidden terms ${JSON.stringify(leaked)}:\n${text}`);
}

for (const { designer, prompt } of DESIGNER_QUERIES) {
  Deno.test({
    name: `trade-concierge: "${prompt}" surfaces a real ${designer} catalog item`,
    ignore: !ACCESS_TOKEN,
    async fn() {
      const titles = await fetchCatalogTitles(designer);
      assert(
        titles.length > 0,
        `no catalog rows for ${designer} — cannot verify grounding`,
      );

      const resp = await runQuery(prompt);
      if (resp.status !== 200) {
        const body = await resp.text().catch(() => "");
        throw new Error(`expected 200, got ${resp.status}: ${body}`);
      }

      const { text } = await readConciergeStream(resp, { timeoutMs: 60_000 });
      assert(text.length > 0, `empty stream for prompt: ${prompt}`);

      // Grounding checks: response must mention the designer AND at least
      // one real catalog title (or a leading token of one, since long product
      // names often get abbreviated in prose replies).
      const mentionsDesigner = text.toLowerCase().includes(designer.toLowerCase());
      assert(
        mentionsDesigner,
        `response did not mention "${designer}":\n${text.slice(0, 500)}`,
      );

      const needles: string[] = [];
      for (const t of titles) {
        needles.push(t);
        const head = t.split(/[\s,–—-]+/).filter((w) => w.length >= 4).slice(0, 2).join(" ");
        if (head && head.length >= 4) needles.push(head);
      }
      const hit = streamContainsAny(text, needles);
      assert(
        hit !== null,
        `response mentioned ${designer} but referenced no real catalog title.\n` +
          `Sampled titles: ${titles.slice(0, 5).join(" | ")}\n` +
          `Response: ${text.slice(0, 800)}`,
      );
    },
  });
}

Deno.test("trade-concierge: rejects requests without Authorization", async () => {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
  });
  const body = await res.text();
  assert(res.status === 401, `expected 401, got ${res.status}: ${body}`);
});

Deno.test({
  name: "trade-concierge guardrail: typology + budget request does not require a designer and does not pad categories",
  ignore: !ACCESS_TOKEN,
  async fn() {
    const resp = await runQuery("Show me 6 dining tables under $8k.");
    if (resp.status !== 200) {
      const body = await resp.text().catch(() => "");
      throw new Error(`expected 200, got ${resp.status}: ${body}`);
    }
    const stream = await readConciergeStream(resp, { timeoutMs: 90_000 });
    assertNoForbiddenTerms(stream.text);
    assert(
      !/couldn'?t identify a designer|nothing to enumerate|exact atelier name/i.test(stream.text),
      `typology request incorrectly fell into designer-enumeration fallback:\n${stream.text}`,
    );

    const ids = proposalPickIds(stream);
    assert(ids.length > 0, `expected at least one proposal card, got text only:\n${stream.text}`);
    assert(ids.length <= 6, `must not pad beyond requested count; got ${ids.length} ids`);
    const rows = await fetchPickRowsByIds(ids);
    assert(rows.length === ids.length, `could not resolve all proposed ids: ${JSON.stringify(ids)}`);
    for (const row of rows) {
      assert(rowIsDiningTable(row), `non-dining-table proposed: ${JSON.stringify(row)}`);
      assert(Number(row.price_cents || 0) > 0 && Number(row.price_cents) <= 800_000, `price exceeds $8k/8k-unit ceiling or is missing: ${JSON.stringify(row)}`);
    }
  },
});

Deno.test({
  name: "trade-concierge guardrail: absent originals do not invent external archive access",
  ignore: !ACCESS_TOKEN,
  async fn() {
    const resp = await runQuery("Any Charlotte Perriand originals?");
    if (resp.status !== 200) {
      const body = await resp.text().catch(() => "");
      throw new Error(`expected 200, got ${resp.status}: ${body}`);
    }
    const stream = await readConciergeStream(resp, { timeoutMs: 90_000 });
    assertNoForbiddenTerms(stream.text);
    assert(
      stream.proposals.length === 0 || !stream.text.toLowerCase().includes("charlotte perriand"),
      `must not fabricate Perriand proposal/provenance:\n${stream.text}`,
    );
  },
});
