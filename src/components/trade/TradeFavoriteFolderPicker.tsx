import { useCallback, useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, FolderPlus, Heart, Loader2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ensureTradeProductId, type ProductMeta } from "@/lib/ensureTradeProduct";
import { TRADE_FAVORITES_EVENT } from "@/hooks/useFavorites";
import { toast } from "sonner";

export const TRADE_FAVORITE_FOLDERS_EVENT = "trade_favorite_folders_changed";

interface Folder {
  id: string;
  name: string;
}

interface Props {
  /** Real trade_products UUID OR a local/curator id when meta is provided. */
  productId: string;
  /** Required when productId is a local/non-trade_products id, so a record can be ensured. */
  meta?: ProductMeta;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Artemest-style folder picker for trade users.
 * Persists folders + assignments in `favorite_folders` / `favorite_folder_items`.
 */
const TradeFavoriteFolderPicker = ({ productId, meta, children, align = "end", side = "bottom" }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [favoriteId, setFavoriteId] = useState<string | null>(null); // trade_favorites.id
  const [realProductId, setRealProductId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  // Resolve the real trade_products UUID lazily on first open
  const resolveRealId = useCallback(async (): Promise<string | null> => {
    if (realProductId) return realProductId;
    if (meta) {
      const id = await ensureTradeProductId(meta);
      if (id) setRealProductId(id);
      return id ?? null;
    }
    setRealProductId(productId);
    return productId;
  }, [meta, productId, realProductId]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const realId = await resolveRealId();
    if (!realId) return;

    // Load favorite row id (may not exist yet)
    const { data: fav } = await supabase
      .from("trade_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("product_id", realId)
      .maybeSingle();
    const fid = fav?.id ?? null;
    setFavoriteId(fid);

    // Load folders
    const { data: fdata } = await supabase
      .from("favorite_folders")
      .select("id, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    setFolders((fdata || []) as Folder[]);

    // Load assignments for this favorite
    if (fid) {
      const { data: items } = await supabase
        .from("favorite_folder_items")
        .select("folder_id")
        .eq("favorite_id", fid);
      setSelected(new Set((items || []).map((i: any) => i.folder_id)));
    } else {
      setSelected(new Set());
    }
  }, [user, resolveRealId]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  useEffect(() => {
    const onSync = () => { if (open) refresh(); };
    window.addEventListener(TRADE_FAVORITES_EVENT, onSync);
    window.addEventListener(TRADE_FAVORITE_FOLDERS_EVENT, onSync);
    return () => {
      window.removeEventListener(TRADE_FAVORITES_EVENT, onSync);
      window.removeEventListener(TRADE_FAVORITE_FOLDERS_EVENT, onSync);
    };
  }, [open, refresh]);

  /** Ensure a trade_favorites row exists for this product; return its id. */
  const ensureFavoriteRow = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    if (favoriteId) return favoriteId;
    const realId = await resolveRealId();
    if (!realId) return null;
    const { data, error } = await supabase
      .from("trade_favorites")
      .upsert({ user_id: user.id, product_id: realId }, { onConflict: "user_id,product_id" })
      .select("id")
      .single();
    if (error || !data) return null;
    setFavoriteId(data.id);
    window.dispatchEvent(new Event(TRADE_FAVORITES_EVENT));
    return data.id;
  }, [user, favoriteId, resolveRealId]);

  const handleToggleFavorite = async () => {
    if (!user) return;
    setBusy(true);
    try {
      if (favoriteId) {
        const realId = await resolveRealId();
        if (!realId) return;
        await supabase
          .from("trade_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", realId);
        setFavoriteId(null);
        setSelected(new Set());
        window.dispatchEvent(new Event(TRADE_FAVORITES_EVENT));
      } else {
        await ensureFavoriteRow();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleToggleFolder = async (folderId: string) => {
    if (!user) return;
    setBusy(true);
    try {
      const fid = await ensureFavoriteRow();
      if (!fid) return;
      if (selected.has(folderId)) {
        await supabase
          .from("favorite_folder_items")
          .delete()
          .eq("folder_id", folderId)
          .eq("favorite_id", fid);
        setSelected((prev) => { const next = new Set(prev); next.delete(folderId); return next; });
      } else {
        await supabase
          .from("favorite_folder_items")
          .insert({ folder_id: folderId, favorite_id: fid });
        setSelected((prev) => new Set(prev).add(folderId));
      }
      window.dispatchEvent(new Event(TRADE_FAVORITE_FOLDERS_EVENT));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!user) return;
    const name = newName.trim();
    if (!name) { setCreating(false); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("favorite_folders")
        .insert({ user_id: user.id, name })
        .select("id, name")
        .single();
      if (error || !data) { toast.error("Could not create folder"); return; }
      setFolders((prev) => [...prev, data as Folder]);
      // Auto-assign to the new folder
      const fid = await ensureFavoriteRow();
      if (fid) {
        await supabase.from("favorite_folder_items").insert({ folder_id: data.id, favorite_id: fid });
        setSelected((prev) => new Set(prev).add(data.id));
      }
      setNewName("");
      setCreating(false);
      window.dispatchEvent(new Event(TRADE_FAVORITE_FOLDERS_EVENT));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteFolder = async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this folder? Pieces saved in it will remain in your favorites.")) return;
    setBusy(true);
    try {
      await supabase.from("favorite_folders").delete().eq("id", folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setSelected((prev) => { const next = new Set(prev); next.delete(folderId); return next; });
      window.dispatchEvent(new Event(TRADE_FAVORITE_FOLDERS_EVENT));
    } finally {
      setBusy(false);
    }
  };

  // If not logged in, just pass the trigger through (no popover)
  if (!user) return <>{children}</>;

  const favorited = !!favoriteId;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className="w-72 p-0 bg-background border-border z-[120]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-3 pb-2 border-b border-border">
          <p className="font-display text-sm tracking-wide text-foreground flex items-center gap-2">
            Save to folder
            {busy && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
          </p>
          <p className="font-body text-[11px] text-muted-foreground mt-0.5">
            Organize favorites by project, room, or mood.
          </p>
        </div>

        <button
          onClick={handleToggleFavorite}
          disabled={busy}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors border-b border-border disabled:opacity-50"
        >
          <span className="flex items-center gap-2 font-body text-xs text-foreground">
            <Heart size={14} className={cn(favorited && "fill-destructive text-destructive")} />
            {favorited ? "Saved to favorites" : "Save to favorites"}
          </span>
          {favorited && <Check size={14} className="text-foreground" />}
        </button>

        <div className="max-h-56 overflow-y-auto">
          {folders.length === 0 && !creating && (
            <p className="px-4 py-4 text-center font-body text-[11px] text-muted-foreground">
              No folders yet. Create one to group pieces.
            </p>
          )}
          {folders.map((f) => {
            const checked = selected.has(f.id);
            return (
              <div
                key={f.id}
                onClick={() => !busy && handleToggleFolder(f.id)}
                className={cn(
                  "group flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors",
                  busy ? "cursor-wait" : "cursor-pointer"
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "flex items-center justify-center w-4 h-4 rounded border transition-colors flex-shrink-0",
                      checked ? "bg-foreground border-foreground" : "border-border"
                    )}
                  >
                    {checked && <Check size={11} className="text-background" />}
                  </span>
                  <span className="font-body text-xs text-foreground truncate">{f.name}</span>
                </span>
                <button
                  onClick={(e) => handleDeleteFolder(f.id, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  title="Delete folder"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border">
          {creating ? (
            <div className="flex items-center gap-2 px-3 py-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") { setCreating(false); setNewName(""); }
                }}
                placeholder="Folder name"
                maxLength={60}
                className="flex-1 bg-transparent border-b border-border focus:border-foreground outline-none font-body text-xs py-1"
              />
              <button
                onClick={handleCreateFolder}
                disabled={busy}
                className="font-body text-[10px] uppercase tracking-wider text-foreground hover:text-primary disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => { setCreating(false); setNewName(""); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/50 transition-colors"
            >
              <FolderPlus size={14} className="text-foreground" />
              <span className="font-body text-xs text-foreground">New folder</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TradeFavoriteFolderPicker;
