import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { furnitureLoadingProgress, useFurnitureAdmission } from "./SequentialFurniture";

const pieces = (count: number) => Array.from({ length: count }, (_, i) => ({ instanceId: String(i), glb_url: `/piece-${i}.glb` }));
it("admits four pieces together at the exact four-item threshold", async () => {
  const rows = pieces(4);
  const { result } = renderHook(() => useFurnitureAdmission(rows));
  await waitFor(() => expect(result.current.admitted.size).toBe(4));
});
it("loads eleven pieces in 3, 3, 3, 2 groups and waits for the entire active group", async () => {
  const rows = pieces(11);
  const { result } = renderHook(() => useFurnitureAdmission(rows));
  await waitFor(() => expect(result.current.admitted.size).toBe(3));
  act(() => result.current.commit(result.current.keys[0]));
  expect(result.current.admitted.size).toBe(3);
  act(() => result.current.commit(result.current.keys[1]));
  expect(result.current.admitted.size).toBe(3);
  for (const [start, end, total] of [[2, 3, 6], [3, 6, 9], [6, 9, 11]]) {
    act(() => { for (let i = start; i < end; i++) result.current.commit(result.current.keys[i]); });
    await waitFor(() => expect(result.current.admitted.size).toBe(total));
  }
});
it("applies three-at-a-time admission starting at five items", async () => {
  const rows = pieces(5);
  const { result } = renderHook(() => useFurnitureAdmission(rows));
  await waitFor(() => expect(result.current.admitted.size).toBe(3));
  act(() => { result.current.keys.slice(0, 3).forEach(result.current.commit); });
  await waitFor(() => expect(result.current.admitted.size).toBe(5));
});

it("reports all four groups and exact remaining counts for eleven pieces", () => {
  const keys = pieces(11).map(p => p.instanceId);
  for (const [loaded, group, remaining] of [[0, 1, 11], [1, 1, 10], [3, 2, 8], [6, 3, 5], [9, 4, 2], [11, 4, 0]]) {
    expect(furnitureLoadingProgress(keys, new Set(keys.slice(0, loaded)))).toEqual({ total: 11, loaded, group, groups: 4, remaining });
  }
});
it("reports one group for four pieces, ignoring completions from removed pieces", () => {
  expect(furnitureLoadingProgress(['a', 'b', 'c', 'd'], new Set(['a', 'removed']))).toEqual({ total: 4, loaded: 1, remaining: 3, group: 1, groups: 1 });
});
it("reports the final partial group for eight pieces and no groups for an empty room", () => {
  expect(furnitureLoadingProgress(['a','b','c','d','e','f','g','h'], new Set(['a','b','c','d','e','f']))).toEqual({ total: 8, loaded: 6, remaining: 2, group: 3, groups: 3 });
  expect(furnitureLoadingProgress([], new Set())).toEqual({ total: 0, loaded: 0, remaining: 0, group: 0, groups: 0 });
});