import { redirect } from "@tanstack/react-router";
import { isStudioSettingsPath, STUDIO_SETUP_PATH, studioSetupComplete } from "./studioSetup";
import { isStudioInvitationPath } from "./studioInvitationLink";

// Invoked only by the client-only trade layout's beforeLoad. No provider effects
// are required to resolve these reads on a fresh direct visit.
export async function readRouteStudioSetup() {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) return null;
  const userId = session.user.id;
  const [roles, account] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("trade_accounts").select("status").eq("user_id", userId).order("created_at", { ascending: false }).limit(1),
  ]);
  if (roles.error) throw roles.error;
  if (account.error) throw account.error;
  const isTrade = roles.data.some(row => row.role === "trade_user");
  const isAdmin = roles.data.some(row => row.role === "admin" || row.role === "super_admin");
  const status = account.data[0]?.status;
  if (!isTrade || (!isAdmin && ["pending_review", "on_hold", "rejected"].includes(status || ""))) return null;
  const memberships = await supabase.from("studio_members")
    .select("studio:studios(id,name,display_name,logo_url,pdf_cover_theme)").eq("user_id", userId);
  if (memberships.error) throw memberships.error;
  const studios = memberships.data.flatMap(row => row.studio ? [row.studio] : []);
  let selectedId: string | null = null;
  try { selectedId = localStorage.getItem("ma_current_studio_id"); } catch {}
  const studio = studios.find(row => row.id === selectedId) ?? studios[0] ?? null;
  if (!studio) return false;
  const projects = await supabase.from("projects").select("id", { count: "exact", head: true })
    .or(`studio_id.eq.${studio.id},and(studio_id.is.null,user_id.eq.${userId})`);
  if (projects.error) throw projects.error;
  return studioSetupComplete(studio, projects.count ?? 0);
}

export async function guardStudioSetupRoute(
  { pathname, preload, search = "" }: { pathname: string; preload: boolean; search?: string },
  readSetup: () => Promise<boolean | null> = readRouteStudioSetup,
) {
  if (preload || isStudioSettingsPath(pathname) || isStudioInvitationPath(pathname, search)) return;
  // Transient role/studio lookup failures must never become a false completion
  // or a false "incomplete" redirect. Retry, then let the route error UI retry.
  let complete: boolean | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { complete = await readSetup(); break; }
    catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 300 * 2 ** attempt));
    }
  }
  if (complete === false) throw redirect({ to: STUDIO_SETUP_PATH, search: { studioSetup: "required" }, replace: true });
}