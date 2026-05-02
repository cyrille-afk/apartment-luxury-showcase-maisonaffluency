import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BoardItemLite {
  id: string;
  product_id: string;
  approval_status: string;
}

interface BoardLite {
  id: string;
  title: string;
  client_name: string | null;
  studio_id: string | null;
  project_id: string | null;
}

interface Props {
  board: BoardLite;
  items: BoardItemLite[];
  userId: string;
  disabled?: boolean;
}

export const CreateQuoteFromBoard = ({ board, items, userId, disabled }: Props) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [existingQuote, setExistingQuote] = useState<{ id: string } | null>(null);
  const [pendingItems, setPendingItems] = useState<BoardItemLite[]>([]);

  const eligibleItems = items.filter((i) => (i.approval_status || "").toLowerCase() !== "rejected");

  const insertItems = async (quoteId: string, list: BoardItemLite[]) => {
    if (list.length === 0) return 0;

    // Avoid duplicates if adding to an existing quote
    const { data: existingLines } = await supabase
      .from("trade_quote_items")
      .select("product_id")
      .eq("quote_id", quoteId);
    const existing = new Set((existingLines || []).map((l: any) => l.product_id));

    const rows = list
      .filter((i) => !existing.has(i.product_id))
      .map((i) => ({ quote_id: quoteId, product_id: i.product_id, quantity: 1 }));

    if (rows.length === 0) return 0;
    const { error } = await supabase.from("trade_quote_items").insert(rows as any);
    if (error) throw error;
    return rows.length;
  };

  const logAction = async (quoteId: string, mode: "new" | "merged") => {
    try {
      await supabase.from("trade_concierge_actions").insert([{
        user_id: userId,
        tool: "create_quote_from_tearsheet",
        status: "approved",
        resulting_resource_type: "trade_quote",
        resulting_resource_id: quoteId,
        args: {
          board_id: board.id,
          board_title: board.title,
          project_id: board.project_id,
          item_count: eligibleItems.length,
          mode,
        } as any,
      }] as any);
    } catch {
      // non-blocking
    }
  };

  const createNewQuote = async (skipMergeCheck = false) => {
    if (eligibleItems.length === 0) {
      toast.error("No eligible items", { description: "All items are rejected — nothing to quote." });
      return;
    }

    setBusy(true);
    try {
      // If a draft quote already exists for this project, prompt the user
      if (!skipMergeCheck && board.project_id) {
        const { data: drafts } = await supabase
          .from("trade_quotes")
          .select("id")
          .eq("project_id", board.project_id)
          .eq("status", "draft")
          .order("updated_at", { ascending: false })
          .limit(1);
        if (drafts && drafts.length > 0) {
          setExistingQuote({ id: drafts[0].id });
          setPendingItems(eligibleItems);
          setBusy(false);
          return;
        }
      }

      const { data: quote, error } = await supabase
        .from("trade_quotes")
        .insert({
          user_id: userId,
          studio_id: board.studio_id ?? null,
          status: "draft",
          client_name: board.client_name ?? null,
          project_id: board.project_id ?? null,
        } as any)
        .select("id")
        .single();

      if (error || !quote) {
        toast.error("Couldn't create quote", { description: error?.message });
        return;
      }

      const added = await insertItems(quote.id, eligibleItems);
      await logAction(quote.id, "new");
      toast.success("Quote created", {
        description: `Pre-filled with ${added} ${added === 1 ? "item" : "items"} from this tearsheet.`,
      });
      navigate(`/trade/quotes?quote=${quote.id}`);
    } catch (err: any) {
      toast.error("Couldn't create quote", { description: err?.message });
    } finally {
      setBusy(false);
    }
  };

  const mergeIntoExisting = async () => {
    if (!existingQuote) return;
    setBusy(true);
    try {
      const added = await insertItems(existingQuote.id, pendingItems);
      await logAction(existingQuote.id, "merged");
      toast.success(
        added > 0 ? "Items added to existing draft" : "Already on this draft",
        {
          description:
            added > 0
              ? `Added ${added} ${added === 1 ? "item" : "items"} to the existing draft quote.`
              : "All eligible items were already on the existing draft.",
        },
      );
      navigate(`/trade/quotes?quote=${existingQuote.id}`);
    } catch (err: any) {
      toast.error("Couldn't add to existing quote", { description: err?.message });
    } finally {
      setBusy(false);
      setExistingQuote(null);
      setPendingItems([]);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => createNewQuote()}
        disabled={busy || disabled || eligibleItems.length === 0}
        className="gap-1.5"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
        Create Quote
      </Button>

      <AlertDialog open={!!existingQuote} onOpenChange={(open) => !open && setExistingQuote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Existing draft quote found</AlertDialogTitle>
            <AlertDialogDescription>
              A draft quote already exists for this project. Add these {pendingItems.length}{" "}
              {pendingItems.length === 1 ? "item" : "items"} to it, or start a fresh quote?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setExistingQuote(null);
                createNewQuote(true);
              }}
            >
              Create new quote
            </Button>
            <AlertDialogAction disabled={busy} onClick={mergeIntoExisting}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add to existing"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CreateQuoteFromBoard;
