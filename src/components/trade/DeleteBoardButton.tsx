import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";

export function DeleteBoardButton({ board, onDeleted }: { board: { id: string; title: string; project_id: string | null }; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setItemCount(null);
    setChecking(true);
    supabase.from("client_board_items").select("id", { count: "exact", head: true }).eq("board_id", board.id)
      .then(({ count, error: readError }) => {
        if (!active) return;
        if (readError || count === null) setError("The folder's contents could not be checked. Close this message and try again.");
        else setItemCount(count);
        setChecking(false);
      }, () => {
        if (!active) return;
        setError("The folder's contents could not be checked. Close this message and try again.");
        setChecking(false);
      });
    return () => { active = false; };
  }, [open, board.id]);
  const remove = async () => {
    if (deleting || checking || itemCount === null) return;
    setDeleting(true);
    setError(null);
    try {
      const result = await supabase.from("client_boards").delete().eq("id", board.id).select("id").single();
      if (result.error || result.data?.id !== board.id) {
        setError("This folder couldn't be deleted. Check that you have permission, then try again.");
        return;
      }
      window.dispatchEvent(new CustomEvent("concierge:artifacts-changed", { detail: { deletedBoardId: board.id } }));
      setOpen(false);
      onDeleted();
    } catch {
      setError("This folder couldn't be deleted. Please try again.");
    } finally {
      setDeleting(false);
    }
  };
  return <>
    <Button variant="ghost" size="icon" className="size-8 shrink-0 cursor-pointer text-destructive hover:text-destructive" aria-label={`Delete folder ${board.title}`} title="Delete folder" onClick={event => { event.stopPropagation(); setError(null); setOpen(true); }}><Trash2 className="size-4" /></Button>
    <AlertDialog open={open} onOpenChange={value => { if (!deleting) setOpen(value); }}>
      <AlertDialogContent className="max-w-[min(32rem,calc(100vw-2rem))]" onClick={event => event.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{board.title}”?</AlertDialogTitle>
          <AlertDialogDescription>{checking ? "Checking this folder's contents… " : itemCount !== null ? `This folder contains ${itemCount} ${itemCount === 1 ? "item" : "items"}. ` : ""}This permanently removes this folder, its items, comments and share links. Your project and other folders remain unchanged.</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <Button variant="outline" disabled={deleting} onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" disabled={deleting || checking || itemCount === null} onClick={() => void remove()}>{deleting ? "Deleting…" : "Delete folder"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}