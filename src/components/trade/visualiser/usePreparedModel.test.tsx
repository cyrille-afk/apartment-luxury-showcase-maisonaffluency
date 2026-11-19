import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { StrictMode, type ReactNode } from "react";
import { usePreparedModel } from "./usePreparedModel";

it("retains the displayed piece throughout fabric, wood and marble preparation, disposing only after replacement", async () => {
  const jobs: Array<{ resolve: (value: string) => void; signal: AbortSignal }> = [];
  const prepare = vi.fn((signal: AbortSignal) => new Promise<string>(resolve => jobs.push({ resolve, signal })));
  const dispose = vi.fn();
  const { result, rerender, unmount } = renderHook(({ finish }) => usePreparedModel("chair", finish, prepare, dispose), { initialProps: { finish: "original" } });
  expect(result.current).toBeNull();
  await act(async () => jobs[0].resolve("original-model"));
  for (const [index, finish] of ["fabric", "wood", "marble"].entries()) {
    const previous = result.current;
    rerender({ finish });
    expect(result.current).toBe(previous);
    expect(dispose).not.toHaveBeenCalledWith(previous);
    await act(async () => jobs[index + 1].resolve(finish));
    expect(result.current).toBe(finish);
    expect(dispose).toHaveBeenCalledWith(previous);
  }
  unmount();
  await act(async () => {});
  expect(dispose).toHaveBeenCalledWith("marble");
});

it("rejects stale results and never shows the previous product during a swap", async () => {
  const jobs: Array<(value: string) => void> = [];
  const prepare = vi.fn(() => new Promise<string>(resolve => jobs.push(resolve)));
  const dispose = vi.fn();
  const { result, rerender } = renderHook(({ identity, finish }) => usePreparedModel(identity, finish, prepare, dispose), { initialProps: { identity: "chair", finish: "a" } });
  await act(async () => jobs[0]("chair-a"));
  rerender({ identity: "chair", finish: "b" });
  rerender({ identity: "chair", finish: "c" });
  await act(async () => jobs[1]("stale-b"));
  expect(result.current).toBe("chair-a");
  expect(dispose).toHaveBeenCalledWith("stale-b");
  await act(async () => jobs[2]("chair-c"));
  rerender({ identity: "table", finish: "c" });
  expect(result.current).toBeNull();
  await act(async () => jobs[3]("table"));
  expect(result.current).toBe("table");
});

it("does not dispose a visible resource during StrictMode effect replay", async () => {
  const jobs: Array<(value: string) => void> = [];
  const prepare = vi.fn(() => new Promise<string>(resolve => jobs.push(resolve)));
  const dispose = vi.fn();
  const { result } = renderHook(() => usePreparedModel("chair", "a", prepare, dispose), { reactStrictMode: true, wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode> });
  await act(async () => { jobs[0]("cancelled"); jobs[1]("visible"); });
  expect(result.current).toBe("visible");
  expect(dispose).toHaveBeenCalledWith("cancelled");
  expect(dispose).not.toHaveBeenCalledWith("visible");
});