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

  // Infer a room from a product's category/subcategory. Pure heuristic — the
  // user can always edit per-line after navigating to the quote.
  const inferRoom = (cat: string | null, sub: string | null): string => {
    const t = `${cat || ""} ${sub || ""}`.toLowerCase();
    if (/(bed|nightstand|headboard|dresser|wardrobe)/.test(t)) return "Bedroom";
    if (/(dining|sideboard|buffet|credenza)/.test(t)) return "Dining Room";
    if (/(kitchen|bar stool|barstool)/.test(t)) return "Kitchen";
    if (/(bath|vanit|shower|towel)/.test(t)) return "Bathroom";
    if (/(office|desk|task chair|bookcase)/.test(t)) return "Office";
    if (/(outdoor|garden|patio|terrace)/.test(t)) return "Outdoor";
    if (/(entry|hall|console|coat)/.test(t)) return "Entry";
    if (/(sofa|armchair|lounge|coffee table|side table|tv|media|rug|lighting|chandelier|sconce|lamp|wall art|mirror)/.test(t))
      return "Living Room";
    return "Unassigned";
  };

  const insertItems = async (quoteId: string, list: BoardItemLite[]) => {
    if (list.length === 0) return { added: 0, byRoom: {} as Record<string, number> };

    // Avoid duplicates if adding to an existing quote
    const { data: existingLines } = await supabase
      .from("trade_quote_items")
      .select("product_id")
      .eq("quote_id", quoteId);
    const existing = new Set((existingLines || []).map((l: any) => l.product_id));

    const filtered = list.filter((i) => !existing.has(i.product_id));
    if (filtered.length === 0) return { added: 0, byRoom: {} as Record<string, number> };

    // Look up category/subcategory in one batch to infer rooms.
    const { data: prods } = await supabase
      .from("trade_products")
      .select("id, category, subcategory")
      .in("id", filtered.map((i) => i.product_id));
    const meta = new Map<string, { c: string | null; s: string | null }>();
    for (const p of (prods || []) as any[]) meta.set(p.id, { c: p.category ?? null, s: p.subcategory ?? null });

    const byRoom: Record<string, number> = {};
    const rows = filtered.map((i) => {
      const m = meta.get(i.product_id);
      const room = inferRoom(m?.c ?? null, m?.s ?? null);
      byRoom[room] = (byRoom[room] || 0) + 1;
      return { quote_id: quoteId, product_id: i.product_id, quantity: 1, room };
    });

    const { error } = await supabase.from("trade_quote_items").insert(rows as any);
    if (error) throw error;
    return { added: rows.length, byRoom };
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
      window.dispatchEvent(new CustomEvent("concierge:stage", {
        detail: {
          stage: "Quote",
          message: `We've moved on from the tearsheet "${board.title}" to a new draft quote (pre-filled with ${added} ${added === 1 ? "item" : "items"}). What would you like to tackle next?`,
          actions: [
            { label: "Adjust quantities", prompt: "Walk me through the line items so I can adjust quantities — list them with current qty and ask which ones to change." },
            { label: "Add finishing details", prompt: "Help me add finishing details (fabric, finish, COM/COL, custom dimensions) to each line item. Start with the first one." },
            { label: "Prepare to send", prompt: "Help me get this quote ready to submit: review missing info, suggest a client-facing note, and outline the next step." },
          ],
        },
      }));
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
      window.dispatchEvent(new CustomEvent("concierge:stage", {
        detail: {
          stage: "Quote",
          message: added > 0
            ? `We've moved on from the tearsheet "${board.title}" to the existing draft quote — ${added} ${added === 1 ? "piece" : "pieces"} just added.`
            : `We're now on the existing draft quote for this project — every eligible piece from "${board.title}" was already on it.`,
          actions: [
            { label: "Adjust quantities", prompt: "Walk me through the line items so I can adjust quantities — list them with current qty and ask which ones to change." },
            { label: "Add finishing details", prompt: "Help me add finishing details (fabric, finish, COM/COL, custom dimensions) to each line item. Start with the first one." },
            { label: "Prepare to send", prompt: "Help me get this quote ready to submit: review missing info, suggest a client-facing note, and outline the next step." },
          ],
        },
      }));
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
