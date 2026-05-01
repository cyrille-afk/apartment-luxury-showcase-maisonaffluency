import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserBoardSummary = {
  id: string;
  title: string;
  client_name: string | null;
  status: string;
  updated_at: string;
  item_count: number;
};

/**
 * Lightweight fetch of the signed-in user's tearsheets, with item counts.
 * Used by the concierge proposal card to let the user pick which board to append to.
 */
export function useUserBoards(enabled: boolean) {
  const [boards, setBoards] = useState<UserBoardSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id;
      if (!userId) {
        if (!cancelled) {
          setBoards([]);
          setLoading(false);
        }
        return;
      }

      const { data: rows, error: err } = await supabase
        .from("client_boards")
        .select("id, title, client_name, status, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(100);

      if (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
        return;
      }

      const ids = (rows || []).map((r) => r.id);
      const counts = new Map<string, number>();
      if (ids.length > 0) {
        const { data: items } = await supabase
          .from("client_board_items")
          .select("board_id")
          .in("board_id", ids);
        for (const it of items || []) {
          counts.set(it.board_id, (counts.get(it.board_id) || 0) + 1);
        }
      }

      if (cancelled) return;
      setBoards(
        (rows || []).map((r) => ({
          id: r.id,
          title: r.title || "Untitled",
          client_name: r.client_name || null,
          status: r.status,
          updated_at: r.updated_at,
          item_count: counts.get(r.id) || 0,
        })),
      );
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [enabled]);

  return { boards, loading, error };
}
