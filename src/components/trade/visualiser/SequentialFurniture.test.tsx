import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { useFurnitureAdmission } from "./SequentialFurniture";

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