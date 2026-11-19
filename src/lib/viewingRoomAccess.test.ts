import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getCookie: vi.fn(), setCookie: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: () => ({ handler: (fn: unknown) => fn }) }) }));
vi.mock("@tanstack/react-start/server", () => ({ getCookie: mocks.getCookie, setCookie: mocks.setCookie, setResponseHeader: vi.fn(), getRequestUrl: () => new URL("https://www.maisonaffluency.com") }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: mocks.rpc }) }));
import { getViewingRoom, getViewingRoomPackage, getViewingRoomChoices, lockViewingRoomProposal, redeemViewingRoomAccess } from "./viewingRoom.functions";
type Handler = (args: { data: Record<string, unknown> }) => Promise<unknown>;
const call = (fn: unknown, data: Record<string, unknown>) => (fn as Handler)({ data });
const room = { name: "Cipriani Residences Miami", project_name: "Cipriani Miami", logo: null, hero: null, layouts: [] };
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("SUPABASE_URL", "https://example.invalid"); vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-key"); });
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