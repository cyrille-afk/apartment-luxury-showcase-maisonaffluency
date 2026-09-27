// Regression: an OTP session must open ONLY the exact project/board path it was
// issued for, even when the same guest has active invites on several boards.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";

const URL_ = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const sha = async (s: string) => encodeHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))));
const call = async (body: unknown) => {
  const r = await fetch(`${URL_}/functions/v1/board-access`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
};

Deno.test({
  name: "OTP session is scoped to the exact invited project/board",
  ignore: !SVC,
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const svc = createClient(URL_, SVC!, { auth: { persistSession: false } });
    // Pick two boards in the same project, so the project slug collides.
    const { data: boards } = await svc.from("client_boards").select("id, project_id, user_id").not("project_id", "is", null).limit(500);
    const byProject = new Map<string, any[]>();
    for (const b of boards ?? []) byProject.set(b.project_id, [...(byProject.get(b.project_id) ?? []), b]);
    const pair = [...byProject.values()].find((l) => l.length >= 2);
    assert(pair, "need a project with at least two boards");
    const [a, b] = pair;

    const email = `qa-otp-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const now = Date.now();
    // Invite on B is NEWER — the old bug routed to the most recent invite.
    const { data: invites, error } = await svc.from("board_invites").insert([
      { board_id: a.id, email, role: "client", invited_by: a.user_id, token_hash: await sha(crypto.randomUUID()), status: "pending", expires_at: new Date(now + 864e5).toISOString(), created_at: new Date(now - 36e5).toISOString() },
      { board_id: b.id, email, role: "client", invited_by: b.user_id, token_hash: await sha(crypto.randomUUID()), status: "pending", expires_at: new Date(now + 864e5).toISOString(), created_at: new Date(now).toISOString() },
    ]).select("id, board_id");
    assert(!error, error?.message);
    const ids = invites!.map((i) => i.id);

    try {
      const { data: slugA } = await svc.rpc("board_share_slug", { _board_id: a.id });
      const { data: slugB } = await svc.rpc("board_share_slug", { _board_id: b.id });
      assert(slugA && slugB && slugA !== slugB, "boards must have distinct slugs");

      // Issue a known code on BOTH invites.
      for (const i of invites!) {
        await svc.from("board_invites").update({
          access_code_hash: await sha("123456" + i.id),
          access_code_expires_at: new Date(now + 6e5).toISOString(),
          access_code_attempts: 0,
        }).eq("id", i.id);
      }

      // Verify on A's path → session must belong to A's invite only.
      const va = await call({ action: "verify", slug: slugA, email, code: "123456" });
      assertEquals(va.status, 200);
      const hashA = await sha(va.body.token);
      const { data: sessA } = await svc.from("board_guest_sessions").select("invite_id").eq("token_hash", hashA).single();
      assertEquals(sessA!.invite_id, invites!.find((i) => i.board_id === a.id)!.id);

      // A's session token opens board A, not board B.
      const { data: viaA } = await svc.rpc("_board_invite_by_token", { _token: va.body.token });
      assertEquals((viaA as any)?.board_id, a.id);

      // B's code still valid and independent → B's session opens B.
      const vb = await call({ action: "verify", slug: slugB, email, code: "123456" });
      assertEquals(vb.status, 200);
      const { data: sessB } = await svc.from("board_guest_sessions").select("invite_id").eq("token_hash", await sha(vb.body.token)).single();
      assertEquals(sessB!.invite_id, invites!.find((i) => i.board_id === b.id)!.id);

      // Code already used on A → replay rejected; unknown board path rejected.
      assertEquals((await call({ action: "verify", slug: slugA, email, code: "123456" })).status, 403);
      assertEquals((await call({ action: "verify", slug: `${String(slugA).split("/")[0]}/does-not-exist`, email, code: "123456" })).status, 403);
    } finally {
      await svc.from("board_guest_sessions").delete().in("invite_id", ids);
      await svc.from("board_invites").delete().in("id", ids);
    }
  },
});
