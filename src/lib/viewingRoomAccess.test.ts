import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), resolve: vi.fn(), getCookie: vi.fn(), setCookie: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: mocks.resolve } }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: () => ({ handler: (fn: unknown) => fn }) }) }));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: vi.fn(), getCookie: mocks.getCookie, setCookie: mocks.setCookie, setResponseHeader: vi.fn(), getRequestUrl: () => new URL("https://www.maisonaffluency.com") }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: mocks.rpc }) }));
import { checkViewingRoomAccess, getViewingRoom, getViewingRoomPackage, getViewingRoomChoices, lockViewingRoomProposal, redeemViewingRoomAccess } from "./viewingRoom.functions";
type Handler = (args: { data: Record<string, unknown> }) => Promise<unknown>;
const call = (fn: unknown, data: Record<string, unknown>) => (fn as Handler)({ data });
const room = { name: "Cipriani Residences Miami", project_name: "Cipriani Miami", logo: null, hero: null, layouts: [] };
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("SUPABASE_URL", "https://example.invalid"); vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-key"); });
it("eight-character code redemption keeps the underlying credential out of the result", async () => {
  mocks.resolve.mockResolvedValue({ data: "private-test-credential", error: null });
  mocks.rpc.mockResolvedValue({ data: room, error: null });
  expect(await call(redeemViewingRoomAccess, { token: "CPR-8492" })).toEqual({ path: "/viewing-room/cipriani-residences-miami" });
  expect(mocks.resolve).toHaveBeenCalledWith("resolve_viewing_room_short_code", { _code: "CPR-8492", _attempt_key: expect.stringMatching(/^[a-f0-9]{64}$/), _allow_ended: false });
  expect(mocks.setCookie.mock.calls[0]?.[1]).toBe("private-test-credential");
});
it.each(["invalid", "expired", "revoked", "rate-limited"])("%s short codes never establish access", async () => {
  mocks.resolve.mockResolvedValue({ data: null, error: null });
  expect(await call(redeemViewingRoomAccess, { token: "CPR-8492" })).toBeNull();
  expect(mocks.setCookie).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("a branded address alone grants no room, package, choices or proposal access", async () => {
  mocks.getCookie.mockReturnValue(undefined);
  const data = { token: "cipriani-residences-miami", packageId: "package" };
  for (const fn of [getViewingRoom, getViewingRoomPackage, getViewingRoomChoices]) expect(await call(fn, data)).toBeNull();
  await expect(call(lockViewingRoomProposal, data)).rejects.toThrow("private access code");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("valid code redemption returns only the branded path and sets secure HttpOnly access", async () => {
  mocks.rpc.mockResolvedValue({ data: room, error: null });
  expect(await call(redeemViewingRoomAccess, { token: "private-test-credential", locator: "cipriani-residences-miami" })).toEqual({ path: "/viewing-room/cipriani-residences-miami" });
  expect(mocks.setCookie).toHaveBeenCalledWith("ma_viewing_room_cipriani-residences-miami", "private-test-credential", { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 604800 });
});
it("invalid or wrong-room codes never establish access", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: room, error: null });
  expect(await call(redeemViewingRoomAccess, { token: "invalid-test-credential" })).toBeNull();
  expect(await call(redeemViewingRoomAccess, { token: "private-test-credential", locator: "other-residence" })).toBeNull();
  expect(mocks.setCookie).not.toHaveBeenCalled();
});
it("every cookie read revalidates revocation and exact room scope", async () => {
  mocks.getCookie.mockReturnValue("private-test-credential");
  mocks.rpc.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: room, error: null });
  expect(await call(getViewingRoom, { token: "cipriani-residences-miami" })).toBeNull();
  expect(await call(getViewingRoomPackage, { token: "other-residence", packageId: "package" })).toBeNull();
  expect(mocks.rpc).toHaveBeenCalledTimes(2);
});
it.each(["expired", "revoked"])("%s codes reject redemption and all already-open session operations", async () => {
  mocks.getCookie.mockReturnValue("ended-private-credential");
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  expect(await call(redeemViewingRoomAccess, { token: "ended-private-credential" })).toBeNull();
  expect(mocks.setCookie).not.toHaveBeenCalled();
  const data = { token: "cipriani-residences-miami", packageId: "package", requestKey: "request", choices: [] };
  for (const fn of [getViewingRoom, getViewingRoomPackage, getViewingRoomChoices]) expect(await call(fn, data)).toBeNull();
  await expect(call(lockViewingRoomProposal, data)).rejects.toThrow("private access code");
  expect(mocks.rpc.mock.calls.every(([name]) => name === "get_developer_viewing_room")).toBe(true);
});
it.each(["expired", "revoked"])("access status reports %s codes so clients see the ended-access page", async status => {
  mocks.rpc.mockResolvedValue({ data: status, error: null });
  expect(await call(checkViewingRoomAccess, { token: "ended-private-credential" })).toBe(status);
  expect(mocks.rpc).toHaveBeenCalledWith("get_viewing_room_access_status", { _token: "ended-private-credential" });
});
it("access status stays silent for valid, unknown or malformed lookups", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: "invalid", error: null }).mockResolvedValueOnce({ data: null, error: null });
  expect(await call(checkViewingRoomAccess, { token: "active-private-credential" })).toBeNull();
  expect(await call(checkViewingRoomAccess, { token: "unknown-private-credential" })).toBeNull();
});