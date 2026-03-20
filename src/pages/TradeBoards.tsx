import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Plus, Share2, FileText, Trash2, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import SectionHero from "@/components/trade/SectionHero";
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
  const { toast } = useToast();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchBoards = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("client_boards")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

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

      setBoards(data.map((b: any) => ({ ...b, item_count: counts[b.id] || 0 })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchBoards(); }, [user]);

  const handleCreate = async () => {
    if (!user || !title.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("client_boards")
      .insert({ user_id: user.id, title: title.trim(), client_name: clientName.trim(), client_email: clientEmail.trim() || null })
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

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-40 bg-muted/50 rounded-lg animate-pulse" />)}
          </div>
        ) : boards.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-body text-sm text-muted-foreground mb-4">No client boards yet</p>
            <Button variant="outline" onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Create Your First Board
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map(board => (
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
                <p className="font-body text-xs text-muted-foreground mb-4">
                  {board.item_count} {board.item_count === 1 ? "item" : "items"}
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
        )}
      </div>
    </>
  );
};

export default TradeBoards;
