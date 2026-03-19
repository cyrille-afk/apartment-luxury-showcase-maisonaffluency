import { useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Eye, EyeOff, Pencil, FileText, Download, Presentation } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PresentationRow {
  id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  project_name: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  slide_count?: number;
}

const TradePresentations = () => {
  const { isAdmin, loading, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<PresentationRow | null>(null);

  const { data: presentations = [], isLoading } = useQuery({
    queryKey: ["presentations"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("presentations")
        .select("*, presentation_slides(id)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        slide_count: p.presentation_slides?.length || 0,
        presentation_slides: undefined,
      })) as PresentationRow[];
    },
    enabled: !!isAdmin,
  });

  const handleCreate = async () => {
    const { data, error } = await (supabase as any)
      .from("presentations")
      .insert({ title: "Untitled Presentation", created_by: user!.id })
      .select("id")
      .single();
    if (error) {
      toast({ title: "Error creating presentation", description: error.message, variant: "destructive" });
      return;
    }
    navigate(`/trade/presentations/${data.id}`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await (supabase as any).from("presentations").delete().eq("id", deleteTarget.id);
    toast({ title: "Presentation deleted" });
    setDeleteTarget(null);
    queryClient.invalidateQueries({ queryKey: ["presentations"] });
  };

  const togglePublished = useCallback(async (p: PresentationRow) => {
    const newPublished = !p.is_published;
    await (supabase as any).from("presentations").update({ is_published: newPublished }).eq("id", p.id);
    queryClient.invalidateQueries({ queryKey: ["presentations"] });
    toast({ title: newPublished ? "Published" : "Unpublished" });

    // If publishing, notify shared users via email + in-app
    if (newPublished) {
      try {
        await supabase.functions.invoke("send-presentation-published", {
          body: { presentationId: p.id },
        });
        toast({ title: "Shared users have been notified" });
      } catch (err) {
        console.error("Notification error:", err);
      }
    }
  }, [queryClient, toast]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet><title>Presentations — Admin — Maison Affluency</title></Helmet>
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl text-foreground">Presentations</h1>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Compile axonometric illustrations into client-ready presentation decks
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-full hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            New Presentation
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse border border-border rounded-lg p-5">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : presentations.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-lg">
            <Presentation className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-display text-lg text-foreground mb-2">No presentations yet</p>
            <p className="font-body text-sm text-muted-foreground mb-6">
              Create a presentation to compile your best axonometric renders.
            </p>
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-full hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              New Presentation
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {presentations.map((p) => (
              <div key={p.id} className="border border-border rounded-lg p-5 flex items-center gap-4">
                <Presentation className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-sm text-foreground truncate">{p.title}</h3>
                  <p className="font-body text-[10px] text-muted-foreground">
                    {p.slide_count} slide{p.slide_count !== 1 ? "s" : ""}
                    {p.client_name && ` · ${p.client_name}`}
                    {p.project_name && ` · ${p.project_name}`}
                    {" · "}Updated {format(new Date(p.updated_at), "d MMM yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => togglePublished(p)}
                    className={`p-2 rounded-md transition-colors ${p.is_published ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-foreground"} hover:bg-muted`}
                    title={p.is_published ? "Unpublish" : "Publish"}
                  >
                    {p.is_published ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => navigate(`/trade/presentations/${p.id}`)}
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => navigate(`/trade/presentations/${p.id}/view`)}
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Preview"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(p)}
                    className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete Presentation</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              Delete "<span className="font-medium text-foreground">{deleteTarget?.title}</span>"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="font-body text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TradePresentations;
