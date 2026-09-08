import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, FolderPlus, Heart, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FAV_EVENT,
  FOLDERS_EVENT,
  type Folder,
  addFavorite,
  createFolder,
  deleteFolder,
  getFoldersForPick,
  isFavorited as isFavoritedFn,
  readFolders,
  removeFavorite,
  togglePickInFolder,
} from "@/lib/favoriteFolders";

interface Props {
  pickId: string;
  children: React.ReactNode; // the heart trigger (button/span)
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  /** Called whenever favorite state or folder assignments change. */
  onChange?: () => void;
  /**
   * Optional auth interception. The menu stays browsable for signed-out users;
   * only when they trigger an action do we hand off to this gate.
   */
  requireAuth?: (callback: () => void, actionLabel?: string) => void;
  /** Extra classes for the popover surface (e.g. positioning tweaks). */
  contentClassName?: string;
}

const FavoriteFolderPicker = ({
  pickId,
  children,
  align = "end",
  side = "bottom",
  onChange,
  requireAuth,
  contentClassName,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [favorited, setFavorited] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const refresh = useCallback(() => {
    setFolders(readFolders());
    setSelected(getFoldersForPick(pickId));
    setFavorited(isFavoritedFn(pickId));
  }, [pickId]);

  useEffect(() => {
    refresh();
    const on = () => refresh();
    window.addEventListener(FAV_EVENT, on);
    window.addEventListener(FOLDERS_EVENT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(FAV_EVENT, on);
      window.removeEventListener(FOLDERS_EVENT, on);
      window.removeEventListener("storage", on);
    };
  }, [refresh]);

  useEffect(() => { if (open) refresh(); }, [open, refresh]);

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

  /** Runs the action, or hands off to the auth gate for signed-out visitors. */
  const gate = useCallback(
    (action: () => void, label: string) => {
      if (!requireAuth) { action(); return; }
      let allowed = false;
      requireAuth(() => { allowed = true; }, label);
      if (allowed) action();
      else setOpen(false);
    },
    [requireAuth]
  );

  const handleToggleFavorite = () => gate(() => {
    if (favorited) removeFavorite(pickId);
    else addFavorite(pickId);
    refresh();
    onChange?.();
  }, "save pieces to your favorites");

  const handleToggleFolder = (folderId: string) => gate(() => {
    togglePickInFolder(pickId, folderId);
    refresh();
    onChange?.();
  }, "organise favorites into folders");

  const handleCreateFolder = () => gate(() => {
    const name = newName.trim();
    if (!name) { setCreating(false); return; }
    const f = createFolder(name);
    togglePickInFolder(pickId, f.id);
    setNewName("");
    setCreating(false);
    refresh();
    onChange?.();
  };

  const handleDeleteFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this folder? Pieces saved in it will remain in your favorites.")) return;
    deleteFolder(folderId);
    refresh();
    onChange?.();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        asChild
        onClick={(e) => { e.stopPropagation(); }}
      >
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
        {/* Header */}
        <div className="px-4 pt-3 pb-2 border-b border-border">
          <p className="font-display text-sm tracking-wide text-foreground">Save to folder</p>
          <p className="font-body text-[11px] text-muted-foreground mt-0.5">
            Organize favorites by project, room, or mood.
          </p>
        </div>

        {/* Quick favorite toggle */}
        <button
          onClick={handleToggleFavorite}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors border-b border-border"
        >
          <span className="flex items-center gap-2 font-body text-xs text-foreground">
            <Heart size={14} className={cn(favorited && "fill-destructive text-destructive")} />
            {favorited ? "Saved to favorites" : "Save to favorites"}
          </span>
          {favorited && <Check size={14} className="text-foreground" />}
        </button>

        {/* Folder list */}
        <div className="max-h-56 overflow-y-auto">
          {folders.length === 0 && !creating && (
            <p className="px-4 py-4 text-center font-body text-[11px] text-muted-foreground">
              No folders yet. Create one to group pieces.
            </p>
          )}
          {folders.map((f) => {
            const checked = selected.includes(f.id);
            return (
              <div
                key={f.id}
                onClick={() => handleToggleFolder(f.id)}
                className="group flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors cursor-pointer"
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

        {/* Create folder */}
        <div className="border-t border-border overflow-hidden">
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/50 transition-colors animate-in slide-in-from-bottom-2 fade-in duration-200"
            >
              <FolderPlus size={14} className="text-foreground" />
              <span className="font-body text-xs text-foreground">New folder</span>
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
                className="w-full bg-transparent border-b border-border focus:border-foreground outline-none font-body text-xs py-1 placeholder:font-serif placeholder:italic placeholder:text-xs placeholder:text-muted-foreground/60"
              />
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={handleCreateFolder}
                  disabled={!newName.trim()}
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
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default FavoriteFolderPicker;
