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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

interface ReviewRow {
  product_id: string;
  product_name: string;
  brand_name: string | null;
  image_url: string | null;
  room: string;
}

const COMMON_ROOMS = [
  "Living Room",
  "Dining Room",
  "Kitchen",
  "Bedroom",
  "Primary Bedroom",
  "Guest Bedroom",
  "Bathroom",
  "Office",
  "Entry",
  "Outdoor",
  "Unassigned",
];

export const CreateQuoteFromBoard = ({ board, items, userId, disabled }: Props) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [existingQuote, setExistingQuote] = useState<{ id: string } | null>(null);
  const [pendingItems, setPendingItems] = useState<BoardItemLite[]>([]);

  // Room review step (opens before any DB write)
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [bulkRoom, setBulkRoom] = useState("");

  const eligibleItems = items.filter((i) => (i.approval_status || "").toLowerCase() !== "rejected");

  // Infer a room from a product's category/subcategory.
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

  /** Open the review dialog: fetch product metadata + infer rooms. */
  const openReview = async () => {
    if (eligibleItems.length === 0) {
      toast.error("No eligible items", { description: "All items are rejected — nothing to quote." });
      return;
    }
    setReviewOpen(true);
    setReviewLoading(true);
    try {
      const { data: prods } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, image_url, category, subcategory")
        .in("id", eligibleItems.map((i) => i.product_id));
      const meta = new Map<string, any>();
      for (const p of (prods || []) as any[]) meta.set(p.id, p);
      // Preserve tearsheet order; deduplicate by product_id (first appearance wins)
      const seen = new Set<string>();
      const rows: ReviewRow[] = [];
      for (const i of eligibleItems) {
        if (seen.has(i.product_id)) continue;
        seen.add(i.product_id);
        const m = meta.get(i.product_id);
        rows.push({
          product_id: i.product_id,
          product_name: m?.product_name || "Untitled",
          brand_name: m?.brand_name ?? null,
          image_url: m?.image_url ?? null,
          room: inferRoom(m?.category ?? null, m?.subcategory ?? null),
        });
      }
      setReviewRows(rows);
    } catch (err: any) {
      toast.error("Couldn't load items", { description: err?.message });
      setReviewOpen(false);
    } finally {
      setReviewLoading(false);
    }
  };

  const updateRoom = (product_id: string, room: string) => {
    setReviewRows((prev) => prev.map((r) => (r.product_id === product_id ? { ...r, room } : r)));
  };

  const applyBulk = () => {
    const v = bulkRoom.trim();
    if (!v) return;
    setReviewRows((prev) => prev.map((r) => ({ ...r, room: v })));
    setBulkRoom("");
  };

  const insertItems = async (
    quoteId: string,
    list: BoardItemLite[],
    roomByProductId: Map<string, string>,
  ) => {
    if (list.length === 0) return { added: 0, byRoom: {} as Record<string, number> };

    // Avoid duplicates if adding to an existing quote
    const { data: existingLines } = await supabase
      .from("trade_quote_items")
      .select("product_id")
      .eq("quote_id", quoteId);
    const existing = new Set((existingLines || []).map((l: any) => l.product_id));

    const filtered = list.filter((i) => !existing.has(i.product_id));
    if (filtered.length === 0) return { added: 0, byRoom: {} as Record<string, number> };

    const byRoom: Record<string, number> = {};
    const rows = filtered.map((i) => {
      const room = (roomByProductId.get(i.product_id) || "Unassigned").trim() || "Unassigned";
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

  const confirmReview = async () => {
    setReviewOpen(false);
    await createNewQuote();
  };

  const roomMap = (): Map<string, string> => {
    const m = new Map<string, string>();
    for (const r of reviewRows) m.set(r.product_id, r.room);
    return m;
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

      const { added, byRoom } = await insertItems(quote.id, eligibleItems, roomMap());
      await logAction(quote.id, "new");
      const roomBreakdown = Object.entries(byRoom)
        .sort((a, b) => b[1] - a[1])
        .map(([r, n]) => `${r} (${n})`)
        .join(", ");
      toast.success("Quote created", {
        description: `Pre-filled with ${added} ${added === 1 ? "item" : "items"} from this tearsheet.`,
      });
      window.dispatchEvent(new CustomEvent("concierge:stage", {
        detail: {
          stage: "Quote",
          message: `We've moved on from the tearsheet "${board.title}" to a new draft quote (pre-filled with ${added} ${added === 1 ? "item" : "items"}).${roomBreakdown ? ` Items have been grouped by room — ${roomBreakdown}. You can refine the room assignments on each line.` : ""} What would you like to tackle next?`,
          actions: [
            { label: "Refine rooms", prompt: "Help me refine the room assignments for the quote items — list them grouped by room and suggest changes for any that look off." },
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
      const { added, byRoom } = await insertItems(existingQuote.id, pendingItems, roomMap());
      await logAction(existingQuote.id, "merged");
      const roomBreakdown = Object.entries(byRoom)
        .sort((a, b) => b[1] - a[1])
        .map(([r, n]) => `${r} (${n})`)
        .join(", ");
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
            ? `We've moved on from the tearsheet "${board.title}" to the existing draft quote — ${added} ${added === 1 ? "piece" : "pieces"} just added.${roomBreakdown ? ` New items were grouped by room — ${roomBreakdown}.` : ""}`
            : `We're now on the existing draft quote for this project — every eligible piece from "${board.title}" was already on it.`,
          actions: [
            { label: "Refine rooms", prompt: "Help me refine the room assignments for the quote items — list them grouped by room and suggest changes for any that look off." },
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

  // Suggested rooms = common list ∪ rooms already chosen in this review
  const datalistId = `tearsheet-rooms-${board.id}`;
  const suggestedRooms = Array.from(
    new Set([...COMMON_ROOMS, ...reviewRows.map((r) => r.room).filter(Boolean)])
  );

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={openReview}
        disabled={busy || disabled || eligibleItems.length === 0}
        className="gap-1.5"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
        Create Quote
      </Button>

      {/* Room review step */}
      <Dialog open={reviewOpen} onOpenChange={(open) => !open && !busy && setReviewOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display">Assign rooms</DialogTitle>
            <DialogDescription>
              Review the suggested room for each piece before saving the quote. You can edit again on the quote page.
            </DialogDescription>
          </DialogHeader>

          {/* Bulk apply */}
          <div className="flex items-end gap-2 pt-1">
            <div className="flex-1 min-w-0">
              <label className="block font-body text-[10px] text-muted-foreground uppercase tracking-widest mb-1">
                Apply a room to all items
              </label>
              <input
                type="text"
                list={datalistId}
                value={bulkRoom}
                onChange={(e) => setBulkRoom(e.target.value)}
                placeholder="e.g. Living Room"
                className="w-full font-body text-xs text-foreground bg-background border border-border rounded px-2 py-1.5 focus:border-foreground/50 outline-none"
              />
            </div>
            <Button variant="outline" size="sm" onClick={applyBulk} disabled={!bulkRoom.trim()}>
              Apply to all
            </Button>
          </div>

          <datalist id={datalistId}>
            {suggestedRooms.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>

          <div className="flex-1 overflow-y-auto -mx-6 px-6 py-2 border-y border-border">
            {reviewLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading items…
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {reviewRows.map((row) => (
                  <li key={row.product_id} className="flex items-center gap-3 py-2">
                    <div className="h-12 w-12 shrink-0 rounded bg-muted/30 overflow-hidden">
                      {row.image_url ? (
                        // eslint-disable-next-line jsx-a11y/alt-text
                        <img src={row.image_url} className="h-full w-full object-cover" loading="lazy" />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-body text-xs text-foreground truncate">{row.product_name}</div>
                      {row.brand_name && (
                        <div className="font-body text-[10px] text-muted-foreground uppercase tracking-wider truncate">
                          {row.brand_name}
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      list={datalistId}
                      value={row.room}
                      onChange={(e) => updateRoom(row.product_id, e.target.value)}
                      placeholder="Room"
                      className="w-40 shrink-0 font-body text-xs text-foreground bg-background border border-border rounded px-2 py-1 focus:border-foreground/50 outline-none"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setReviewOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={confirmReview} disabled={busy || reviewLoading || reviewRows.length === 0}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Create quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
