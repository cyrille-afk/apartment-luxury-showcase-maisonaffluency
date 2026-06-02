import { useCallback, useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, FolderPlus, Heart, Trash2, X } from "lucide-react";
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
}

const FavoriteFolderPicker = ({ pickId, children, align = "end", side = "bottom", onChange }: Props) => {
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

  const handleToggleFavorite = () => {
    if (favorited) removeFavorite(pickId);
    else addFavorite(pickId);
    refresh();
    onChange?.();
  };

  const handleToggleFolder = (folderId: string) => {
    togglePickInFolder(pickId, folderId);
    refresh();
    onChange?.();
  };

  const handleCreateFolder = () => {
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
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className="w-72 p-0 bg-background border-border z-[120]"
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
                className="font-body text-[10px] uppercase tracking-wider text-foreground hover:text-primary"
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

export default FavoriteFolderPicker;
