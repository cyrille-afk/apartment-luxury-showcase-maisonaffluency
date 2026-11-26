import { useState } from "react";
import { format } from "date-fns";
import { ArrowRight, CheckCircle2, Download, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface PendingAxonometricRequest {
  id: string;
  project_name?: string | null;
  request_type?: string | null;
  image_url: string;
  status: string;
  created_at: string;
  notes?: string | null;
  admin_notes?: string | null;
  linked_favorite_product_ids?: string[] | null;
  room_type?: string | null;
  style_direction?: string | null;
  lighting_mood?: string | null;
  render_engine?: string | null;
  camera_angles?: string | null;
  profiles?: {
    first_name?: string | null;
    last_name?: string | null;
    company?: string | null;
  } | null;
}

interface AiRenderPendingQueueProps {
  requests: PendingAxonometricRequest[];
  activeRequestId: string | null;
  deletingId: string | null;
  onProcess: (req: PendingAxonometricRequest) => void;
  onDownload3dModel: (req: PendingAxonometricRequest) => void;
  onDelete: (req: PendingAxonometricRequest) => Promise<boolean>;
}

export function AiRenderPendingQueue({
  requests,
  activeRequestId,
  deletingId,
  onProcess,
  onDownload3dModel,
  onDelete,
}: AiRenderPendingQueueProps) {
  const [confirmTarget, setConfirmTarget] = useState<PendingAxonometricRequest | null>(null);

  const isDeletingTarget = !!confirmTarget && deletingId === confirmTarget.id;

  const handleConfirmDelete = async () => {
    if (!confirmTarget || isDeletingTarget) return;
    const ok = await onDelete(confirmTarget);
    if (ok) {
      setConfirmTarget(null);
    }
  };

  if (requests.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg py-12 flex flex-col items-center justify-center gap-2">
        <CheckCircle2 className="w-6 h-6 text-muted-foreground/40" />
        <p className="font-body text-sm text-muted-foreground">No pending requests — all caught up</p>
      </div>
    );
  }

  return (
    <>
      <div className="border border-border rounded-lg divide-y divide-border">
        <div className="px-5 py-3 bg-muted/30">
          <h2 className="font-display text-sm text-foreground">Pending Requests</h2>
        </div>
        {requests.map((req) => {
          const profile = req.profiles;
          const fullName = profile
            ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
            : "";
          const userName = fullName || "Unknown";
          const label = req.project_name || "Untitled";
          const isDeleting = deletingId === req.id;
          const isActive = activeRequestId === req.id;
          const favCount = Array.isArray(req.linked_favorite_product_ids)
            ? req.linked_favorite_product_ids.length
            : 0;

          return (
            <div
              key={req.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                {req.request_type === "3d_model" ? (
                  <div className="w-16 h-16 rounded border border-border shrink-0 flex items-center justify-center bg-muted/30">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  </div>
                ) : (
                  <img
                    src={req.image_url}
                    alt=""
                    className="w-16 h-16 object-cover rounded border border-border shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-display text-sm text-foreground truncate">{label}</p>
                  <p className="font-body text-xs text-muted-foreground">
                    {userName}
                    {profile?.company ? ` · ${profile.company}` : ""} ·{" "}
                    {req.request_type === "3d_model" ? "3D Model" : req.request_type || "elevation"} ·{" "}
                    {format(new Date(req.created_at), "d MMM yyyy")}
                  </p>
                  {req.notes && (
                    <p className="font-body text-xs text-muted-foreground/70 line-clamp-1 mt-0.5">
                      {req.notes}
                    </p>
                  )}
                  {favCount > 0 && (
                    <p className="font-body text-[10px] text-[hsl(var(--gold))] mt-0.5">
                      ♥ {favCount} favorite{favCount !== 1 ? "s" : ""} attached
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 shrink-0">
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    req.status === "in_progress"
                      ? "bg-blue-500/10 text-blue-700"
                      : "bg-yellow-500/10 text-yellow-700"
                  }`}
                >
                  {req.status === "in_progress" ? "In Progress" : "Pending"}
                </span>
                {req.request_type === "3d_model" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isDeleting}
                    onClick={() => onDownload3dModel(req)}
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />Download
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isDeleting}
                    onClick={() => onProcess(req)}
                  >
                    <ArrowRight className="w-3.5 h-3.5 mr-1" />
                    {isActive ? "Active" : "Process"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  disabled={isDeleting}
                  onClick={() => setConfirmTarget(req)}
                  aria-label={`Delete request ${label}`}
                  title="Delete request"
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(open) => {
          if (!open && !isDeletingTarget) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete render request?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              <span className="font-medium text-foreground">
                {confirmTarget?.project_name || "Untitled"}
              </span>{" "}
              from the 3D render queue. Any renders already saved to history or gallery remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingTarget}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeletingTarget}
              onClick={handleConfirmDelete}
            >
              {isDeletingTarget ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Deleting…
                </>
              ) : (
                "Delete Request"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}