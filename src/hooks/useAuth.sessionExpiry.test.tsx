import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import { AuthProvider, useAuth } from "./useAuth";

const mock = vi.hoisted(() => ({
  current: null as Session | null,
  listener: null as ((event: string, session: Session | null) => void) | null,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: {
    getSession: async () => ({ data: { session: mock.current } }),
    refreshSession: async () => ({ data: { session: mock.current } }),
    signOut: async () => { mock.current = null; mock.listener?.("SIGNED_OUT", null); },
    onAuthStateChange: (listener: typeof mock.listener) => {
      mock.listener = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    },
  },
  from: (table: string) => {
    const response = { data: table === "user_roles" ? [{ role: "trade_user" }] : table === "profiles" ? {} : [], error: null };
    const query = {
      select: () => query, eq: () => query, order: () => query, limit: async () => response,
      single: async () => response,
      then: (resolve: (value: typeof response) => unknown) => Promise.resolve(response).then(resolve),
    };
    return query;
  },
} }));

const validSession = () => ({ user: { id: "member-1" }, expires_at: Math.floor(Date.now() / 1000) + 3600 }) as Session;
beforeEach(() => { mock.current = validSession(); mock.listener = null; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function setup() {
  const result = renderHook(() => useAuth(), { wrapper: AuthProvider }).result;
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
}

describe("confirmed dashboard session loss", () => {
  it("marks involuntary expiry and clears member permissions", async () => {
    const result = await setup();
    expect(result.current.isTradeUser).toBe(true);
    act(() => { mock.current = null; mock.listener?.("SIGNED_OUT", null); });
    await waitFor(() => expect(result.current.sessionExpired).toBe(true));
    expect(result.current.user).toBeNull();
    expect(result.current.isTradeUser).toBe(false);
    expect(result.current.rolesLoaded).toBe(false);
  });
  it("keeps a valid stored session on a spurious SIGNED_OUT", async () => {
    const result = await setup();
    act(() => mock.listener?.("SIGNED_OUT", null));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    expect(result.current.user?.id).toBe("member-1");
    expect(result.current.sessionExpired).toBe(false);
  });
  it("does not label intentional sign-out as expiry", async () => {
    const result = await setup();
    await act(async () => result.current.signOut());
    expect(result.current.user).toBeNull();
    expect(result.current.sessionExpired).toBe(false);
  });
  it("does not label a first signed-out visit as expiry", async () => {
    mock.current = null;
    const result = await setup();
    expect(result.current.user).toBeNull();
    expect(result.current.sessionExpired).toBe(false);
  });
});