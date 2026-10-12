/** Account sync for Trade Gallery saved views. Local storage stays the instant cache. */
import { supabase } from "@/integrations/supabase/client";
import { readSavedViews, writeSavedViews, type TradeSavedView } from "@/lib/tradeSavedViews";

const db = supabase as any;
const SYNCED_KEY = "ma_trade_gallery_synced_view_ids_v1";
function readSynced(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SYNCED_KEY) || "[]")); } catch { return new Set(); }
}
function writeSynced(ids: Iterable<string>) {
  try { localStorage.setItem(SYNCED_KEY, JSON.stringify([...ids])); } catch { /* ignore */ }
}

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
  const remoteIds = new Set(remote.map((v) => v.id));
  const synced = readSynced();
  // A view previously synced but now missing on the account was deleted on another device — drop it, don't re-upload.
  const localOnly = readSavedViews().filter(
    (v) => !names.has(v.name.toLowerCase()) && !(synced.has(v.id) && !remoteIds.has(v.id)),
  );
  if (localOnly.length) {
    const { error: upErr } = await db.from("trade_saved_views").upsert(localOnly.map((v) => toRow(v, uid)));
    if (upErr) throw upErr;
  }
  const merged = [...remote, ...localOnly].sort((a, b) => a.createdAt - b.createdAt);
  writeSavedViews(merged);
  writeSynced(merged.map((v) => v.id));
  return merged;
}

export async function pushSavedView(view: TradeSavedView) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const uid = session.user.id;
  await db.from("trade_saved_views").delete().eq("user_id", uid).ilike("name", view.name).neq("id", view.id);
  const { error } = await db.from("trade_saved_views").upsert(toRow(view, uid));
  if (error) throw error;
  const ids = readSynced(); ids.add(view.id); writeSynced(ids);
}

export async function removeSavedView(id: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const { error } = await db.from("trade_saved_views").delete().eq("id", id).eq("user_id", session.user.id);
  if (error) throw error;
}
