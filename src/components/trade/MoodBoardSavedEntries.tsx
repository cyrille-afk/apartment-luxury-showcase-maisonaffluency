import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListFilter, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { moodBoardEntryFinish, removableMoodBoardEntry, type MoodBoardSavedEntry } from "@/lib/moodBoardSavedEntries";

export function MoodBoardSavedEntries({ projectId, productId, productName }: { projectId: string; productId: string; productName: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<MoodBoardSavedEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["mood-board-saved-entries", user?.id, projectId, productId],
    enabled: !!user,
    queryFn: async () => {
      const boards = await supabase.from("client_boards").select("id,title").eq("project_id", projectId).eq("user_id", user?.id || "");
      if (boards.error) throw boards.error;
      if (!boards.data.length) return { entries: [] as MoodBoardSavedEntry[], titles: new Map<string, string>() };
      const result = await supabase.from("client_board_items").select("id,board_id,product_id,variant_label,wood_label,fabric_label,procurement_quote_id,source_quote_item_id").in("board_id", boards.data.map(board => board.id)).eq("product_id", productId).order("created_at");
      if (result.error) throw result.error;
      return { entries: result.data, titles: new Map(boards.data.map(board => [board.id, board.title])) };
    },
  });
  const remove = async () => {
    if (!selected || deleting || !removableMoodBoardEntry(selected) || !data?.entries.some(entry => entry.id === selected.id)) return;
    setDeleting(true);
    setError(null);
    try {
      const result = await supabase.from("client_board_items").delete().eq("id", selected.id).eq("board_id", selected.board_id).eq("product_id", productId).is("procurement_quote_id", null).is("source_quote_item_id", null).select("id");
      if (result.error || result.data?.length !== 1) throw new Error("Removal failed");
      setSelected(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mood-board-saved-entries"] }),
        queryClient.invalidateQueries({ queryKey: ["mood-board-tearsheet-products"] }),
        queryClient.invalidateQueries({ queryKey: ["mood-board-project-items"] }),
      ]);
      window.dispatchEvent(new Event("trade-projects:changed"));
    } catch {
      setError("This entry couldn't be removed. Please try again; quote-linked pieces cannot be deleted here.");
    } finally { setDeleting(false); }
  };
  if (!data?.entries.length && !isError) return null;
  return <>
    <Button variant="outline" size="sm" className="absolute bottom-2 right-2 h-7 gap-1 bg-background/90 px-2 text-[10px]" aria-label={`Manage saved entries for ${productName}`} onClick={() => { setOpen(true); setSelected(null); setError(null); void refetch(); }}>
      <ListFilter className="h-3 w-3" />{data?.entries.length ?? ""} saved
    </Button>
    <Dialog open={open} onOpenChange={value => { if (!deleting) { setOpen(value); setSelected(null); setError(null); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Saved entries · {productName}</DialogTitle><DialogDescription>Remove individual entries from the named board. Your current Mood board card, quotes and other entries stay unchanged.</DialogDescription></DialogHeader>
        {isError ? <div className="space-y-2"><p role="alert" className="text-sm text-destructive">Saved entries couldn't load.</p><Button variant="outline" onClick={() => void refetch()}>Try again</Button></div> : <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {isFetching && <Loader2 aria-label="Loading saved entries" className="h-4 w-4 animate-spin" />}
          {data?.entries.map((entry, index) => <div key={entry.id} className="flex items-center gap-3 border-b border-border py-3">
            <div className="min-w-0 flex-1"><p className="font-body text-sm">{data.titles.get(entry.board_id)} · Entry {index + 1}</p><p className="break-words text-xs text-muted-foreground">{moodBoardEntryFinish(entry)}</p>{!removableMoodBoardEntry(entry) && <p className="text-xs text-muted-foreground">Linked to a quote · protected</p>}</div>
            <Button variant="ghost" size="icon" disabled={deleting || !removableMoodBoardEntry(entry)} aria-label={`Remove saved entry ${index + 1} from ${data.titles.get(entry.board_id)}`} title="Remove this saved entry" onClick={() => { setSelected(entry); setError(null); }}><Trash2 className="h-4 w-4" /></Button>
          </div>)}
          {data?.entries.length === 0 && <p className="text-sm text-muted-foreground">No saved entries remain.</p>}
        </div>}
        {selected && <div className="space-y-3 border-t border-border pt-3"><p className="text-sm">Remove this {moodBoardEntryFinish(selected)} entry from “{data?.titles.get(selected.board_id)}”?</p><div className="flex justify-end gap-2"><Button variant="outline" disabled={deleting} onClick={() => setSelected(null)}>Cancel</Button><Button variant="destructive" disabled={deleting} onClick={() => void remove()}>{deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Remove saved entry</Button></div></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  </>;
}