import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { sidebarFolderLinks, useSidebarFolderVisibility } from "./useSidebarFolderVisibility";

beforeEach(() => localStorage.clear());
afterEach(cleanup);
it("shows empty folders by default and hides only confirmed empty folders when disabled", () => {
  const { result } = renderHook(() => useSidebarFolderVisibility("owner"));
  const folders = [{ id: "empty", item_count: 0 }, { id: "populated", item_count: 8 }, { id: "unknown" }];
  expect(result.current.showEmptyFolders).toBe(true);
  expect(sidebarFolderLinks(folders, true)).toEqual(folders);
  act(() => result.current.setShowEmptyFolders(false));
  expect(sidebarFolderLinks(folders, result.current.showEmptyFolders).map(folder => folder.id)).toEqual(["populated", "unknown"]);
});
it("updates all mounted navigation immediately and persists after remount", () => {
  const settings = renderHook(() => useSidebarFolderVisibility("owner"));
  const sidebar = renderHook(() => useSidebarFolderVisibility("owner"));
  act(() => settings.result.current.setShowEmptyFolders(false));
  expect(sidebar.result.current.showEmptyFolders).toBe(false);
  sidebar.unmount();
  const restored = renderHook(() => useSidebarFolderVisibility("owner"));
  expect(restored.result.current.showEmptyFolders).toBe(false);
  act(() => settings.result.current.setShowEmptyFolders(true));
  expect(restored.result.current.showEmptyFolders).toBe(true);
});
it("keeps accounts separate and accepts changes from another tab", () => {
  const first = renderHook(() => useSidebarFolderVisibility("owner"));
  const other = renderHook(() => useSidebarFolderVisibility("other"));
  act(() => first.result.current.setShowEmptyFolders(false));
  expect(other.result.current.showEmptyFolders).toBe(true);
  localStorage.setItem("ma-sidebar-show-empty-v1:other", "false");
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: "ma-sidebar-show-empty-v1:other" })));
  expect(other.result.current.showEmptyFolders).toBe(false);
});