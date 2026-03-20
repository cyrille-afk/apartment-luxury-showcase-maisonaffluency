import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";
import { Check, X, MessageSquare, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Board {
  id: string;
  title: string;
  client_name: string;
  status: string;
}

interface BoardItem {
  id: string;
  product_id: string;
  approval_status: string;
  notes: string | null;
  product?: {
    product_name: string;
    brand_name: string;
    image_url: string | null;
    materials: string | null;
    dimensions: string | null;
  };
}

interface Comment {
  id: string;
  item_id: string | null;
  author_name: string;
  content: string;
  is_client: boolean;
  created_at: string;
}

const ClientBoardViewer = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [board, setBoard] = useState<Board | null>(null);
  const [items, setItems] = useState<BoardItem[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [clientName, setClientName] = useState("");
  const [nameSet, setNameSet] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [activeCommentItem, setActiveCommentItem] = useState<string | null>(null);

  const fetchBoard = useCallback(async () => {
    if (!token) return;
    const { data: boardData, error } = await supabase
      .from("client_boards")
      .select("*")
      .eq("share_token", token)
      .neq("status", "draft")
      .single();

    if (error || !boardData) { setNotFound(true); setLoading(false); return; }
    setBoard(boardData as Board);

    const { data: itemsData } = await supabase
      .from("client_board_items")
      .select("*")
      .eq("board_id", (boardData as any).id)
      .order("sort_order");

    if (itemsData && itemsData.length > 0) {
      const productIds = itemsData.map((i: any) => i.product_id);
      const { data: prods } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, image_url, materials, dimensions")
        .in("id", productIds);
      const prodMap = new Map(prods?.map((p: any) => [p.id, p]) || []);
      setItems(itemsData.map((i: any) => ({ ...i, product: prodMap.get(i.product_id) })));
    }

    const { data: commentsData } = await supabase
      .from("client_board_comments")
      .select("*")
      .eq("board_id", (boardData as any).id)
      .order("created_at");
    if (commentsData) setComments(commentsData as Comment[]);

    setLoading(false);
  }, [token]);

  useEffect(() => { fetchBoard(); }, [fetchBoard]);

  // Restore client name from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`board_client_name_${token}`);
    if (saved) { setClientName(saved); setNameSet(true); }
  }, [token]);

  const saveClientName = () => {
    if (!clientName.trim()) return;
    localStorage.setItem(`board_client_name_${token}`, clientName.trim());
    setNameSet(true);
  };

  const updateApproval = async (itemId: string, status: "approved" | "rejected") => {
    if (!board || board.status !== "shared") return;
    const { error } = await supabase
      .from("client_board_items")
      .update({ approval_status: status })
      .eq("id", itemId);
    if (!error) {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, approval_status: status } : i));
      toast({ title: status === "approved" ? "Item approved ✓" : "Item declined" });
    }
  };

  const addComment = async (itemId: string | null) => {
    if (!board || !commentText.trim()) return;
    const { data, error } = await supabase
      .from("client_board_comments")
      .insert({
        board_id: board.id,
        item_id: itemId,
        author_name: clientName || "Client",
        content: commentText.trim(),
        is_client: true,
      })
      .select()
      .single();
    if (!error && data) {
      setComments(prev => [...prev, data as Comment]);
      setCommentText("");
      setActiveCommentItem(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="font-display text-2xl text-foreground mb-2">Board Not Found</h1>
          <p className="font-body text-sm text-muted-foreground">This link may have expired or is no longer available.</p>
        </div>
      </div>
    );
  }

  const approvedCount = items.filter(i => i.approval_status === "approved").length;
  const isReadOnly = board?.status !== "shared";

  return (
    <>
      <Helmet><title>{board?.title} — Maison Affluency</title></Helmet>
      <div className="min-h-screen bg-background">
        {/* Branded header */}
        <header className="border-b border-border bg-background sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div>
              <span className="font-display text-sm text-foreground tracking-wide">Maison Affluency</span>
              <span className="font-body text-[10px] text-muted-foreground uppercase tracking-[0.2em] ml-3">Curated Selection</span>
            </div>
            {board?.client_name && (
              <span className="font-body text-xs text-muted-foreground">Prepared for {board.client_name}</span>
            )}
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-8">
          {/* Name prompt */}
          {!nameSet && !isReadOnly && (
            <div className="mb-8 p-6 border border-border rounded-lg bg-muted/30 max-w-md mx-auto text-center">
              <p className="font-body text-sm text-foreground mb-3">Enter your name to leave comments and approvals</p>
              <div className="flex gap-2">
                <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Your name" onKeyDown={e => e.key === "Enter" && saveClientName()} />
                <Button onClick={saveClientName} disabled={!clientName.trim()}>Continue</Button>
              </div>
            </div>
          )}

          <div className="mb-8">
            <h1 className="font-display text-3xl text-foreground">{board?.title}</h1>
            <p className="font-body text-sm text-muted-foreground mt-2">
              {items.length} {items.length === 1 ? "piece" : "pieces"} curated for your project
              {approvedCount > 0 && ` · ${approvedCount} approved`}
            </p>
            {isReadOnly && (
              <Badge variant="secondary" className="mt-2">This board is {board?.status}</Badge>
            )}
          </div>

          {/* Products grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map(item => {
              const itemComments = comments.filter(c => c.item_id === item.id);
              return (
                <div key={item.id} className="border border-border rounded-lg overflow-hidden">
                  <div className="aspect-square bg-muted relative">
                    {item.product?.image_url ? (
                      <img src={item.product.image_url} alt={item.product?.product_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground font-body text-xs">No image</div>
                    )}
                    {item.approval_status === "approved" && (
                      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-green-500 text-white font-body text-[11px] font-medium flex items-center gap-1">
                        <Check className="h-3 w-3" /> Approved
                      </div>
                    )}
                    {item.approval_status === "rejected" && (
                      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-destructive text-destructive-foreground font-body text-[11px] font-medium flex items-center gap-1">
                        <X className="h-3 w-3" /> Declined
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-display text-sm text-foreground">{item.product?.product_name}</h3>
                    <p className="font-body text-xs text-muted-foreground">{item.product?.brand_name}</p>
                    {item.product?.materials && (
                      <p className="font-body text-[11px] text-muted-foreground mt-1">{item.product.materials}</p>
                    )}
                    {item.product?.dimensions && (
                      <p className="font-body text-[11px] text-muted-foreground">{item.product.dimensions}</p>
                    )}

                    {/* Approval buttons */}
                    {!isReadOnly && nameSet && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant={item.approval_status === "approved" ? "default" : "outline"}
                          className="flex-1 h-8 text-xs gap-1"
                          onClick={() => updateApproval(item.id, "approved")}
                        >
                          <Check className="h-3 w-3" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant={item.approval_status === "rejected" ? "destructive" : "outline"}
                          className="flex-1 h-8 text-xs gap-1"
                          onClick={() => updateApproval(item.id, "rejected")}
                        >
                          <X className="h-3 w-3" /> Decline
                        </Button>
                      </div>
                    )}

                    {/* Comments */}
                    {itemComments.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-border pt-3">
                        {itemComments.map(c => (
                          <div key={c.id} className="text-xs">
                            <span className="font-medium text-foreground">{c.author_name}: </span>
                            <span className="text-muted-foreground">{c.content}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add comment */}
                    {!isReadOnly && nameSet && (
                      activeCommentItem === item.id ? (
                        <div className="mt-2 flex gap-1.5">
                          <Textarea
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            placeholder="Add a comment…"
                            className="min-h-[60px] text-xs"
                            autoFocus
                          />
                          <div className="flex flex-col gap-1">
                            <Button size="sm" className="h-7 w-7 p-0" onClick={() => addComment(item.id)}>
                              <Send className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setActiveCommentItem(null); setCommentText(""); }}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setActiveCommentItem(item.id)}
                        >
                          <MessageSquare className="h-3 w-3" /> Comment
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* General comments */}
          {comments.filter(c => !c.item_id).length > 0 && (
            <div className="mt-10 border-t border-border pt-6">
              <h2 className="font-display text-lg text-foreground mb-3">General Comments</h2>
              <div className="space-y-3">
                {comments.filter(c => !c.item_id).map(c => (
                  <div key={c.id} className="text-sm">
                    <span className="font-medium text-foreground">{c.author_name}: </span>
                    <span className="text-muted-foreground">{c.content}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* General comment input */}
          {!isReadOnly && nameSet && (
            <div className="mt-6 max-w-xl">
              <div className="flex gap-2">
                <Textarea
                  value={activeCommentItem === "general" ? commentText : ""}
                  onChange={e => { setActiveCommentItem("general"); setCommentText(e.target.value); }}
                  placeholder="Leave a general comment about this selection…"
                  className="min-h-[60px] text-sm"
                  onFocus={() => setActiveCommentItem("general")}
                />
                <Button size="sm" className="self-end" onClick={() => addComment(null)} disabled={!commentText.trim() || activeCommentItem !== "general"}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </main>

        <footer className="border-t border-border mt-16 py-6 text-center">
          <span className="font-display text-xs text-muted-foreground tracking-wide">Maison Affluency</span>
          <p className="font-body text-[10px] text-muted-foreground/60 mt-1">Curated luxury furnishings for discerning professionals</p>
        </footer>
      </div>
    </>
  );
};

export default ClientBoardViewer;
