import { describe, expect, it } from "vitest";
import {
  DEFAULT_RENDER_QUEUE_FILTERS,
  filterRenderQueueRequests,
  isRenderQueueFilterActive,
  matchesRenderQueueSearch,
  type RenderQueueFilterableRequest,
} from "./renderQueueFilters";

const REQUESTS: RenderQueueFilterableRequest[] = [
  {
    id: "req-1",
    project_name: "Ecart 3D Render with Fabric/Finishes Test",
    request_type: "elevation",
    status: "in_progress",
    created_at: "2026-06-17T09:00:10.314Z",
    notes: "Old test submission",
    profiles: { first_name: "Cyrille", last_name: "Delval", company: "Affluency" },
  },
  {
    id: "req-2",
    project_name: "Penthouse 3D Package",
    request_type: "3d_model",
    status: "pending",
    created_at: "2026-07-01T10:00:00.000Z",
    profiles: { first_name: "Alex", last_name: "Mercier", company: null },
  },
  {
    id: "req-3",
    project_name: "Cipriani Residence 02",
    request_type: "section",
    status: "pending",
    created_at: "2026-11-20T10:00:00.000Z",
    admin_notes: "Awaiting client sign-off",
    profiles: { first_name: "Zoé", last_name: "Martin", company: "Kapla" },
  },
];

const ids = (rows: RenderQueueFilterableRequest[]) => rows.map((row) => row.id);

describe("renderQueueFilters", () => {
  it("keeps every request with default filters", () => {
    expect(ids(filterRenderQueueRequests(REQUESTS, DEFAULT_RENDER_QUEUE_FILTERS))).toEqual([
      "req-1",
      "req-2",
      "req-3",
    ]);
    expect(isRenderQueueFilterActive(DEFAULT_RENDER_QUEUE_FILTERS)).toBe(false);
  });

  it("filters by status", () => {
    expect(
      ids(filterRenderQueueRequests(REQUESTS, { ...DEFAULT_RENDER_QUEUE_FILTERS, status: "pending" })),
    ).toEqual(["req-2", "req-3"]);
    expect(
      ids(
        filterRenderQueueRequests(REQUESTS, {
          ...DEFAULT_RENDER_QUEUE_FILTERS,
          status: "in_progress",
        }),
      ),
    ).toEqual(["req-1"]);
  });

  it("filters by request type", () => {
    expect(
      ids(filterRenderQueueRequests(REQUESTS, { ...DEFAULT_RENDER_QUEUE_FILTERS, type: "3d_model" })),
    ).toEqual(["req-2"]);
    expect(
      ids(filterRenderQueueRequests(REQUESTS, { ...DEFAULT_RENDER_QUEUE_FILTERS, type: "render" })),
    ).toEqual(["req-1", "req-3"]);
  });

  it("matches project name, requester, company, notes and date", () => {
    expect(ids(filterRenderQueueRequests(REQUESTS, { ...DEFAULT_RENDER_QUEUE_FILTERS, search: "cipriani" }))).toEqual(["req-3"]);
    expect(ids(filterRenderQueueRequests(REQUESTS, { ...DEFAULT_RENDER_QUEUE_FILTERS, search: "alex" }))).toEqual(["req-2"]);
    expect(ids(filterRenderQueueRequests(REQUESTS, { ...DEFAULT_RENDER_QUEUE_FILTERS, search: "affluency" }))).toEqual(["req-1"]);
    expect(ids(filterRenderQueueRequests(REQUESTS, { ...DEFAULT_RENDER_QUEUE_FILTERS, search: "sign-off" }))).toEqual(["req-3"]);
    expect(ids(filterRenderQueueRequests(REQUESTS, { ...DEFAULT_RENDER_QUEUE_FILTERS, search: "17 Jun 2026" }))).toEqual(["req-1"]);
  });

  it("ignores accents and letter case when searching", () => {
    expect(matchesRenderQueueSearch(REQUESTS[2], "zoe")).toBe(true);
    expect(matchesRenderQueueSearch(REQUESTS[2], "ZOE MARTIN")).toBe(true);
    expect(matchesRenderQueueSearch(REQUESTS[2], "zoé")).toBe(true);
  });

  it("requires every term to match", () => {
    expect(ids(filterRenderQueueRequests(REQUESTS, { ...DEFAULT_RENDER_QUEUE_FILTERS, search: "cipriani kapla" }))).toEqual(["req-3"]);
    expect(ids(filterRenderQueueRequests(REQUESTS, { ...DEFAULT_RENDER_QUEUE_FILTERS, search: "cipriani affluency" }))).toEqual([]);
  });

  it("combines status, type and search", () => {
    expect(
      ids(
        filterRenderQueueRequests(REQUESTS, {
          status: "pending",
          type: "3d_model",
          search: "penthouse",
        }),
      ),
    ).toEqual(["req-2"]);
    expect(
      ids(
        filterRenderQueueRequests(REQUESTS, {
          status: "in_progress",
          type: "3d_model",
          search: "penthouse",
        }),
      ),
    ).toEqual([]);
  });

  it("reports a filter as active for any non-default part", () => {
    expect(isRenderQueueFilterActive({ ...DEFAULT_RENDER_QUEUE_FILTERS, search: "   " })).toBe(false);
    expect(isRenderQueueFilterActive({ ...DEFAULT_RENDER_QUEUE_FILTERS, search: "x" })).toBe(true);
    expect(isRenderQueueFilterActive({ ...DEFAULT_RENDER_QUEUE_FILTERS, status: "pending" })).toBe(true);
    expect(isRenderQueueFilterActive({ ...DEFAULT_RENDER_QUEUE_FILTERS, type: "render" })).toBe(true);
  });
});
