import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
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
import {
  DEFAULT_RENDER_QUEUE_FILTERS,
  filterRenderQueueRequests,
  isRenderQueueFilterActive,
  renderQueueStatusLabel,
  type RenderQueueFilterState,
  type RenderQueueStatusFilter,
  type RenderQueueTypeFilter,
} from "@/lib/renderQueueFilters";

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

const STATUS_FILTERS: { key: RenderQueueStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
];

const TYPE_FILTERS: { key: RenderQueueTypeFilter; label: string }[] = [
  { key: "all", label: "All types" },
  { key: "render", label: "Renders" },
  { key: "3d_model", label: "3D models" },
];

export function AiRenderPendingQueue({
  requests,
  activeRequestId,
  deletingId,
  onProcess,
  onDownload3dModel,
  onDelete,
}: AiRenderPendingQueueProps) {
  const [confirmTarget, setConfirmTarget] = useState<PendingAxonometricRequest | null>(null);
  const [filters, setFilters] = useState<RenderQueueFilterState>(DEFAULT_RENDER_QUEUE_FILTERS);

  const isDeletingTarget = !!confirmTarget && deletingId === confirmTarget.id;
  const filtersActive = isRenderQueueFilterActive(filters);
  const visibleRequests = useMemo(
    () => filterRenderQueueRequests(requests, filters),
    [requests, filters],
  );

  const patchFilters = (patch: Partial<RenderQueueFilterState>) =>
    setFilters((current) => ({ ...current, ...patch }));

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
      <div className="border border-border rounded-lg">
        <div className="px-5 py-3 bg-muted/30 border-b border-border">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm text-foreground">Pending Requests</h2>
            <span className="font-body text-[11px] text-muted-foreground">
              {filtersActive
                ? `${visibleRequests.length} of ${requests.length} shown`
                : `${requests.length} ${requests.length === 1 ? "request" : "requests"}`}
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Filter requests by status"
              className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5"
            >
              {STATUS_FILTERS.map((option) => {
                const selected = filters.status === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => patchFilters({ status: option.key })}
                    className={`rounded px-2.5 py-1 font-body text-[11px] transition-colors ${
                      selected
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <select
              aria-label="Filter requests by type"
              value={filters.type}
              onChange={(e) => patchFilters({ type: e.target.value as RenderQueueTypeFilter })}
              className="h-7 rounded-md border border-border bg-background px-2 font-body text-[11px] text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground/20"
            >
              {TYPE_FILTERS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>

            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={filters.search}
                onChange={(e) => patchFilters({ search: e.target.value })}
                placeholder="Search project, requester, company, notes or date…"
                aria-label="Search pending requests"
                className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-8 font-body text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground/20"
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() => patchFilters({ search: "" })}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {filtersActive && (
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_RENDER_QUEUE_FILTERS)}
                className="font-body text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="divide-y divide-border">
          {visibleRequests.length === 0 ? (
            <div className="px-5 py-10 flex flex-col items-center justify-center gap-2">
              <Search className="w-5 h-5 text-muted-foreground/40" />
              <p className="font-body text-sm text-muted-foreground">
                No requests match these filters
              </p>
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_RENDER_QUEUE_FILTERS)}
                className="font-body text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Show all requests
              </button>
            </div>
          ) : (
            visibleRequests.map((req) => {
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
                      {renderQueueStatusLabel(req.status)}
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
            })
          )}
        </div>
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
