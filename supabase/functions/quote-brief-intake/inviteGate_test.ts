import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { canSendAccountInvite } from "./inviteGate.ts";

const fake = (claims: Record<string, unknown> | null, roles: string[] = [], roleError = false) => ({
  auth: { getClaims: async () => ({ data: claims ? { claims } : null }) },
  from: () => ({
    select: () => ({
      eq: () => ({
        in: async (_c: string, allowed: string[]) =>
          roleError
            ? { data: null, error: { message: "down" } }
            : { data: roles.filter((r) => allowed.includes(r)).map((role) => ({ role })), error: null },
      }),
    }),
  }),
});
const user = { role: "authenticated", sub: "u1" };

Deno.test("anonymous caller cannot trigger invite", async () => {
  assertEquals(await canSendAccountInvite(fake(null), null), false);
  assertEquals(await canSendAccountInvite(fake(null), "Bearer anon-key"), false);
});
Deno.test("signed-in non-admin cannot trigger invite", async () => {
  assertEquals(await canSendAccountInvite(fake(user, ["trade_user"]), "Bearer t"), false);
});
Deno.test("anon-role token cannot trigger invite", async () => {
  assertEquals(await canSendAccountInvite(fake({ role: "anon", sub: "x" }, ["admin"]), "Bearer t"), false);
});
Deno.test("role lookup failure fails closed", async () => {
  assertEquals(await canSendAccountInvite(fake(user, ["admin"], true), "Bearer t"), false);
});
Deno.test("admin and super_admin may invite", async () => {
  assertEquals(await canSendAccountInvite(fake(user, ["admin"]), "Bearer t"), true);
  assertEquals(await canSendAccountInvite(fake(user, ["super_admin"]), "Bearer t"), true);
});
