import { useState } from "react";
import { FolderPlus, Plus, Check } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFavoriteFolders } from "@/hooks/useFavoriteFolders";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  favoriteId: string;
  size?: "icon" | "sm";
}

export function AddToFolderMenu({ favoriteId, size = "icon" }: Props) {
  const { user } = useAuth();
  const { folders, createFolder, addFavoriteToFolder } = useFavoriteFolders();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  const loadMembership = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("favorite_folder_items")
      .select("folder_id")
      .eq("favorite_id", favoriteId);
    setMemberOf(new Set((data || []).map((d: any) => d.folder_id)));
  };

  const handleAdd = async (folderId: string) => {
    const ok = await addFavoriteToFolder(folderId, favoriteId);
    if (ok) {
      setMemberOf((p) => new Set(p).add(folderId));
      toast({ title: "Added to folder" });
    }
  };

  const handleCreate = async () => {
    const id = await createFolder(newName);
    if (id) {
      await addFavoriteToFolder(id, favoriteId);
      setMemberOf((p) => new Set(p).add(id));
      toast({ title: `Created "${newName}"` });
      setNewName("");
      setCreating(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={(o) => { setOpen(o); if (o) loadMembership(); }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={size === "icon" ? "icon" : "sm"} className="h-8 w-8">
          <FolderPlus className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 z-[120]">
        <DropdownMenuLabel className="text-xs">Add to folder</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {folders.length === 0 && !creating && (
          <div className="px-2 py-3 text-xs text-muted-foreground">No folders yet</div>
        )}
        {folders.map((f) => {
          const inFolder = memberOf.has(f.id);
          return (
            <DropdownMenuItem
              key={f.id}
              onClick={(e) => { e.preventDefault(); if (!inFolder) handleAdd(f.id); }}
              className="text-xs"
            >
              <span className="flex-1 truncate">{f.name}</span>
              {inFolder && <Check className="h-3.5 w-3.5 ml-2" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        {creating ? (
          <div className="px-2 py-1.5 flex gap-1">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Folder name"
              className="h-7 text-xs"
            />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={handleCreate}>Add</Button>
          </div>
        ) : (
          <DropdownMenuItem onClick={(e) => { e.preventDefault(); setCreating(true); }} className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-2" /> New folder
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
