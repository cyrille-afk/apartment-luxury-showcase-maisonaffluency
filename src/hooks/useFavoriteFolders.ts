import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface FavoriteFolder {
  id: string;
  name: string;
  cover_image_url: string | null;
  item_count: number;
  created_at: string;
}

export function useFavoriteFolders(overrideUserId?: string) {
  const { user } = useAuth();
  const effectiveUserId = overrideUserId ?? user?.id ?? null;
  const [folders, setFolders] = useState<FavoriteFolder[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!effectiveUserId) { setFolders([]); setLoading(false); return; }
    setLoading(true);
    const { data: foldersData } = await supabase
      .from("favorite_folders")
      .select("id, name, cover_image_url, created_at")
      .eq("user_id", effectiveUserId)
      .order("created_at", { ascending: false });

    const ids = (foldersData || []).map((f: any) => f.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: items } = await supabase
        .from("favorite_folder_items")
        .select("folder_id")
        .in("folder_id", ids);
      (items || []).forEach((i: any) => {
        counts[i.folder_id] = (counts[i.folder_id] || 0) + 1;
      });
    }
    setFolders((foldersData || []).map((f: any) => ({ ...f, item_count: counts[f.id] || 0 })));
    setLoading(false);
  }, [effectiveUserId]);

  useEffect(() => { refresh(); }, [refresh]);

  const createFolder = useCallback(async (name: string) => {
    if (!user || !name.trim()) return null;
    const { data, error } = await supabase
      .from("favorite_folders")
      .insert({ user_id: user.id, name: name.trim() })
      .select("id, name, cover_image_url, created_at")
      .single();
    if (error || !data) return null;
    setFolders((prev) => [{ ...(data as any), item_count: 0 }, ...prev]);
    return data.id;
  }, [user]);

  const renameFolder = useCallback(async (id: string, name: string) => {
    await supabase.from("favorite_folders").update({ name }).eq("id", id);
    setFolders((p) => p.map((f) => f.id === id ? { ...f, name } : f));
  }, []);

  const deleteFolder = useCallback(async (id: string) => {
    await supabase.from("favorite_folders").delete().eq("id", id);
    setFolders((p) => p.filter((f) => f.id !== id));
  }, []);

  const addFavoriteToFolder = useCallback(async (folderId: string, favoriteId: string) => {
    const { error } = await supabase
      .from("favorite_folder_items")
      .insert({ folder_id: folderId, favorite_id: favoriteId });
    if (!error) {
      setFolders((p) => p.map((f) => f.id === folderId ? { ...f, item_count: f.item_count + 1 } : f));
    }
    return !error;
  }, []);

  const removeFavoriteFromFolder = useCallback(async (folderId: string, favoriteId: string) => {
    await supabase.from("favorite_folder_items").delete()
      .eq("folder_id", folderId).eq("favorite_id", favoriteId);
    setFolders((p) => p.map((f) => f.id === folderId ? { ...f, item_count: Math.max(0, f.item_count - 1) } : f));
  }, []);

  return { folders, loading, refresh, createFolder, renameFolder, deleteFolder, addFavoriteToFolder, removeFavoriteFromFolder };
}
