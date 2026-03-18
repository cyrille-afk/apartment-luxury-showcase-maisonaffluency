import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import CloudUpload from "@/components/trade/CloudUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Clock, CheckCircle2, Loader2, Image as ImageIcon } from "lucide-react";
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

  return (
    <>
      <Helmet>
        <title>Axonometric Requests | Trade Portal</title>
      </Helmet>

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-foreground">Axonometric Requests</h1>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Submit elevation or section drawings to be transformed into 3D axonometric views
            </p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            variant={showForm ? "outline" : "default"}
            size="sm"
          >
            {showForm ? <X className="w-4 h-4 mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
            {showForm ? "Cancel" : "New Request"}
          </Button>
        </div>

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
                <CloudUpload
                  folder="axonometric-submissions"
                  accept="image/*"
                  label="Upload elevation or section drawing"
                  onUpload={(urls) => setImageUrl(urls[0])}
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
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${status.color}`}>
                      {status.label}
                    </span>
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
    </>
  );
};

export default TradeAxonometricRequests;
