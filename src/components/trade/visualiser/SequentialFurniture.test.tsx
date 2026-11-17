import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { furnitureLoadingProgress, useFurnitureAdmission } from "./SequentialFurniture";

const pieces = (count: number) => Array.from({ length: count }, (_, i) => ({ instanceId: String(i), glb_url: `/piece-${i}.glb` }));
it("loads the Anchor alone before admitting the other three pieces at the four-item threshold", async () => {
  const rows = pieces(4);
  const { result } = renderHook(() => useFurnitureAdmission(rows));
  await waitFor(() => expect(result.current.admitted.size).toBe(1));
  expect(result.current.admitted.has(result.current.keys[0])).toBe(true);
  act(() => result.current.commit(result.current.keys[0]));
  await waitFor(() => expect(result.current.admitted.size).toBe(4));
});
it("loads eleven pieces as Anchor, then 3, 3, 3, 2 and waits for each active secondary group", async () => {
  const rows = pieces(11);
  const { result } = renderHook(() => useFurnitureAdmission(rows));
  await waitFor(() => expect(result.current.admitted.size).toBe(1));
  act(() => result.current.commit(result.current.keys[0]));
  await waitFor(() => expect(result.current.admitted.size).toBe(4));
  act(() => result.current.commit(result.current.keys[1]));
  act(() => result.current.commit(result.current.keys[2]));
  expect(result.current.admitted.size).toBe(4);
  for (const [start, end, total] of [[3, 4, 7], [4, 7, 10], [7, 10, 11]]) {
    act(() => { for (let i = start; i < end; i++) result.current.commit(result.current.keys[i]); });
    await waitFor(() => expect(result.current.admitted.size).toBe(total));
  }
});
it("applies three-at-a-time secondary admission starting at five items", async () => {
  const rows = pieces(5);
  const { result } = renderHook(() => useFurnitureAdmission(rows));
  await waitFor(() => expect(result.current.admitted.size).toBe(1));
  act(() => result.current.commit(result.current.keys[0]));
  await waitFor(() => expect(result.current.admitted.size).toBe(4));
  act(() => { result.current.keys.slice(1, 4).forEach(result.current.commit); });
  await waitFor(() => expect(result.current.admitted.size).toBe(5));
});
it("prioritises a designated Anchor even when it is not first in the scene array", async () => {
  const rows = pieces(4).map((piece, index) => ({ ...piece, isAnchor: index === 2 }));
  const { result } = renderHook(() => useFurnitureAdmission(rows));
  await waitFor(() => expect(result.current.admitted.size).toBe(1));
  expect(result.current.keys[0]).toContain("2:");
  expect(result.current.admitted.has(result.current.keys[0])).toBe(true);
  expect(result.current.admitted.has("0:0:/piece-0.glb")).toBe(false);
});

it("reports Anchor plus four secondary groups and exact remaining counts for eleven pieces", () => {
  const keys = pieces(11).map(p => p.instanceId);
  for (const [loaded, group, remaining] of [[0, 1, 11], [1, 2, 10], [4, 3, 7], [7, 4, 4], [10, 5, 1], [11, 5, 0]]) {
    expect(furnitureLoadingProgress(keys, new Set(keys.slice(0, loaded)))).toEqual({ total: 11, loaded, group, groups: 5, remaining });
  }
});
it("reports Anchor and secondary groups for four pieces, ignoring completions from removed pieces", () => {
  expect(furnitureLoadingProgress(['a', 'b', 'c', 'd'], new Set(['a', 'removed']))).toEqual({ total: 4, loaded: 1, remaining: 3, group: 2, groups: 2 });
});
it("reports the final partial group for eight pieces and no groups for an empty room", () => {
  expect(furnitureLoadingProgress(['a','b','c','d','e','f','g','h'], new Set(['a','b','c','d','e','f']))).toEqual({ total: 8, loaded: 6, remaining: 2, group: 3, groups: 4 });
  expect(furnitureLoadingProgress([], new Set())).toEqual({ total: 0, loaded: 0, remaining: 0, group: 0, groups: 0 });
});
