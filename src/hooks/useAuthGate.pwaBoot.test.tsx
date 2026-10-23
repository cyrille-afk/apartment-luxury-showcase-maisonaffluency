import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuthGate } from "./useAuthGate";

const state = vi.hoisted(() => ({ user: null as null | { id: string }, loading: false, isPwaBooting: false }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => state }));
afterEach(() => { cleanup(); state.isPwaBooting = false; state.user = null; });
describe("guest prompt startup priority", () => {
  it("blocks prompts while PWA validation runs even if auth loading is false", () => {
    state.isPwaBooting = true;
    const { result } = renderHook(() => useAuthGate());
    const action = vi.fn();
    act(() => result.current.requireAuth(action));
    expect(result.current.gateOpen).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });
  it("clears an already-requested prompt so it cannot reappear after sync", () => {
    const { result, rerender } = renderHook(() => useAuthGate());
    act(() => result.current.requireAuth(vi.fn()));
    expect(result.current.gateOpen).toBe(true);
    state.isPwaBooting = true; rerender();
    expect(result.current.gateOpen).toBe(false);
    state.isPwaBooting = false; rerender();
    expect(result.current.gateOpen).toBe(false);
  });
});