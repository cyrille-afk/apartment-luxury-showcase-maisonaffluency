import { useState } from "react";
import { Link } from "react-router-dom";
import { FolderOpen, Plus, MoreVertical, Trash2, Pencil } from "lucide-react";
import { useFavoriteFolders } from "@/hooks/useFavoriteFolders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export function FavoriteFoldersGrid({ userId, readOnly = false }: { userId?: string; readOnly?: boolean } = {}) {
  const { folders, loading, createFolder, renameFolder, deleteFolder } = useFavoriteFolders(userId);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createFolder(newName);
    setNewName("");
    setCreating(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-foreground">Favorite Folders</h2>
        {!readOnly && (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)} className="h-8 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New folder
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : folders.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center">
          <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="font-body text-sm text-muted-foreground mb-3">No folders yet</p>
          {!readOnly && (
            <Button size="sm" variant="outline" onClick={() => setCreating(true)} className="h-8 text-xs">
              Create your first folder
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {folders.map((f) => (
            <div key={f.id} className="group relative border border-border rounded-lg overflow-hidden hover:border-foreground/30 transition-colors">
              <Link to={`/trade/favorites/folders/${f.id}`} className="block">
                <div className="aspect-square bg-muted/30 flex items-center justify-center">
                  {f.cover_image_url ? (
                    <img src={f.cover_image_url} alt={f.name} className="w-full h-full object-cover" />
                  ) : (
                    <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
                  )}
                </div>
                <div className="p-3">
                  <p className="font-body text-sm text-foreground truncate">{f.name}</p>
                  <p className="font-body text-[11px] text-muted-foreground">{f.item_count} item{f.item_count === 1 ? "" : "s"}</p>
                </div>
              </Link>
              {!readOnly && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="icon" className="h-7 w-7"><MoreVertical className="h-3.5 w-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setRenameTarget({ id: f.id, name: f.name })}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deleteFolder(f.id)} className="text-destructive">
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>New folder</DialogTitle></DialogHeader>
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="e.g. Penthouse Living Room"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename folder</DialogTitle></DialogHeader>
          <Input
            autoFocus
            value={renameTarget?.name || ""}
            onChange={(e) => setRenameTarget((p) => p ? { ...p, name: e.target.value } : p)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && renameTarget) {
                await renameFolder(renameTarget.id, renameTarget.name);
                setRenameTarget(null);
              }
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={async () => {
              if (renameTarget) {
                await renameFolder(renameTarget.id, renameTarget.name);
                setRenameTarget(null);
              }
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
