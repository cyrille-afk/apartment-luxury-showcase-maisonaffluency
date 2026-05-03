import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget tracker for "viewed-but-not-saved" signals used by the
 * AI Concierge for predictive personalization. Safe to call without auth —
 * it silently no-ops when the user is signed out.
 */
export async function trackRecentView(args: {
  entityType: "designer" | "product" | "curator_pick";
  entityId?: string | null;
  entityLabel?: string | null;
  brandName?: string | null;
  category?: string | null;
}) {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user?.id;
    if (!userId) return;
    await supabase.from("trade_recent_views").insert({
      user_id: userId,
      entity_type: args.entityType,
      entity_id: args.entityId || null,
      entity_label: args.entityLabel || null,
      brand_name: args.brandName || null,
      category: args.category || null,
    });
  } catch {
    /* silent — analytics signal only */
  }
}
