import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Plus, Share2, FileText, Trash2, ExternalLink, FolderOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProjectFilter } from "@/hooks/useProjectFilter";
import { useDesignerDisplayName } from "@/hooks/useDesignerDisplayName";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";
import { useToast } from "@/hooks/use-toast";
import SectionHero from "@/components/trade/SectionHero";
import ActiveFilterChips from "@/components/trade/ActiveFilterChips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Board {
  id: string;
  title: string;
  client_name: string;
  client_email: string | null;
  share_token: string;
  status: string;
  created_at: string;
  updated_at: string;
  token_expires_at: string | null;
  project_id: string | null;
  project_name?: string | null;
  item_count?: number;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  shared: "bg-primary/10 text-primary",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  converted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

const TradeBoards = () => {
  const { user } = useAuth();
  const { currentStudio, canEdit } = useStudio();
  const { toast } = useToast();
  const navigate = useNavigate();
  const {
    projectFilter,
    designerFilter,
    clearDesignerFilter,
    clearAllFilters,
  } = useProjectFilter();
  const designerLabel = useDesignerDisplayName(designerFilter);
  const [projectFilterName, setProjectFilterName] = useState<string | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [matchingBoardIds, setMatchingBoardIds] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchBoards = async () => {
    if (!user) return;
    let q = supabase
      .from("client_boards")
      .select("*")
      .order("updated_at", { ascending: false });
    // Scope to current studio so teammates see each other's boards.
    // RLS enforces actual visibility based on role + per-project overrides.
    if (currentStudio) {
      q = q.eq("studio_id", currentStudio.id);
    } else {
      q = q.eq("user_id", user.id);
    }
    if (projectFilter) q = q.eq("project_id", projectFilter);
    const { data } = await q;

    if (data) {
      // Fetch item counts
      const boardIds = data.map((b: any) => b.id);
      const { data: items } = await supabase
        .from("client_board_items")
        .select("board_id")
        .in("board_id", boardIds);

      const counts: Record<string, number> = {};
      items?.forEach((item: any) => {
        counts[item.board_id] = (counts[item.board_id] || 0) + 1;
      });

      // Fetch project names for any assigned projects
      const projectIds = [...new Set(data.map((b: any) => b.project_id).filter(Boolean))] as string[];
      let projectMap: Record<string, string> = {};
      if (projectIds.length > 0) {
        const { data: projects } = await supabase
          .from("projects" as any)
          .select("id, name")
          .in("id", projectIds);
        (projects || []).forEach((p: any) => { projectMap[p.id] = p.name; });
      }

      setBoards(data.map((b: any) => ({
        ...b,
        item_count: counts[b.id] || 0,
        project_name: b.project_id ? projectMap[b.project_id] || null : null,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchBoards(); }, [user, projectFilter, currentStudio?.id]);

  useEffect(() => {
    if (!projectFilter) { setProjectFilterName(null); return; }
    (async () => {
      const { data } = await supabase.from("projects" as any).select("name").eq("id", projectFilter).maybeSingle();
      setProjectFilterName((data as any)?.name || null);
    })();
  }, [projectFilter]);

  useEffect(() => {
    if (!designerFilter) { setMatchingBoardIds(null); return; }
    (async () => {
      const { data } = await supabase
        .from("client_board_items")
        .select("board_id, trade_products!inner(brand_name)")
        .eq("trade_products.brand_name", designerFilter);
      setMatchingBoardIds(new Set(((data as any[]) || []).map((r) => r.board_id)));
    })();
  }, [designerFilter]);

  const handleCreate = async () => {
    if (!user || !title.trim()) return;
    if (currentStudio && !canEdit) {
      toast({ title: "Read-only role", description: "Your role in this studio doesn't allow creating boards.", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from("client_boards")
      .insert({ user_id: user.id, studio_id: currentStudio?.id ?? null, title: title.trim(), client_name: clientName.trim(), client_email: clientEmail.trim() || null } as any)
      .select()
      .single();
    setCreating(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setCreateOpen(false);
      setTitle(""); setClientName(""); setClientEmail("");
      navigate(`/trade/boards/${data.id}`);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("client_boards").delete().eq("id", id);
    if (!error) {
      setBoards(prev => prev.filter(b => b.id !== id));
      toast({ title: "Board deleted" });
    }
  };

  const copyShareLink = (token: string) => {
    const url = `${window.location.origin}/board/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: "Share this link with your client" });
  };

  return (
    <>
      <Helmet><title>Project Folders — Trade Portal — Maison Affluency</title></Helmet>
      <div className="max-w-7xl">
        <SectionHero section="boards" title="Project Folders" subtitle="Create curated collections for your clients to review and approve">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-3.5 w-3.5" /> New Board
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Create Project Folder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="font-body text-xs uppercase tracking-wider">Project / Board Name</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Villa Marina Living Room" className="mt-1.5" />
                </div>
                <div>
                  <Label className="font-body text-xs uppercase tracking-wider">Client Name</Label>
                  <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Sarah Chen" className="mt-1.5" />
                </div>
                <div>
                  <Label className="font-body text-xs uppercase tracking-wider">Client Email (optional)</Label>
                  <Input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="sarah@example.com" className="mt-1.5" />
                </div>
                <Button onClick={handleCreate} disabled={!title.trim() || creating} className="w-full">
                  {creating ? "Creating…" : "Create Board"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </SectionHero>

        <ActiveFilterChips className="mb-4" confirmClearAll />

        {(() => {
          const visibleBoards = designerFilter && matchingBoardIds
            ? boards.filter((b) => matchingBoardIds.has(b.id))
            : boards;
          return loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-40 bg-muted/50 rounded-lg animate-pulse" />)}
          </div>
        ) : visibleBoards.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-body text-sm text-muted-foreground mb-4">
              {designerFilter ? `No boards contain ${designerLabel}.` : "No project folders yet"}
            </p>
            <Button variant="outline" onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Create Your First Folder
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleBoards.map(board => (
              <div
                key={board.id}
                className="border border-border rounded-lg p-5 hover:border-foreground/20 transition-colors cursor-pointer group"
                onClick={() => navigate(`/trade/boards/${board.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-display text-base text-foreground group-hover:underline underline-offset-4">{board.title}</h3>
                    {board.client_name && <p className="font-body text-xs text-muted-foreground mt-0.5">{board.client_name}</p>}
                  </div>
                  <Badge variant="secondary" className={statusColors[board.status] || ""}>{board.status}</Badge>
                </div>
                {board.project_name && (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/trade/projects/${board.project_id}`); }}
                    className="inline-flex items-center gap-1 mb-2 text-[10px] font-body uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <FolderOpen className="h-3 w-3" />
                    {board.project_name}
                  </button>
                )}
                <p className="font-body text-xs text-muted-foreground mb-4">
                  {board.item_count} {board.item_count === 1 ? "item" : "items"}
                  {board.status !== "draft" && board.token_expires_at && (
                    <span className={new Date(board.token_expires_at) < new Date() ? "text-destructive ml-2" : " ml-2"}>
                      · {new Date(board.token_expires_at) < new Date() ? "Link expired" : `Expires ${new Date(board.token_expires_at).toLocaleDateString()}`}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  {board.status !== "draft" && (
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => copyShareLink(board.share_token)}>
                      <Share2 className="h-3 w-3" /> Copy Link
                    </Button>
                  )}
                  {board.status !== "converted" && (
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => handleDelete(board.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
        })()}
      </div>
    </>
  );
};

export default TradeBoards;
