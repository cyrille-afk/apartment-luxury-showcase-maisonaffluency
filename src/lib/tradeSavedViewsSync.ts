/** Account sync for Trade Gallery saved views. Local storage stays the instant cache. */
import { supabase } from "@/integrations/supabase/client";
import { readSavedViews, writeSavedViews, type TradeSavedView } from "@/lib/tradeSavedViews";

const db = supabase as any;

function toRow(v: TradeSavedView, userId: string) {
  const { id, name, createdAt, ...config } = v;
  return { id, user_id: userId, name, config, created_at: new Date(createdAt).toISOString(), updated_at: new Date().toISOString() };
}

/** Merges local and account views (account wins on same name), uploads local-only ones, returns merged list. */
export async function syncSavedViews(): Promise<TradeSavedView[] | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const uid = session.user.id;
  const { data, error } = await db.from("trade_saved_views").select("id,name,config,created_at").eq("user_id", uid);
  if (error) throw error;
  const remote: TradeSavedView[] = (data ?? []).map((r: any) => ({
    ...r.config, id: r.id, name: r.name, createdAt: new Date(r.created_at).getTime(),
  }));
  const names = new Set(remote.map((v) => v.name.toLowerCase()));
  const localOnly = readSavedViews().filter((v) => !names.has(v.name.toLowerCase()));
  if (localOnly.length) {
    const { error: upErr } = await db.from("trade_saved_views").upsert(localOnly.map((v) => toRow(v, uid)));
    if (upErr) throw upErr;
  }
  const merged = [...remote, ...localOnly].sort((a, b) => a.createdAt - b.createdAt);
  writeSavedViews(merged);
  return merged;
}

export async function pushSavedView(view: TradeSavedView) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const uid = session.user.id;
  await db.from("trade_saved_views").delete().eq("user_id", uid).ilike("name", view.name).neq("id", view.id);
  const { error } = await db.from("trade_saved_views").upsert(toRow(view, uid));
  if (error) throw error;
}

export async function removeSavedView(id: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const { error } = await db.from("trade_saved_views").delete().eq("id", id).eq("user_id", session.user.id);
  if (error) throw error;
}
