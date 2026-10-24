import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findDuplicateGroups, validateDecision, type AuthUserLike, type ReviewDecision } from "./duplicateAccounts";

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

async function loadGroups() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const users: AuthUserLike[] = [];
  for (let page = 1; page < 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    users.push(...(data.users as AuthUserLike[]));
    if (data.users.length < 1000) break;
  }
  return { supabaseAdmin, groups: findDuplicateGroups(users) };
}

export const listDuplicateAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin, groups } = await loadGroups();
    const { data: reviews } = await supabaseAdmin
      .from("account_identity_reviews")
      .select("id,email_key,primary_user_id,duplicate_user_id,decision,notes,password_verified,google_verified,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    return { groups, reviews: reviews ?? [] };
  });

const DECISIONS: ReviewDecision[] = ["keep_both", "suspend_duplicate", "restore_duplicate"];
const UUID = /^[0-9a-f-]{36}$/i;

export const resolveDuplicateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: any) => {
    if (!UUID.test(i?.primaryUserId) || !UUID.test(i?.duplicateUserId)) throw new Error("Invalid account");
    if (!DECISIONS.includes(i?.decision)) throw new Error("Invalid decision");
    return {
      key: String(i.key ?? "").slice(0, 320),
      primaryUserId: String(i.primaryUserId),
      duplicateUserId: String(i.duplicateUserId),
      decision: i.decision as ReviewDecision,
      passwordVerified: i.passwordVerified === true,
      googleVerified: i.googleVerified === true,
      notes: String(i.notes ?? "").trim().slice(0, 2000),
    };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin, groups } = await loadGroups();
    const { data: admins } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
    const err = validateDecision({
      ...data,
      group: groups.find((g) => g.key === data.key),
      callerId: context.userId,
      adminIds: new Set((admins ?? []).map((r: any) => r.user_id)),
    });
    if (err) throw new Error(err);

    if (data.decision !== "keep_both") {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.duplicateUserId, {
        ban_duration: data.decision === "suspend_duplicate" ? "876000h" : "none",
      });
      if (error) throw new Error(error.message);
    }
    const { error: logErr } = await supabaseAdmin.from("account_identity_reviews").insert({
      email_key: data.key,
      primary_user_id: data.primaryUserId,
      duplicate_user_id: data.duplicateUserId,
      decision: data.decision,
      password_verified: data.passwordVerified,
      google_verified: data.googleVerified,
      notes: data.notes || null,
      reviewed_by: context.userId,
    });
    if (logErr) throw new Error(logErr.message);
    return { ok: true };
  });
