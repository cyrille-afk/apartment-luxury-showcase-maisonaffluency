/** Runs the production server price verifier on browser-emitted checkout lines.
 * Only catalogue reads are fixtures; Stripe, writes and network are forbidden.
 * Input/output use stdin/stdout so no browser session or credentials are passed.
 */
import { verifyCatalogLines } from '../../supabase/functions/_shared/catalogPricing.ts';

const input = JSON.parse(await new Response(Deno.stdin.readable).text());
globalThis.fetch = () => Promise.reject(new Error('Network forbidden in pairing checkout harness'));
const tables: Record<string, unknown[]> = {
  trade_products: input.products,
  designer_curator_picks: [],
  curated_pairing_rules: [input.rule],
  designer_curator_picks_public: [{ id: input.rule.preferred_pick_id, designer_id: 'fixture-designer' }],
  designers: [{ id: 'fixture-designer' }],
};
const reads: string[] = [];
const admin = {
  from(table: string) {
    if (!(table in tables)) throw new Error(`Unexpected table: ${table}`);
    reads.push(table);
    const result = { data: tables[table], error: null };
    const chain = {
      select: () => chain, or: () => chain, in: () => chain, eq: () => chain,
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return chain;
  },
};
const claimed = input.body.items.map((line: Record<string, unknown>) => ({
  ...line, finishLabel: line.selectedFinish, unitCents: Math.round(Number(line.price) * 100),
}));
const accepted = await verifyCatalogLines(admin, claimed, input.body.currency);
const withoutReference = await verifyCatalogLines(admin, claimed.map((line: Record<string, unknown>) => ({ ...line, pairing: null })), input.body.currency);
const tampered = await verifyCatalogLines(admin, claimed.map((line: Record<string, unknown>) => line.pairing ? { ...line, unitCents: Number(line.unitCents) + 1 } : line), input.body.currency);
console.log(JSON.stringify({ accepted, withoutReference, tampered, reads }));