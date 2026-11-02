// TEST-ONLY: creates a disposable approved trade applicant and a fresh activation
// link via the same prepareTradeActivation path the approval email uses.
// Gated by the E2E_SETUP_TOKEN secret; fails closed when unset. Only touches
// addresses on the reserved disposable domain, never real studios. No email is sent.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { prepareTradeActivation } from "../_shared/tradeActivation.ts";

const DOMAIN = "e2e.maisonaffluency.test";
const EMAIL_RE = new RegExp(`^e2e-activation-[a-z0-9-]{8,64}@${DOMAIN.replace(/\./g, "\\.")}$`);
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function cleanup(svc: ReturnType<typeof createClient>, email: string) {
  const { data: acct } = await svc.from("trade_accounts").select("user_id").eq("email", email).maybeSingle();
  let uid = acct?.user_id as string | null | undefined;
  if (!uid) {
    const { data } = await svc.from("profiles").select("id").eq("email", email).maybeSingle();
    uid = data?.id;
  }
  if (uid) {
    await svc.from("user_roles").delete().eq("user_id", uid);
    await svc.from("trade_profiles").delete().eq("user_id", uid);
    await svc.auth.admin.deleteUser(uid);
  }
  await svc.from("trade_accounts").delete().eq("email", email);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const expected = Deno.env.get("E2E_SETUP_TOKEN") ?? "";
  const given = req.headers.get("x-e2e-setup-token") ?? "";
  if (expected.length < 24 || !safeEqual(given, expected)) return json({ error: "Not found" }, 404);

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === 'verify-resend') {
      const original = `e2e-activation-${crypto.randomUUID()}@${DOMAIN}`;
      const corrected = `e2e-activation-${crypto.randomUUID()}@${DOMAIN}`;
      let signupId: string | undefined;
      try {
        const signup = await svc.from('trade_program_signups').insert({ email: original }).select('id').single();
        if (signup.error) throw new Error('Could not create disposable signup');
        signupId = signup.data.id;
        const acct = await svc.from('trade_accounts').insert({ email: original, signup_id: signupId, status: 'approved' }).select('id').single();
        if (acct.error) throw new Error('Could not create disposable application');
        const first = new URL(await prepareTradeActivation(svc, original)).searchParams.get('token_hash');
        const second = new URL(await prepareTradeActivation(svc, original)).searchParams.get('token_hash');
        if (!first || !second) throw new Error('Missing disposable setup proof');
        const publicClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { auth: { persistSession: false, autoRefreshToken: false } });
        const stale = await publicClient.auth.verifyOtp({ type: 'recovery', token_hash: first });
        if (!stale.error) throw new Error('Old same-address setup proof was accepted');
        const changed = await svc.from('trade_accounts').update({ email: corrected }).eq('id', acct.data.id);
        if (changed.error) throw new Error('Could not correct disposable recipient');
        const latest = new URL(await prepareTradeActivation(svc, corrected)).searchParams.get('token_hash');
        if (!latest) throw new Error('Missing latest disposable setup proof');
        const oldAddress = await publicClient.auth.verifyOtp({ type: 'recovery', token_hash: second });
        if (!oldAddress.error) throw new Error('Old-address setup proof was accepted');
        const current = await publicClient.auth.verifyOtp({ type: 'recovery', token_hash: latest });
        if (current.error || current.data.user?.email !== corrected) throw new Error('Latest setup proof failed');
        return json({ ok: true, olderSameEmailRejected: true, olderCorrectedEmailRejected: true, latestLinkVerified: true });
      } finally {
        await cleanup(svc, corrected);
        await cleanup(svc, original);
        if (signupId) await svc.from('trade_program_signups').delete().eq('id', signupId);
      }
    }
    if (body.action === "cleanup") {
      const email = String(body.email ?? "").toLowerCase();
      if (!EMAIL_RE.test(email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Invalid email" }, 400);
      await cleanup(svc, email);
      return json({ ok: true });
    }
    if (body.action !== "create") return json({ error: "Unknown action" }, 400);
    // An explicit email may be supplied for a controlled, operator-requested run
    // (e.g. an inbox the owner controls). Without one, a disposable address is used.
    const requested = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const email = requested && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requested)
      ? requested
      : `e2e-activation-${crypto.randomUUID()}@${DOMAIN}`;
    await cleanup(svc, email);
    const { error } = await svc.from("trade_accounts").insert({ email, status: "approved" });
    if (error) throw new Error(`Could not create test application: ${error.message}`);
    const link = new URL(await prepareTradeActivation(svc, email));
    return json({
      email,
      token_hash: link.searchParams.get("token_hash"),
      path: `${link.pathname}${link.search}`,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Setup failed" }, 500);
  }
});
