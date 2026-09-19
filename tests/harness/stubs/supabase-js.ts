/**
 * Stub for `npm:@supabase/supabase-js` used only by the harnesses.
 *
 * The harness injects its own fake client, so no real client is ever built.
 * Mapped in tests/harness/deno.json — this keeps the harness hermetic (no npm
 * download, no network, no chance of a real database call).
 */
export function createClient(): never {
  throw new Error(
    "[harness] createClient() was called — the harness must inject its own stub client",
  );
}

export type SupabaseClient = unknown;
export default { createClient };
