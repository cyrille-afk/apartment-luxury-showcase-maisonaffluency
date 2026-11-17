import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { writeSharedRoomLayout } from "./sharedRoomLayout";
import { useVisualiserHandoffScope, withoutVisualiserHandoff } from "./visualiserHandoffScope";

afterEach(() => { cleanup(); localStorage.clear(); });
const transfer = (project: string, stamp: number) => new URLSearchParams(`project=${project}&board=selected&view=walkthrough&handoff=curated&stamp=${stamp}`);
const save = (projectId: string, updatedAt: number) => writeSharedRoomLayout({ projectId, updatedAt, source: "project-studio", room: { width: 7, length: 6, height: 3 }, items: [] });

describe("one-time Visualiser transfers", () => {
  it("keeps the mounted room scope when a successful transfer is removed from history", () => {
    save("scope-project", 100);
    const params = transfer("scope-project", 100);
    const { result, rerender } = renderHook(({ search }) => useVisualiserHandoffScope("owner", "scope-project", search), { initialProps: { search: params } });
    const initial = result.current;
    expect(initial.freshHandoff).toBe(true);
    rerender({ search: withoutVisualiserHandoff(params) });
    expect(result.current).toBe(initial);
  });
  it("restores saved placements after reload rather than treating a consumed transfer as fresh", () => {
    save("reload-project", 200);
    const params = withoutVisualiserHandoff(transfer("reload-project", 200));
    const { result } = renderHook(() => useVisualiserHandoffScope("owner", "reload-project", params));
    expect(result.current.freshHandoff).toBe(false);
    expect(params.get("project")).toBe("reload-project");
    expect(params.get("board")).toBe("selected");
    expect(params.get("view")).toBe("walkthrough");
    expect(params.has("stamp")).toBe(false);
    expect(params.has("handoff")).toBe(false);
  });
  it("allows saved-room recovery for an old URL whose transfer was overwritten by live edits", () => {
    save("stale-project", 301);
    const { result } = renderHook(() => useVisualiserHandoffScope("owner", "stale-project", transfer("stale-project", 300)));
    expect(result.current.freshHandoff).toBe(false);
  });
  it("isolates a newly submitted board from the previously mounted room", () => {
    save("new-project", 400);
    const { result, rerender } = renderHook(({ search }) => useVisualiserHandoffScope("owner", "new-project", search), { initialProps: { search: transfer("new-project", 400) } });
    const oldKey = result.current.key;
    save("new-project", 500);
    rerender({ search: transfer("new-project", 500) });
    expect(result.current.key).not.toBe(oldKey);
    expect(result.current.freshHandoff).toBe(true);
  });
});