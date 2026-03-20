import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Share2, FileText, Trash2, GripVertical, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Board {
  id: string;
  title: string;
  client_name: string;
  share_token: string;
  status: string;
}

interface BoardItem {
  id: string;
  product_id: string;
  sort_order: number;
  notes: string | null;
  approval_status: string;
  product?: {
    product_name: string;
    brand_name: string;
    image_url: string | null;
    materials: string | null;
    dimensions: string | null;
  };
}

interface Product {
  id: string;
  product_name: string;
  brand_name: string;
  image_url: string | null;
  category: string;
}

const TradeBoardBuilder = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [board, setBoard] = useState<Board | null>(null);
  const [items, setItems] = useState<BoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const fetchBoard = useCallback(async () => {
    if (!id) return;
    const { data: boardData } = await supabase
      .from("client_boards")
      .select("*")
      .eq("id", id)
      .single();
    if (boardData) setBoard(boardData as Board);

    const { data: itemsData } = await supabase
      .from("client_board_items")
      .select("*")
      .eq("board_id", id)
      .order("sort_order");

    if (itemsData && itemsData.length > 0) {
      const productIds = itemsData.map((i: any) => i.product_id);
      const { data: prods } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, image_url, materials, dimensions")
        .in("id", productIds);

      const prodMap = new Map(prods?.map((p: any) => [p.id, p]) || []);
      setItems(itemsData.map((i: any) => ({ ...i, product: prodMap.get(i.product_id) })));
      setAddedIds(new Set(itemsData.map((i: any) => i.product_id)));
    } else {
      setItems([]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchBoard(); }, [fetchBoard]);

  const searchProducts = useCallback(async (q: string) => {
    let query = supabase.from("trade_products").select("id, product_name, brand_name, image_url, category").eq("is_active", true).limit(20);
    if (q.trim()) {
      query = query.or(`product_name.ilike.%${q}%,brand_name.ilike.%${q}%`);
    }
    const { data } = await query.order("product_name");
    setProducts((data as Product[]) || []);
  }, []);

  useEffect(() => { if (addOpen) searchProducts(search); }, [addOpen, search, searchProducts]);

  const addProduct = async (productId: string) => {
    if (!id) return;
    const { error } = await supabase
      .from("client_board_items")
      .insert({ board_id: id, product_id: productId, sort_order: items.length });
    if (!error) {
      setAddedIds(prev => new Set(prev).add(productId));
      fetchBoard();
      toast({ title: "Product added to board" });
    }
  };

  const removeItem = async (itemId: string) => {
    await supabase.from("client_board_items").delete().eq("id", itemId);
    fetchBoard();
  };

  const shareBoard = async () => {
    if (!board) return;
    const wasDraft = board.status === "draft";
    if (wasDraft) {
      await supabase.from("client_boards").update({ status: "shared" }).eq("id", board.id);
      setBoard({ ...board, status: "shared" });
    }
    const url = `${window.location.origin}/board/${board.share_token}`;
    navigator.clipboard.writeText(url);

    // Send email notification to client if sharing for the first time and email exists
    if (wasDraft) {
      try {
        await supabase.functions.invoke("send-board-shared", {
          body: { boardId: board.id },
        });
      } catch (e) {
        console.error("Failed to send board notification email:", e);
      }
    }

    toast({
      title: "Link copied!",
      description: wasDraft
        ? "Board shared. Your client will receive an email notification."
        : "Share link copied to clipboard.",
    });
  };

  const convertToQuote = async () => {
    if (!board || !user) return;
    const approvedItems = items.filter(i => i.approval_status === "approved");
    if (approvedItems.length === 0) {
      toast({ title: "No approved items", description: "Your client must approve items before converting.", variant: "destructive" });
      return;
    }
    // Create quote
    const { data: quote, error } = await supabase
      .from("trade_quotes")
      .insert({ user_id: user.id, status: "draft", client_name: board.client_name })
      .select("id")
      .single();
    if (error || !quote) {
      toast({ title: "Error", description: error?.message, variant: "destructive" });
      return;
    }
    // Add items
    const quoteItems = approvedItems.map(item => ({
      quote_id: quote.id,
      product_id: item.product_id,
      quantity: 1,
    }));
    await supabase.from("trade_quote_items").insert(quoteItems);
    // Mark board as converted
    await supabase.from("client_boards").update({ status: "converted" }).eq("id", board.id);
    toast({ title: "Quote created", description: `${approvedItems.length} approved items added to new quote` });
    navigate("/trade/quotes");
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  if (!board) return <div className="text-center py-20 text-muted-foreground">Board not found</div>;

  const approvedCount = items.filter(i => i.approval_status === "approved").length;
  const rejectedCount = items.filter(i => i.approval_status === "rejected").length;

  return (
    <>
      <Helmet><title>{board.title} — Client Board — Maison Affluency</title></Helmet>
      <div className="max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/trade/boards")} className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Boards
          </Button>
        </div>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl text-foreground">{board.title}</h1>
            {board.client_name && <p className="font-body text-sm text-muted-foreground mt-1">For {board.client_name}</p>}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">{board.status}</Badge>
              {items.length > 0 && (
                <span className="font-body text-xs text-muted-foreground">
                  {items.length} items · {approvedCount} approved · {rejectedCount} rejected
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {board.status !== "converted" && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Add Products
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={shareBoard}>
                  <Share2 className="h-3.5 w-3.5" /> {board.status === "draft" ? "Share with Client" : "Copy Link"}
                </Button>
                {approvedCount > 0 && (
                  <Button size="sm" className="gap-1.5" onClick={convertToQuote}>
                    <FileText className="h-3.5 w-3.5" /> Convert to Quote
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Items grid */}
        {items.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-lg">
            <p className="font-body text-sm text-muted-foreground mb-3">No products added yet</p>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Products
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(item => (
              <div key={item.id} className="border border-border rounded-lg overflow-hidden group">
                <div className="aspect-square bg-muted relative">
                  {item.product?.image_url ? (
                    <img src={item.product.image_url} alt={item.product?.product_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground font-body text-xs">No image</div>
                  )}
                  {/* Approval indicator */}
                  {item.approval_status === "approved" && (
                    <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                  {item.approval_status === "rejected" && (
                    <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-destructive flex items-center justify-center">
                      <X className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-body text-sm text-foreground font-medium truncate">{item.product?.product_name}</p>
                  <p className="font-body text-xs text-muted-foreground">{item.product?.brand_name}</p>
                  {item.product?.materials && <p className="font-body text-[11px] text-muted-foreground mt-1 truncate">{item.product.materials}</p>}
                  {board.status !== "converted" && (
                    <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs text-destructive hover:text-destructive" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add products dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display">Add Products</DialogTitle>
          </DialogHeader>
          <Input value={search} onChange={e => { setSearch(e.target.value); searchProducts(e.target.value); }} placeholder="Search products…" className="mb-3" />
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {products.map(p => (
              <button
                key={p.id}
                disabled={addedIds.has(p.id)}
                onClick={() => addProduct(p.id)}
                className="w-full flex items-center gap-3 p-2.5 rounded-md hover:bg-muted/50 transition-colors text-left disabled:opacity-40"
              >
                <div className="w-12 h-12 rounded bg-muted shrink-0 overflow-hidden">
                  {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm text-foreground truncate">{p.product_name}</p>
                  <p className="font-body text-xs text-muted-foreground">{p.brand_name}</p>
                </div>
                {addedIds.has(p.id) ? (
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>
            ))}
            {products.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">No products found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TradeBoardBuilder;
