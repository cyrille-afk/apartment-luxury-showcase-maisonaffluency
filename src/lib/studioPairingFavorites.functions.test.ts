import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ upsert: vi.fn(), eq: vi.fn(), delete: vi.fn(), from: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ middleware: () => ({ inputValidator: () => ({ handler: (handler: unknown) => handler }) }) }) }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import { setStudioPairingFavorite } from "./studioPairingFavorites.functions";

const run = setStudioPairingFavorite as unknown as (args: { data: { referenceId: string; productId: string; saved: boolean }; context: { userId: string; supabase: { from: typeof mocks.from } } }) => Promise<{ saved: boolean }>;
const context = { userId: "owner", supabase: { from: mocks.from } };
const data = { referenceId: "reference", productId: "pairing", saved: true };

describe("Favorite pairing persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ upsert: mocks.upsert, delete: mocks.delete });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.delete.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ eq: mocks.eq, then: (resolve: (value: unknown) => void) => resolve({ error: null }) });
  });
  it("saves each favorite against its active piece and authenticated owner without duplicate rows", async () => {
    expect(await run({ data, context })).toEqual({ saved: true });
    expect(mocks.upsert).toHaveBeenCalledWith({ user_id: "owner", reference_id: "reference", product_id: "pairing" }, { onConflict: "user_id,reference_id,product_id", ignoreDuplicates: true });
    expect(mocks.delete).not.toHaveBeenCalled();
  });
  it("removes only the current owner's pairing for the selected reference", async () => {
    expect(await run({ data: { ...data, saved: false }, context })).toEqual({ saved: false });
    expect(mocks.eq.mock.calls).toEqual([["user_id", "owner"], ["reference_id", "reference"], ["product_id", "pairing"]]);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("does not report a failed save as successful", async () => {
    mocks.upsert.mockResolvedValue({ error: { message: "denied" } });
    await expect(run({ data, context })).rejects.toThrow("could not be saved");
  });
});