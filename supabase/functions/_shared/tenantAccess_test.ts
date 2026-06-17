import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  canAccessProject,
  canAttachClientToQuote,
  type StudioMembersClient,
} from "./tenantAccess.ts";

/** Build a fake supabase client whose studio_members lookup returns `data`. */
function fakeClient(
  data: { user_id: string } | null,
  spy?: { calls: Array<{ studio_id: string; user_id: string }> },
): StudioMembersClient {
  return {
    from: (_table) => ({
      select: (_cols) => ({
        eq: (_c1, studio_id) => ({
          eq: (_c2, user_id) => ({
            maybeSingle: async () => {
              spy?.calls.push({ studio_id, user_id });
              return { data };
            },
          }),
        }),
      }),
    }),
  };
}

// ---------- canAccessProject ----------

Deno.test("canAccessProject: owner is always allowed without DB hit", async () => {
  const spy = { calls: [] as Array<{ studio_id: string; user_id: string }> };
  const ok = await canAccessProject(
    fakeClient(null, spy),
    "user-A",
    { user_id: "user-A", studio_id: "studio-X" },
  );
  assertEquals(ok, true);
  assertEquals(spy.calls.length, 0, "owner check must short-circuit before studio_members lookup");
});

Deno.test("canAccessProject: non-owner with NO studio_members row is DENIED", async () => {
  // This is the P1 cross-tenant leak the patch fixes.
  const spy = { calls: [] as Array<{ studio_id: string; user_id: string }> };
  const ok = await canAccessProject(
    fakeClient(null, spy), // no membership row
    "user-B",
    { user_id: "user-A", studio_id: "studio-X" },
  );
  assertEquals(ok, false);
  assertEquals(spy.calls, [{ studio_id: "studio-X", user_id: "user-B" }]);
});

Deno.test("canAccessProject: non-owner WITH studio_members row is allowed", async () => {
  const ok = await canAccessProject(
    fakeClient({ user_id: "user-B" }),
    "user-B",
    { user_id: "user-A", studio_id: "studio-X" },
  );
  assertEquals(ok, true);
});

Deno.test("canAccessProject: project with no studio AND non-owner is DENIED", async () => {
  const spy = { calls: [] as Array<{ studio_id: string; user_id: string }> };
  const ok = await canAccessProject(
    fakeClient({ user_id: "user-B" }, spy), // even if membership existed, no studio to check
    "user-B",
    { user_id: "user-A", studio_id: null },
  );
  assertEquals(ok, false);
  assertEquals(spy.calls.length, 0, "no studio → no lookup, just deny");
});

// ---------- canAttachClientToQuote ----------

Deno.test("canAttachClientToQuote: client with no studio is DENIED", async () => {
  const spy = { calls: [] as Array<{ studio_id: string; user_id: string }> };
  const ok = await canAttachClientToQuote(
    fakeClient({ user_id: "user-A" }, spy),
    "user-A",
    { studio_id: null },
    null,
  );
  assertEquals(ok, false);
  assertEquals(spy.calls.length, 0);
});

Deno.test("canAttachClientToQuote: project studio mismatch is DENIED", async () => {
  const spy = { calls: [] as Array<{ studio_id: string; user_id: string }> };
  const ok = await canAttachClientToQuote(
    fakeClient({ user_id: "user-A" }, spy),
    "user-A",
    { studio_id: "studio-OTHER" },
    "studio-X", // project bound to a different studio
  );
  assertEquals(ok, false);
  assertEquals(spy.calls.length, 0, "studio mismatch must short-circuit before membership lookup");
});

Deno.test("canAttachClientToQuote: no projectStudioId + NO membership row is DENIED (was the P1 leak)", async () => {
  // Before the patch this short-circuited to `true` when studioId was null,
  // letting a user graft another studio's client onto a fresh quote.
  const spy = { calls: [] as Array<{ studio_id: string; user_id: string }> };
  const ok = await canAttachClientToQuote(
    fakeClient(null, spy), // user is NOT a member of the client's studio
    "user-B",
    { studio_id: "studio-X" },
    null, // no project binding
  );
  assertEquals(ok, false);
  assertEquals(
    spy.calls,
    [{ studio_id: "studio-X", user_id: "user-B" }],
    "membership lookup must always run, even with no project binding",
  );
});

Deno.test("canAttachClientToQuote: no projectStudioId + valid membership is allowed", async () => {
  const ok = await canAttachClientToQuote(
    fakeClient({ user_id: "user-A" }),
    "user-A",
    { studio_id: "studio-X" },
    null,
  );
  assertEquals(ok, true);
});

Deno.test("canAttachClientToQuote: matching projectStudioId + valid membership is allowed", async () => {
  const ok = await canAttachClientToQuote(
    fakeClient({ user_id: "user-A" }),
    "user-A",
    { studio_id: "studio-X" },
    "studio-X",
  );
  assertEquals(ok, true);
});
