import { format } from "date-fns";

export type RenderQueueStatusFilter = "all" | "pending" | "in_progress";
export type RenderQueueTypeFilter = "all" | "render" | "3d_model";

export interface RenderQueueFilterState {
  status: RenderQueueStatusFilter;
  type: RenderQueueTypeFilter;
  search: string;
}

export const DEFAULT_RENDER_QUEUE_FILTERS: RenderQueueFilterState = {
  status: "all",
  type: "all",
  search: "",
};

export interface RenderQueueFilterableRequest {
  id: string;
  project_name?: string | null;
  request_type?: string | null;
  status: string;
  created_at: string;
  notes?: string | null;
  admin_notes?: string | null;
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

export const isRenderQueueFilterActive = (filters: RenderQueueFilterState): boolean =>
  filters.status !== "all" || filters.type !== "all" || filters.search.trim() !== "";

export const renderQueueRequestType = (
  request: Pick<RenderQueueFilterableRequest, "request_type">,
): "3d_model" | "render" => (request.request_type === "3d_model" ? "3d_model" : "render");

export const renderQueueStatusLabel = (status: string): string =>
  status === "in_progress" ? "In Progress" : "Pending";

const fold = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Every term must match somewhere in the request's own text; terms are ANDed. */
export const matchesRenderQueueSearch = (
  request: RenderQueueFilterableRequest,
  search: string,
): boolean => {
  const terms = fold(search).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const profile = request.profiles;
  const parts = [
    request.project_name,
    profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "",
    profile?.company,
    request.request_type === "3d_model" ? "3d model" : request.request_type,
    request.notes,
    request.admin_notes,
    request.room_type,
    request.style_direction,
    request.lighting_mood,
    request.render_engine,
    request.camera_angles,
    request.status,
    renderQueueStatusLabel(request.status),
  ];

  let created = "";
  const when = new Date(request.created_at);
  if (!Number.isNaN(when.getTime())) {
    created = format(when, "d MMM yyyy");
  }
  parts.push(created);

  const haystack = fold(
    parts
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join(" "),
  );

  return terms.every((term) => haystack.includes(term));
};

export const filterRenderQueueRequests = <T extends RenderQueueFilterableRequest>(
  requests: T[],
  filters: RenderQueueFilterState,
): T[] =>
  requests.filter((request) => {
    if (filters.status !== "all" && request.status !== filters.status) return false;
    if (filters.type !== "all" && renderQueueRequestType(request) !== filters.type) return false;
    return matchesRenderQueueSearch(request, filters.search);
  });
