import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FunnelEntry } from "@/hooks/useSalesFunnel";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const consequences = {
  cart: "The abandoned-bag record and its test payment tracking will be deleted. The customer's saved basket is not changed.",
  inquiry: "The inquiry and its test payment tracking will be permanently deleted.",
  quote: "The quotation, its items and related quotation records will be permanently deleted. Linked inquiries are kept.",
  order: "The unpaid order and its order items will be permanently deleted.",
  acquisition: "The acquisition lead and its related outreach records will be permanently deleted. Studio accounts and memberships are kept.",
};

export default function SalesFunnelDeleteControl({ entry }: { entry: FunnelEntry }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const source = entry.source;
  if (!source) return null;

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error: failure } = await supabase.rpc("admin_delete_sales_funnel_entry", { _source: source, _id: entry.id });
      if (failure) throw failure;
      await queryClient.invalidateQueries({ queryKey: ["sales-funnel"] });
      setOpen(false);
      toast({ title: "Entry deleted" });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : (failure as { message?: string })?.message || "Could not delete this entry. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return <>
    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" title="Delete entry" aria-label={`Delete ${entry.label}`} onClick={() => { setError(null); setOpen(true); }}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
    <AlertDialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this funnel entry?</AlertDialogTitle>
          <AlertDialogDescription>{consequences[source]} This cannot be undone. Records linked to real payments are protected.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="border-y border-border py-3">
          <p className="font-display text-lg text-foreground">{entry.label}</p>
          <p className="break-words text-sm text-muted-foreground">{entry.email || entry.sublabel}</p>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" disabled={busy} onClick={remove}>{busy ? "Deleting…" : "Delete permanently"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}