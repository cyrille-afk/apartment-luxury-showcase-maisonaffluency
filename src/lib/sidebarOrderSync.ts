import { supabase } from "@/integrations/supabase/client";
import type { SidebarOrder } from "@/lib/sidebarOrder";

export type RemoteSidebarOrder = { order: SidebarOrder; reordered: boolean } | null;
export const isCustomOrder = (o: SidebarOrder) => o.sections.length > 0 || o.projects.length > 0 || Object.keys(o.folders).length > 0;

export async function fetchRemoteSidebarOrder(userId: string): Promise<RemoteSidebarOrder> {
  const { data, error } = await supabase.from("trade_sidebar_preferences").select("sidebar_order, reordered").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? { order: data.sidebar_order as unknown as SidebarOrder, reordered: data.reordered } : null;
}
export async function saveRemoteSidebarOrder(userId: string, order: SidebarOrder, reordered = true) {
  const { error } = await supabase.from("trade_sidebar_preferences").upsert({ user_id: userId, sidebar_order: order as never, reordered, updated_at: new Date().toISOString() });
  if (error) throw error;
}
export async function clearRemoteSidebarOrder(userId: string) {
  const { error } = await supabase.from("trade_sidebar_preferences").update({ sidebar_order: {} as never, updated_at: new Date().toISOString() }).eq("user_id", userId);
  if (error) throw error;
}
