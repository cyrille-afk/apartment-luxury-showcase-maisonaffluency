import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * The mobile → desktop bridge.
 *
 * Items a designer flagged from the PWA land in `client_board_items` with
 * `saved_via = 'mobile'`. Until they are opened on the desktop dashboard they
 * stay "unseen" and drive the gold pulsing dot over Project Folders.
 */

export type FlaggedItem = {
  id: string;
  created_at: string;
  board_id: string;
  board_title: string;
  product_id: string;
  product_name: string;
  brand_name: string | null;
  image_url: string | null;
  spec_sheet_url: string | null;
  variant_label: string | null;
  fabric_label: string | null;
  wood_label: string | null;
  cad_assets: { id: string; file_format: string; file_url: string; variant_label: string | null }[];
};

export function useStudioBridge() {
  const { user } = useAuth();
  const [items, setItems] = useState<FlaggedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const { data: boards } = await supabase
        .from("client_boards")
        .select("id, title")
        .eq("user_id", user.id);

      const boardMap = new Map((boards || []).map((b) => [b.id, b.title as string]));
      if (boardMap.size === 0) {
        setItems([]);
        return;
      }

      const { data: rows } = await supabase
        .from("client_board_items")
        .select("id, created_at, board_id, product_id, variant_label, fabric_label, wood_label, saved_via, seen_on_desktop_at")
        .in("board_id", [...boardMap.keys()])
        .eq("saved_via", "mobile")
        .is("seen_on_desktop_at", null)
        .order("created_at", { ascending: false })
        .limit(30);

      const list = rows || [];
      if (list.length === 0) {
        setItems([]);
        return;
      }

      const productIds = [...new Set(list.map((r) => r.product_id).filter(Boolean))] as string[];
      const [{ data: products }, { data: cad }] = await Promise.all([
        supabase
          .from("trade_products")
          .select("id, product_name, brand_name, image_url, spec_sheet_url")
          .in("id", productIds),
        supabase
          .from("trade_product_cad_assets")
          .select("id, product_id, file_format, file_url, variant_label")
          .in("product_id", productIds),
      ]);

      const pMap = new Map((products || []).map((p) => [p.id, p]));

      setItems(
        list.map((r) => {
          const p = pMap.get(r.product_id) as
            | { product_name: string; brand_name: string | null; image_url: string | null; spec_sheet_url: string | null }
            | undefined;
          return {
            id: r.id,
            created_at: r.created_at,
            board_id: r.board_id,
            board_title: boardMap.get(r.board_id) || "Project folder",
            product_id: r.product_id,
            product_name: p?.product_name || "Saved piece",
            brand_name: p?.brand_name ?? null,
            image_url: p?.image_url ?? null,
            spec_sheet_url: p?.spec_sheet_url ?? null,
            variant_label: r.variant_label,
            fabric_label: r.fabric_label,
            wood_label: r.wood_label,
            cad_assets: (cad || []).filter((a) => a.product_id === r.product_id).map((a) => ({
              id: a.id,
              file_format: a.file_format,
              file_url: a.file_url,
              variant_label: a.variant_label,
            })),
          };
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      // Unique topic per mount: StrictMode remounts would otherwise reuse a
      // subscribed channel and throw on `.on()`.
      .channel(`studio-bridge-${user.id}-${Math.random().toString(36).slice(2)}`)

      .on("postgres_changes", { event: "INSERT", schema: "public", table: "client_board_items" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  /** Marks every currently listed item as reviewed on the desktop. */
  const markAllSeen = useCallback(async () => {
    if (items.length === 0) return;
    const ids = items.map((i) => i.id);
    await supabase
      .from("client_board_items")
      .update({ seen_on_desktop_at: new Date().toISOString() })
      .in("id", ids);
    setItems([]);
  }, [items]);

  return { items, count: items.length, loading, reload: load, markAllSeen };
}

/** Studio alerts (supply / lead-time changes) — in-app twin of the push message. */
export type StudioAlert = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  project_name: string | null;
  read_at: string | null;
  created_at: string;
};

export function useStudioAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<StudioAlert[]>([]);

  const load = useCallback(async () => {
    if (!user) return setAlerts([]);
    const { data } = await supabase
      .from("studio_alerts")
      .select("id, title, body, url, project_name, read_at, created_at")
      .eq("user_id", user.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    setAlerts(data || []);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      .channel(`studio-alerts-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "studio_alerts", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  const dismiss = useCallback(async (id: string) => {
    await supabase.from("studio_alerts").update({ read_at: new Date().toISOString() }).eq("id", id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { alerts, count: alerts.length, dismiss, reload: load };
}
