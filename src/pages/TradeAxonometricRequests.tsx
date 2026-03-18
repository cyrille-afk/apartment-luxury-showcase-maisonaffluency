import { useState } from "react";
import SectionHero from "@/components/trade/SectionHero";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import CloudUpload from "@/components/trade/CloudUpload";
import SourceUpload from "@/components/trade/SourceUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Clock, CheckCircle2, Loader2, Image as ImageIcon, GalleryHorizontalEnd, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-500/10 text-yellow-700" },
  in_progress: { label: "In Progress", color: "bg-blue-500/10 text-blue-700" },
  completed: { label: "Completed", color: "bg-green-500/10 text-green-700" },
  cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground" },
};

const TradeAxonometricRequests = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<"elevation" | "section">("elevation");
  const [projectName, setProjectName] = useState("");
  const [notes, setNotes] = useState("");
  const [editingRequest, setEditingRequest] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: requests, refetch } = useQuery({
    queryKey: ["axonometric-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("axonometric_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const handleSubmit = async () => {
    if (!imageUrl || !user) {
      toast({ title: "Please upload an image", variant: "destructive" });
      return;
    }
    if (!projectName.trim()) {
      toast({ title: "Please enter a project name", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from("axonometric_requests").insert({
        user_id: user.id,
        image_url: imageUrl,
        request_type: requestType,
        project_name: projectName.trim().slice(0, 200),
        notes: notes.trim().slice(0, 1000) || null,
      });
      if (error) throw error;

      toast({ title: "Request submitted successfully" });
      setShowForm(false);
      setImageUrl(null);
      setProjectName("");
      setNotes("");
      refetch();
    } catch (e: any) {
      toast({ title: "Submission failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (req: any) => {
    setEditingRequest(req);
    setProjectName(req.project_name || "");
    setNotes(req.notes || "");
    setRequestType(req.request_type as "elevation" | "section");
    setImageUrl(req.image_url);
  };

  const handleEditSave = async () => {
    if (!editingRequest || !user || !imageUrl) return;
    setSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from("axonometric_requests")
        .update({
          project_name: projectName.trim().slice(0, 200),
          notes: notes.trim().slice(0, 1000) || null,
          request_type: requestType,
          image_url: imageUrl,
        })
        .eq("id", editingRequest.id)
        .eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Request updated" });
      setEditingRequest(null);
      setProjectName("");
      setNotes("");
      setImageUrl(null);
      refetch();
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reqId: string) => {
    if (!user) return;
    setDeleting(reqId);
    try {
      const { error } = await (supabase as any)
        .from("axonometric_requests")
        .delete()
        .eq("id", reqId)
        .eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Request deleted" });
      refetch();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const canEdit = (status: string) => status === "pending";
  const canDelete = (status: string) => status === "pending" || status === "in_progress";
  return (
    <>
      <Helmet>
        <title>Axonometric Requests | Trade Portal</title>
      </Helmet>

      <div className="max-w-4xl mx-auto space-y-6">
        <SectionHero
          section="3d-studio"
          title="3D Studio"
          subtitle="Submit drawings for 3D renders or browse the gallery"
        >
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/trade/axonometric-gallery">
                <GalleryHorizontalEnd className="w-4 h-4 mr-1.5" />View Gallery
              </Link>
            </Button>
            <Button
              onClick={() => setShowForm(!showForm)}
              variant={showForm ? "outline" : "default"}
              size="sm"
            >
              {showForm ? <X className="w-4 h-4 mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
              {showForm ? "Cancel" : "New Request"}
            </Button>
          </div>
        </SectionHero>

        {/* Submission Form */}
        {showForm && (
          <div className="border border-border rounded-lg p-6 space-y-5">
            <h2 className="font-display text-sm text-foreground">New Axonometric Request</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-body text-xs text-muted-foreground">Project Name *</label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Marina Bay Residence"
                  maxLength={200}
                  className="font-body text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-body text-xs text-muted-foreground">Drawing Type *</label>
                <Select value={requestType} onValueChange={(v: any) => setRequestType(v)}>
                  <SelectTrigger className="font-body text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="elevation" className="font-body text-sm">Room Elevation</SelectItem>
                    <SelectItem value="section" className="font-body text-sm">Building Section</SelectItem>
                    <SelectItem value="section_plan" className="font-body text-sm">Section Plan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-body text-xs text-muted-foreground">Upload Drawing *</label>
              {imageUrl ? (
                <div className="relative group">
                  <img src={imageUrl} alt="Uploaded drawing" className="w-full max-h-64 object-contain rounded-md border border-border" />
                  <button
                    onClick={() => setImageUrl(null)}
                    className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5 text-foreground" />
                  </button>
                </div>
              ) : (
                <SourceUpload
                  folder="axonometric-submissions"
                  label="Upload elevation, section, or PDF"
                  onSourceReady={(url) => setImageUrl(url)}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <label className="font-body text-xs text-muted-foreground">Notes (optional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any specific style preferences, dimensions, or details…"
                maxLength={1000}
                rows={3}
                className="font-body text-sm"
              />
            </div>

            <Button onClick={handleSubmit} disabled={submitting || !imageUrl} className="w-full">
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</>
              ) : (
                "Submit Request"
              )}
            </Button>
          </div>
        )}

        {/* Requests List */}
        <div className="space-y-3">
          {requests && requests.length === 0 && !showForm && (
            <div className="border border-dashed border-border rounded-lg py-16 flex flex-col items-center justify-center gap-3">
              <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
              <p className="font-body text-sm text-muted-foreground">No requests yet</p>
              <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-1.5" />Submit your first request
              </Button>
            </div>
          )}

          {requests?.map((req: any) => {
            const status = STATUS_LABELS[req.status] || STATUS_LABELS.pending;
            return (
              <div key={req.id} className="border border-border rounded-lg p-4 flex gap-4">
                <img
                  src={req.image_url}
                  alt=""
                  className="w-24 h-24 object-cover rounded-md border border-border shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-sm text-foreground">{req.project_name || "Untitled"}</p>
                      <p className="font-body text-xs text-muted-foreground capitalize">{req.request_type} drawing</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${status.color}`}>
                        {status.label}
                      </span>
                      {canEdit(req.status) && (
                        <button
                          onClick={() => startEdit(req)}
                          className="p-1 rounded hover:bg-muted transition-colors"
                          title="Edit request"
                        >
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      )}
                      {canDelete(req.status) && (
                        <button
                          onClick={() => handleDelete(req.id)}
                          disabled={deleting === req.id}
                          className="p-1 rounded hover:bg-destructive/10 transition-colors"
                          title="Delete request"
                        >
                          <Trash2 className={`w-3.5 h-3.5 ${deleting === req.id ? "text-muted-foreground animate-pulse" : "text-destructive/70"}`} />
                        </button>
                      )}
                    </div>
                  </div>
                  {req.notes && (
                    <p className="font-body text-xs text-muted-foreground line-clamp-2">{req.notes}</p>
                  )}
                  <p className="font-body text-[10px] text-muted-foreground">
                    Submitted {format(new Date(req.created_at), "d MMM yyyy")}
                  </p>
                  {req.admin_notes && (
                    <p className="font-body text-xs text-muted-foreground/80 italic border-t border-border pt-1.5 mt-1.5">
                      Admin: {req.admin_notes}
                    </p>
                  )}
                </div>
                {req.result_image_url && (
                  <a href={req.result_image_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <img
                      src={req.result_image_url}
                      alt="Result"
                      className="w-24 h-24 object-cover rounded-md border border-foreground/20"
                    />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingRequest} onOpenChange={(open) => { if (!open) { setEditingRequest(null); setImageUrl(null); setProjectName(""); setNotes(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-base">Edit Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="font-body text-xs text-muted-foreground">Project Name *</label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                maxLength={200}
                className="font-body text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-body text-xs text-muted-foreground">Drawing Type *</label>
              <Select value={requestType} onValueChange={(v: any) => setRequestType(v)}>
                <SelectTrigger className="font-body text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="elevation" className="font-body text-sm">Room Elevation</SelectItem>
                    <SelectItem value="section" className="font-body text-sm">Building Section</SelectItem>
                    <SelectItem value="section_plan" className="font-body text-sm">Section Plan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="font-body text-xs text-muted-foreground">Drawing</label>
              {imageUrl ? (
                <div className="relative group">
                  <img src={imageUrl} alt="Drawing" className="w-full max-h-48 object-contain rounded-md border border-border" />
                  <button
                    onClick={() => setImageUrl(null)}
                    className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5 text-foreground" />
                  </button>
                </div>
              ) : (
                <CloudUpload
                  folder="axonometric-submissions"
                  accept="image/*"
                  label="Upload new drawing"
                  onUpload={(urls) => setImageUrl(urls[0])}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <label className="font-body text-xs text-muted-foreground">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
                rows={3}
                className="font-body text-sm"
              />
            </div>
            <Button onClick={handleEditSave} disabled={submitting || !imageUrl || !projectName.trim()} className="w-full">
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TradeAxonometricRequests;
