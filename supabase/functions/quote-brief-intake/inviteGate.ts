// Account invites are a privileged action: only a signed-in admin may cause
// the public quote-brief form to invite a new email. Anonymous or ordinary
// callers still get their brief recorded, but no invite is sent.
// deno-lint-ignore-file no-explicit-any
export async function canSendAccountInvite(admin: any, authHeader: string | null): Promise<boolean> {
  const h = authHeader || "";
  const token = h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
  if (!token) return false;
  try {
    const { data } = await admin.auth.getClaims(token);
    const c = data?.claims;
    if (c?.role !== "authenticated" || typeof c.sub !== "string") return false;
    const { data: roles, error } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", c.sub)
      .in("role", ["admin", "super_admin"]);
    if (error) return false;
    return (roles?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
