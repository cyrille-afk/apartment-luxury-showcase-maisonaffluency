import { useState, useEffect, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useParams } from "react-router-dom";
import { Check, X, MessageSquare, Send, Folder } from "lucide-react";
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
  studio_logo_url?: string | null;
  studio_name?: string | null;
  hide_maison_branding?: boolean | null;
}

interface BoardItem {
  id: string;
  product_id: string;
  approval_status: string;
  notes: string | null;
  subfolder: string | null;
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
  const location = useLocation();
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
    // Use security-definer function to fetch board by token (no open RLS)
    const { data: boardRows, error } = await supabase
      .rpc("get_board_by_token", { _token: token });

    const boardData = boardRows?.[0];
    if (error || !boardData) { setNotFound(true); setLoading(false); return; }
    setBoard(boardData as Board);

    // Fetch items via token-gated function
    const { data: itemsData } = await supabase
      .rpc("get_board_items_by_token", { _token: token });

    if (itemsData && itemsData.length > 0) {
      const productIds = itemsData.map((i: any) => i.product_id);
      const { data: prods } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, image_url, materials, dimensions")
        .in("id", productIds);
      const prodMap = new Map(prods?.map((p: any) => [p.id, p]) || []);
      setItems(itemsData.map((i: any) => ({ ...i, product: prodMap.get(i.product_id) })));
    }

    // Fetch comments via token-gated function
    const { data: commentsData } = await supabase
      .rpc("get_board_comments_by_token", { _token: token });
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
    if (!board || board.status !== "shared" || !token) return;
    const { error } = await supabase.rpc("update_item_approval_by_token", {
      _token: token,
      _item_id: itemId,
      _approval_status: status,
    });
    if (!error) {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, approval_status: status } : i));
      toast({ title: status === "approved" ? "Item approved ✓" : "Item declined" });
    }
  };

  const addComment = async (itemId: string | null) => {
    if (!board || !commentText.trim() || !token) return;
    const { data, error } = await supabase.rpc("add_board_comment_by_token", {
      _token: token,
      _board_id: board.id,
      _content: commentText.trim(),
      _author_name: clientName || "Client",
      _is_client: true,
      _item_id: itemId,
    });
    if (!error && data) {
      // Refetch comments to get the full row
      const { data: commentsData } = await supabase
        .rpc("get_board_comments_by_token", { _token: token });
      if (commentsData) setComments(commentsData as Comment[]);
      setCommentText("");
      setActiveCommentItem(null);
    }
  };

  // Group items by subfolder (must be before early returns)
  const subfolders = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.subfolder) set.add(i.subfolder); });
    return Array.from(set).sort();
  }, [items]);

  const groupedItems = useMemo(() => {
    const groups: { name: string | null; items: BoardItem[] }[] = [];
    for (const sf of subfolders) {
      groups.push({ name: sf, items: items.filter(i => i.subfolder === sf) });
    }
    const ungrouped = items.filter(i => !i.subfolder);
    if (ungrouped.length > 0 || subfolders.length === 0) {
      groups.push({ name: null, items: ungrouped });
    }
    return groups;
  }, [items, subfolders]);

  const approvedCount = items.filter(i => i.approval_status === "approved").length;
  const isReadOnly = board?.status !== "shared";

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


  const studioLogo = board?.studio_logo_url || null;
  const studioName = board?.studio_name?.trim() || null;
  const whiteLabel = !!board?.hide_maison_branding;
  const headerBrandLabel = whiteLabel ? (studioName || "Curated Selection") : "Maison Affluency";

  return (
    <>
      <Helmet><title>{board?.title}{studioName ? ` — ${studioName}` : whiteLabel ? "" : " — Maison Affluency"}</title></Helmet>
      <div className="min-h-screen bg-background">
        {/* Branded header — swaps to studio branding when hide_maison_branding is on */}
        <header className="border-b border-border bg-background sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {studioLogo ? (
                <img
                  src={studioLogo}
                  alt={studioName || "Studio"}
                  className="h-8 w-auto max-w-[160px] object-contain"
                />
              ) : null}
              <div className="min-w-0">
                <span className="font-display text-sm text-foreground tracking-wide block truncate">
                  {whiteLabel ? (studioName || "Curated Selection") : "Maison Affluency"}
                </span>
                {!whiteLabel && (
                  <span className="font-body text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                    Curated Selection
                  </span>
                )}
              </div>
            </div>
            {board?.client_name && (
              <span className="font-body text-xs text-muted-foreground shrink-0">Prepared for {board.client_name}</span>
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

          {/* Products grouped by sub-folder */}
          <div className="space-y-10">
            {groupedItems.map(group => (
              <div key={group.name || "__ungrouped__"}>
                {group.name && (
                  <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
                    <Folder className="h-4 w-4 text-primary/70" />
                    <h2 className="font-display text-lg text-foreground">{group.name}</h2>
                    <span className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">
                      {group.items.length} {group.items.length === 1 ? "piece" : "pieces"}
                    </span>
                  </div>
                )}
                {!group.name && subfolders.length > 0 && (
                  <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
                    <span className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">
                      Other pieces · {group.items.length}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {group.items.map(item => {
                    const itemComments = comments.filter(c => c.item_id === item.id);
                    return (
                        <div key={item.id} className="border border-border rounded-lg overflow-hidden group">
                          <Link
                            to={`/product/${item.product_id}`}
                            state={{ from: location.pathname + location.search }}
                            className="aspect-square bg-muted relative block focus:outline-none focus:ring-2 focus:ring-ring"
                            aria-label={`Open ${item.product?.product_name ?? "product"} sheet`}
                          >
                          {item.product?.image_url ? (
                              <img src={item.product.image_url} alt={item.product?.product_name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
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
                          </Link>
                        <div className="p-4">
                          <h3 className="font-display text-sm text-foreground">
                            <Link
                              to={`/product/${item.product_id}`}
                              state={{ from: location.pathname + location.search }}
                              className="hover:underline underline-offset-4"
                            >
                              {item.product?.product_name}
                            </Link>
                          </h3>
                          <p className="font-body text-xs text-muted-foreground">{item.product?.brand_name}</p>
                          {item.product?.materials && (
                            <p className="font-body text-[11px] text-muted-foreground mt-1">{item.product.materials}</p>
                          )}
                          {item.product?.dimensions && (
                            <p className="font-body text-[11px] text-muted-foreground">{item.product.dimensions}</p>
                          )}
                          {!isReadOnly && nameSet && (
                            <div className="flex gap-2 mt-3">
                              <Button size="sm" variant={item.approval_status === "approved" ? "default" : "outline"} className="flex-1 h-8 text-xs gap-1" onClick={() => updateApproval(item.id, "approved")}>
                                <Check className="h-3 w-3" /> Approve
                              </Button>
                              <Button size="sm" variant={item.approval_status === "rejected" ? "destructive" : "outline"} className="flex-1 h-8 text-xs gap-1" onClick={() => updateApproval(item.id, "rejected")}>
                                <X className="h-3 w-3" /> Decline
                              </Button>
                            </div>
                          )}
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
                          {!isReadOnly && nameSet && (
                            activeCommentItem === item.id ? (
                              <div className="mt-2 flex gap-1.5">
                                <Textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Add a comment…" className="min-h-[60px] text-xs" autoFocus />
                                <div className="flex flex-col gap-1">
                                  <Button size="sm" className="h-7 w-7 p-0" onClick={() => addComment(item.id)}><Send className="h-3 w-3" /></Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setActiveCommentItem(null); setCommentText(""); }}><X className="h-3 w-3" /></Button>
                                </div>
                              </div>
                            ) : (
                              <button className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setActiveCommentItem(item.id)}>
                                <MessageSquare className="h-3 w-3" /> Comment
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
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
          <span className="font-display text-xs text-muted-foreground tracking-wide">{headerBrandLabel}</span>
          {!whiteLabel && (
            <p className="font-body text-[10px] text-muted-foreground/60 mt-1">Curated luxury furnishings for discerning professionals</p>
          )}
        </footer>
      </div>
    </>
  );
};

export default ClientBoardViewer;
