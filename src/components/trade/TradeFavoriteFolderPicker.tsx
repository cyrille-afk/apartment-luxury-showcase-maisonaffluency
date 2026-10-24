import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, FolderOpen, FolderPlus, Heart, Loader2, Plus, Trash2 } from "lucide-react";
import { useStudio } from "@/hooks/useStudio";
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
  /** Product name used in project-folder confirmations. */
  productName?: string;
}

/**
 * Artemest-style folder picker for trade users.
 * Persists folders + assignments in `favorite_folders` / `favorite_folder_items`.
 */
const TradeFavoriteFolderPicker = ({ productId, meta, children, align = "end", side = "bottom", productName }: Props) => {
  const { user } = useAuth();
  const { currentStudio } = useStudio();
  const [boards, setBoards] = useState<{ id: string; title: string }[]>([]);
  const [inBoards, setInBoards] = useState<Set<string>>(new Set());
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
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

    // Project folders (client boards) for the current studio
    let bq = supabase.from("client_boards").select("id, title").order("created_at", { ascending: false });
    bq = currentStudio
      ? bq.or(`studio_id.eq.${currentStudio.id},and(studio_id.is.null,user_id.eq.${user.id})`)
      : bq.eq("user_id", user.id);
    const { data: bdata } = await bq;
    const blist = (bdata || []) as { id: string; title: string }[];
    setBoards(blist);
    if (blist.length) {
      const { data: bi } = await supabase.from("client_board_items").select("board_id").in("board_id", blist.map((b) => b.id)).eq("product_id", realId);
      setInBoards(new Set((bi || []).map((r: any) => r.board_id)));
    } else setInBoards(new Set());

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
  }, [user, resolveRealId, currentStudio?.id]);

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

  // Close the menu when the user scrolls the page or resizes the viewport.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
    };
  }, [open]);

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

  const addToBoard = async (boardId: string, title: string) => {
    if (!user || inBoards.has(boardId)) return;
    setBusy(true);
    try {
      const realId = await resolveRealId();
      if (!realId) { toast.error("Could not add to project folder"); return; }
      const { data: last } = await supabase.from("client_board_items").select("sort_order").eq("board_id", boardId).order("sort_order", { ascending: false }).limit(1);
      const next = last && last.length ? ((last[0] as any).sort_order ?? 0) + 1 : 0;
      const { error } = await supabase.from("client_board_items").insert({ board_id: boardId, product_id: realId, sort_order: next });
      if (error) { toast.error("Could not add to project folder", { description: error.message }); return; }
      setInBoards((prev) => new Set(prev).add(boardId));
      await ensureFavoriteRow();
      toast.success("Added to project folder", { description: `${productName || meta?.product_name || "Piece"} → ${title}` });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateBoard = async () => {
    if (!user) return;
    const title = newBoardName.trim();
    if (!title) { setCreatingBoard(false); return; }
    setBusy(true);
    let board: { id: string; title: string } | null = null;
    try {
      const { data, error } = await supabase
        .from("client_boards")
        .insert({ user_id: user.id, studio_id: currentStudio?.id ?? null, title, client_name: "" } as any)
        .select("id, title")
        .single();
      if (error || !data) { toast.error("Could not create project folder"); return; }
      board = data as { id: string; title: string };
      setBoards((prev) => [board!, ...prev]);
      setNewBoardName("");
      setCreatingBoard(false);
    } finally {
      setBusy(false);
    }
    if (board) await addToBoard(board.id, board.title);
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
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {children}
      </PopoverTrigger>

      {/* Backdrop: closes the menu on tap/scroll and provides a subtle dimmed blur. */}
      {open && typeof document !== "undefined" &&
        createPortal(
          <div
            aria-hidden="true"
            className="fixed inset-0 z-[119] bg-black/[0.04] backdrop-blur-[2px] transition-opacity duration-200"
            onPointerDown={() => setOpen(false)}
          />,
          document.body
        )}

      <PopoverContent
        align={align}
        side={side}
        className="w-72 p-0 bg-background border border-border shadow-[0_22px_60px_-20px_rgba(0,0,0,0.12)] z-[120] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:duration-200 data-[state=closed]:duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-3 pb-2 border-b border-border">
          <p className="font-display text-sm tracking-wide text-foreground flex items-center gap-2">
            Save to folder
            {busy && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
          </p>
          <p className="font-body text-[11px] text-muted-foreground mt-0.5">
            Favorite folders for mood and rooms; project folders for client work.
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
          <p className="px-4 pt-3 pb-1 font-body text-[10px] uppercase tracking-wider text-muted-foreground">Favorite folders</p>
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

        <div className="border-t border-border overflow-hidden">
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              disabled={busy}
              className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/50 transition-colors animate-in slide-in-from-bottom-2 fade-in duration-200 disabled:opacity-50"
            >
              <FolderPlus size={14} className="text-foreground" />
              <span className="font-body text-xs text-foreground">New favorite folder</span>
            </button>
          ) : (
            <div className="px-4 py-3 animate-in slide-in-from-bottom-4 fade-in duration-200">
              <p className="font-display text-xs tracking-wide text-foreground mb-2">New folder</p>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") { setCreating(false); setNewName(""); }
                }}
                placeholder="e.g., Bel Air Living Room"
                maxLength={60}
                className="w-full bg-transparent border-b border-border focus:border-foreground outline-hidden font-body text-xs py-1 placeholder:font-serif placeholder:italic placeholder:text-xs placeholder:text-muted-foreground/60"
              />
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={handleCreateFolder}
                  disabled={busy || !newName.trim()}
                  className="font-body text-[11px] uppercase tracking-wider text-background bg-foreground px-3 py-1.5 rounded-sm hover:bg-foreground/85 transition-colors disabled:opacity-40"
                >
                  Create
                </button>
                <button
                  onClick={() => { setCreating(false); setNewName(""); }}
                  className="font-body text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        <div className="border-t border-border">
          <p className="px-4 pt-3 pb-1 font-body text-[10px] uppercase tracking-wider text-muted-foreground">Project folders</p>
          <div className="max-h-44 overflow-y-auto pb-1">
            {boards.length === 0 && !creatingBoard && (
              <p className="px-4 py-2 font-body text-[11px] text-muted-foreground">No project folders yet.</p>
            )}
            {boards.map((b) => {
              const done = inBoards.has(b.id);
              return (
                <button
                  key={b.id}
                  onClick={() => addToBoard(b.id, b.title)}
                  disabled={busy || done}
                  className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-muted/50 transition-colors disabled:cursor-default"
                >
                  {done ? <Check size={14} className="text-foreground shrink-0" /> : <FolderOpen size={14} className="text-muted-foreground shrink-0" />}
                  <span className="font-body text-xs text-foreground truncate">{b.title}</span>
                </button>
              );
            })}
          </div>
          {!creatingBoard ? (
            <button
              onClick={() => setCreatingBoard(true)}
              disabled={busy}
              className="w-full flex items-center gap-2 px-4 py-2.5 border-t border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              <Plus size={14} className="text-[hsl(var(--gold))]" />
              <span className="font-body text-xs text-foreground">New project folder</span>
            </button>
          ) : (
            <div className="px-4 py-3 border-t border-border">
              <input
                autoFocus
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateBoard();
                  if (e.key === "Escape") { setCreatingBoard(false); setNewBoardName(""); }
                }}
                placeholder="e.g., New Residential Project"
                maxLength={60}
                className="w-full bg-transparent border-b border-border focus:border-foreground outline-hidden font-body text-xs py-1 placeholder:font-serif placeholder:italic placeholder:text-xs placeholder:text-muted-foreground/60"
              />
              <div className="mt-3 flex items-center gap-3">
                <button onClick={handleCreateBoard} disabled={busy || !newBoardName.trim()} className="font-body text-[11px] uppercase tracking-wider text-background bg-foreground px-3 py-1.5 rounded-sm hover:bg-foreground/85 transition-colors disabled:opacity-40">Create</button>
                <button onClick={() => { setCreatingBoard(false); setNewBoardName(""); }} className="font-body text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TradeFavoriteFolderPicker;
