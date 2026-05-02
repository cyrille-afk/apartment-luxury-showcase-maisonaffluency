import { useState, useEffect, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Share2, FileText, Trash2, Check, X, FolderPlus, Folder, ChevronDown, ChevronRight, MoreHorizontal, Pencil, RefreshCw, Palette } from "lucide-react";
import TradeBreadcrumb from "@/components/trade/TradeBreadcrumb";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectPicker } from "@/components/trade/ProjectPicker";
import { BoardProjectHistory } from "@/components/trade/concierge/BoardProjectHistory";
import { CreateQuoteFromBoard } from "@/components/trade/concierge/CreateQuoteFromBoard";

interface Board {
  id: string;
  title: string;
  client_name: string;
  share_token: string;
  status: string;
  token_expires_at: string | null;
  token_rotated_at: string | null;
  project_id: string | null;
  studio_id: string | null;
  studio_logo_url: string | null;
  studio_name: string | null;
  hide_maison_branding: boolean;
}

interface BoardItem {
  id: string;
  product_id: string;
  sort_order: number;
  notes: string | null;
  approval_status: string;
  subfolder: string | null;
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

  // Sub-folder state
  const [subfolderDialogOpen, setSubfolderDialogOpen] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [addToSubfolder, setAddToSubfolder] = useState<string | null>(null);
  const [emptySubfolders, setEmptySubfolders] = useState<string[]>([]); // track created but still-empty subfolders

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

  // Derive sub-folder list from items
  const subfolders = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.subfolder) set.add(i.subfolder); });
    emptySubfolders.forEach(name => set.add(name));
    return Array.from(set).sort();
  }, [items, emptySubfolders]);

  // Group items by subfolder
  const groupedItems = useMemo(() => {
    const groups: { name: string | null; items: BoardItem[] }[] = [];
    const ungrouped = items.filter(i => !i.subfolder);
    
    // Sub-folders first
    for (const sf of subfolders) {
      groups.push({ name: sf, items: items.filter(i => i.subfolder === sf) });
    }
    // Ungrouped at the end
    if (ungrouped.length > 0 || subfolders.length === 0) {
      groups.push({ name: null, items: ungrouped });
    }
    return groups;
  }, [items, subfolders]);

  const searchProducts = useCallback(async (q: string) => {
    if (!user) return;
    // Source from user's saved favorites only
    let query = supabase
      .from("trade_favorites")
      .select("product_id, trade_products!inner(id, product_name, brand_name, image_url, category)")
      .eq("user_id", user.id);
    if (q.trim()) {
      query = query.or(`trade_products.product_name.ilike.%${q}%,trade_products.brand_name.ilike.%${q}%`);
    }
    const { data } = await query.order("created_at", { ascending: false });
    const prods = (data || []).map((f: any) => f.trade_products).filter(Boolean) as Product[];
    // Deduplicate by product id
    const seen = new Set<string>();
    const unique = prods.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });

    // Fill missing images from designer_curator_picks
    const missingImg = unique.filter(p => !p.image_url);
    if (missingImg.length > 0) {
      const names = missingImg.map(p => p.product_name);
      const { data: picks } = await supabase
        .from("designer_curator_picks")
        .select("title, image_url")
        .in("title", names)
        .not("image_url", "eq", "");
      if (picks) {
        const pickMap = new Map(picks.map((pk: any) => [pk.title, pk.image_url]));
        unique.forEach(p => {
          if (!p.image_url && pickMap.has(p.product_name)) {
            p.image_url = pickMap.get(p.product_name) || null;
          }
        });
      }
    }

    setProducts(unique);
  }, [user]);

  useEffect(() => { if (addOpen) searchProducts(search); }, [addOpen, search, searchProducts]);

  const addProduct = async (productId: string) => {
    if (!id) return;
    const { error } = await supabase
      .from("client_board_items")
      .insert({ board_id: id, product_id: productId, sort_order: items.length, subfolder: addToSubfolder });
    if (!error) {
      setAddedIds(prev => new Set(prev).add(productId));
      fetchBoard();
      toast({ title: "Product added" });
    }
  };

  const removeItem = async (itemId: string) => {
    await supabase.from("client_board_items").delete().eq("id", itemId);
    fetchBoard();
  };

  const createSubfolder = async () => {
    const name = newSubfolderName.trim();
    if (!name) return;
    if (subfolders.includes(name)) {
      toast({ title: "Sub-folder already exists", variant: "destructive" });
      return;
    }
    setEmptySubfolders(prev => [...prev, name]);
    setSubfolderDialogOpen(false);
    setNewSubfolderName("");
    toast({ title: `Sub-folder "${name}" created` });
  };

  const renameSubfolder = async (oldName: string, newName: string) => {
    if (!newName.trim() || newName.trim() === oldName) {
      setRenameTarget(null);
      return;
    }
    const itemsInFolder = items.filter(i => i.subfolder === oldName);
    for (const item of itemsInFolder) {
      await supabase.from("client_board_items").update({ subfolder: newName.trim() }).eq("id", item.id);
    }
    setRenameTarget(null);
    fetchBoard();
    toast({ title: `Renamed to "${newName.trim()}"` });
  };

  const deleteSubfolder = async (name: string) => {
    // Move items back to ungrouped
    const itemsInFolder = items.filter(i => i.subfolder === name);
    for (const item of itemsInFolder) {
      await supabase.from("client_board_items").update({ subfolder: null }).eq("id", item.id);
    }
    setEmptySubfolders(prev => prev.filter(n => n !== name));
    fetchBoard();
    toast({ title: `Sub-folder "${name}" removed`, description: "Items moved to ungrouped." });
  };

  const moveItemToSubfolder = async (itemId: string, subfolder: string | null) => {
    await supabase.from("client_board_items").update({ subfolder }).eq("id", itemId);
    fetchBoard();
  };

  const toggleCollapse = (name: string) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
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

  const rotateToken = async () => {
    if (!board) return;
    const { data, error } = await supabase.rpc("rotate_board_token", { _board_id: board.id });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    const newToken = data as string;
    setBoard({ ...board, share_token: newToken, token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), token_rotated_at: new Date().toISOString() });
    const url = `${window.location.origin}/board/${newToken}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Token rotated", description: "New share link copied. The old link no longer works." });
  };

  const convertToQuote = async () => {
    if (!board || !user) return;
    const approvedItems = items.filter(i => i.approval_status === "approved");
    if (approvedItems.length === 0) {
      toast({ title: "No approved items", description: "Your client must approve items before converting.", variant: "destructive" });
      return;
    }
    const { data: quote, error } = await supabase
      .from("trade_quotes")
      .insert({ user_id: user.id, status: "draft", client_name: board.client_name })
      .select("id")
      .single();
    if (error || !quote) {
      toast({ title: "Error", description: error?.message, variant: "destructive" });
      return;
    }
    const quoteItems = approvedItems.map(item => ({
      quote_id: quote.id,
      product_id: item.product_id,
      quantity: 1,
    }));
    await supabase.from("trade_quote_items").insert(quoteItems);
    await supabase.from("client_boards").update({ status: "converted" }).eq("id", board.id);
    toast({ title: "Quote created", description: `${approvedItems.length} approved items added to new quote` });
    navigate("/trade/quotes");
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  if (!board) return <div className="text-center py-20 text-muted-foreground">Board not found</div>;

  const approvedCount = items.filter(i => i.approval_status === "approved").length;
  const rejectedCount = items.filter(i => i.approval_status === "rejected").length;
  const isEditable = board.status !== "converted";

  const renderItemCard = (item: BoardItem) => (
    <div key={item.id} className="border border-border rounded-lg overflow-hidden group">
      <div className="aspect-square bg-muted relative">
        {item.product?.image_url ? (
          <img src={item.product.image_url} alt={item.product?.product_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground font-body text-xs">No image</div>
        )}
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
        {isEditable && (
          <div className="flex items-center gap-1 mt-2">
            {subfolders.length > 0 && (
              <Select
                value={item.subfolder || "__none__"}
                onValueChange={(v) => moveItemToSubfolder(item.id, v === "__none__" ? null : v)}
              >
                <SelectTrigger className="h-7 text-xs w-auto min-w-[100px]">
                  <SelectValue placeholder="Move to…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Ungrouped</SelectItem>
                  {subfolders.map(sf => (
                    <SelectItem key={sf} value={sf}>{sf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive ml-auto" onClick={() => removeItem(item.id)}>
              <Trash2 className="h-3 w-3 mr-1" /> Remove
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Helmet><title>{board.title} — Project Folder — Maison Affluency</title></Helmet>
      <div className="max-w-5xl">
        {/* Header */}
        <BackToProjectPill />
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/trade/boards")} className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Folders
          </Button>
        </div>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl text-foreground">{board.title}</h1>
            {board.client_name && <p className="font-body text-sm text-muted-foreground mt-1">For {board.client_name}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="secondary">{board.status}</Badge>
              {items.length > 0 && (
                <span className="font-body text-xs text-muted-foreground">
                  {items.length} items · {approvedCount} approved · {rejectedCount} rejected
                  {subfolders.length > 0 && ` · ${subfolders.length} sub-folders`}
                </span>
              )}
            </div>
            <div className="mt-3">
              <ProjectPicker
                value={board.project_id}
                onChange={async (id) => {
                  setBoard((prev) => (prev ? { ...prev, project_id: id } : prev));
                  await supabase.from("client_boards").update({ project_id: id } as any).eq("id", board.id);
                  toast({ title: id ? "Folder assigned to project" : "Removed from project" });
                }}
                compact
              />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isEditable && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSubfolderDialogOpen(true)}>
                  <FolderPlus className="h-3.5 w-3.5" /> Sub-folder
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setAddToSubfolder(null); setAddOpen(true); }}>
                  <Plus className="h-3.5 w-3.5" /> Add Products
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={shareBoard}>
                  <Share2 className="h-3.5 w-3.5" /> {board.status === "draft" ? "Share with Client" : "Copy Link"}
                </Button>
                {board.status !== "draft" && (
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={rotateToken} title="Regenerate share link (invalidates old link)">
                    <RefreshCw className="h-3.5 w-3.5" /> Rotate Link
                  </Button>
                )}
                {approvedCount > 0 ? (
                  <Button size="sm" className="gap-1.5" onClick={convertToQuote}>
                    <FileText className="h-3.5 w-3.5" /> Convert Approved to Quote
                  </Button>
                ) : (
                  <CreateQuoteFromBoard
                    board={board}
                    items={items.map(i => ({ id: i.id, product_id: i.product_id, approval_status: i.approval_status }))}
                    userId={user!.id}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Client Portal white-label settings */}
        {isEditable && (
          <details className="mb-6 rounded-md border border-border bg-card/40 group">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-2 px-4 py-3">
              <span className="flex items-center gap-2">
                <Palette className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span className="font-body text-xs uppercase tracking-[0.18em] text-foreground">
                  Client Portal Branding
                </span>
                {board.hide_maison_branding && (
                  <Badge variant="secondary" className="text-[10px]">White-label active</Badge>
                )}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-4 pb-4 pt-1 space-y-4 border-t border-border/60">
              <p className="font-body text-xs text-muted-foreground">
                When the client opens your share link, they'll see your studio's branding instead of Maison Affluency's.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="studio-name" className="font-body text-[11px] uppercase tracking-wider text-muted-foreground">
                    Studio name
                  </Label>
                  <Input
                    id="studio-name"
                    value={board.studio_name || ""}
                    placeholder="e.g. Atelier Riviera"
                    onBlur={async (e) => {
                      const v = e.target.value.trim() || null;
                      if (v === (board.studio_name || null)) return;
                      setBoard({ ...board, studio_name: v });
                      await supabase.from("client_boards").update({ studio_name: v } as any).eq("id", board.id);
                      toast({ title: "Studio name saved" });
                    }}
                    onChange={(e) => setBoard({ ...board, studio_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="studio-logo" className="font-body text-[11px] uppercase tracking-wider text-muted-foreground">
                    Studio logo URL
                  </Label>
                  <Input
                    id="studio-logo"
                    value={board.studio_logo_url || ""}
                    placeholder="https://yourstudio.com/logo.png"
                    onBlur={async (e) => {
                      const v = e.target.value.trim() || null;
                      if (v === (board.studio_logo_url || null)) return;
                      setBoard({ ...board, studio_logo_url: v });
                      await supabase.from("client_boards").update({ studio_logo_url: v } as any).eq("id", board.id);
                      toast({ title: "Logo URL saved" });
                    }}
                    onChange={(e) => setBoard({ ...board, studio_logo_url: e.target.value })}
                  />
                </div>
              </div>
              {board.studio_logo_url && (
                <div className="flex items-center gap-3 px-3 py-2 rounded border border-border/60 bg-background">
                  <img
                    src={board.studio_logo_url}
                    alt="Logo preview"
                    className="h-8 w-auto max-w-[120px] object-contain"
                  />
                  <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">
                    Logo preview
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div>
                  <Label htmlFor="hide-maison" className="font-body text-sm text-foreground cursor-pointer">
                    Hide Maison Affluency branding
                  </Label>
                  <p className="font-body text-[11px] text-muted-foreground mt-0.5">
                    Recommended once your studio name &amp; logo are set.
                  </p>
                </div>
                <Switch
                  id="hide-maison"
                  checked={board.hide_maison_branding}
                  onCheckedChange={async (v) => {
                    setBoard({ ...board, hide_maison_branding: v });
                    await supabase.from("client_boards").update({ hide_maison_branding: v } as any).eq("id", board.id);
                    toast({ title: v ? "White-label enabled" : "Maison branding restored" });
                  }}
                />
              </div>
            </div>
          </details>
        )}

        {/* Items grouped by sub-folder */}
        {items.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-lg">
            <p className="font-body text-sm text-muted-foreground mb-3">No products added yet</p>
            <Button variant="outline" size="sm" onClick={() => { setAddToSubfolder(null); setAddOpen(true); }} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Products
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedItems.map(group => {
              const isCollapsed = group.name ? collapsedFolders.has(group.name) : false;
              const isRenaming = renameTarget === group.name;

              return (
                <div key={group.name || "__ungrouped__"}>
                  {/* Sub-folder header */}
                  {group.name && (
                    <div className="flex items-center gap-2 mb-3 border-b border-border pb-2">
                      <button onClick={() => toggleCollapse(group.name!)} className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors">
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        <Folder className="h-4 w-4 text-primary/70" />
                      </button>

                      {isRenaming ? (
                        <form
                          onSubmit={(e) => { e.preventDefault(); renameSubfolder(group.name!, renameValue); }}
                          className="flex items-center gap-2 flex-1"
                        >
                          <Input
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            className="h-7 text-sm max-w-[200px]"
                            autoFocus
                            onBlur={() => setRenameTarget(null)}
                          />
                          <Button type="submit" size="sm" variant="ghost" className="h-7 w-7 p-0">
                            <Check className="h-3 w-3" />
                          </Button>
                        </form>
                      ) : (
                        <span className="font-display text-sm text-foreground">{group.name}</span>
                      )}

                      <span className="font-body text-[10px] text-muted-foreground uppercase tracking-wider ml-1">
                        {group.items.length} {group.items.length === 1 ? "item" : "items"}
                      </span>

                      {isEditable && !isRenaming && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setAddToSubfolder(group.name); setAddOpen(true); }}>
                              <Plus className="h-3.5 w-3.5 mr-2" /> Add products here
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setRenameTarget(group.name); setRenameValue(group.name!); }}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteSubfolder(group.name!)}>
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete sub-folder
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  )}

                  {/* Ungrouped header */}
                  {!group.name && subfolders.length > 0 && (
                    <div className="flex items-center gap-2 mb-3 border-b border-border pb-2">
                      <span className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">
                        Ungrouped · {group.items.length} {group.items.length === 1 ? "item" : "items"}
                      </span>
                    </div>
                  )}

                  {/* Items grid */}
                  {!isCollapsed && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {group.items.map(renderItemCard)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <BoardProjectHistory boardId={board.id} />
      </div>

      {/* Create sub-folder dialog */}
      <Dialog open={subfolderDialogOpen} onOpenChange={setSubfolderDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Create Sub-folder</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createSubfolder(); }} className="space-y-4 pt-2">
            <Input
              value={newSubfolderName}
              onChange={e => setNewSubfolderName(e.target.value)}
              placeholder="e.g. Living Room, Master Bedroom"
              autoFocus
            />
            <Button type="submit" disabled={!newSubfolderName.trim()} className="w-full">
              Create Sub-folder
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add products dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display">
              Add Products
              {addToSubfolder && (
                <span className="text-sm font-body text-muted-foreground font-normal ml-2">→ {addToSubfolder}</span>
              )}
            </DialogTitle>
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
              <p className="text-center text-muted-foreground text-sm py-8">
                {search.trim() ? "No matching favorites found" : "No saved favorites yet — save items from the showroom first"}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TradeBoardBuilder;
