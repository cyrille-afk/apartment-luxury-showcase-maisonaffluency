import { beforeEach,expect,it,vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(),from: vi.fn() }));
vi.mock("@tanstack/react-start",() => ({ createServerFn: () => { const b = { middleware: () => b,inputValidator: () => b,handler: (fn: unknown) => fn };return b; } }));
vi.mock("@/integrations/supabase/auth-middleware",() => ({ requireSupabaseAuth: {} }));
import { saveResidenceRoom,listResidenceRoomPackages } from "./residenceRooms.functions";
type Handler = (args: { data: unknown;context: { supabase: typeof mocks;userId: string } }) => Promise<unknown>;
beforeEach(() => vi.resetAllMocks());
it("only admins can save package-specific room renders",async () => { mocks.rpc.mockResolvedValue({ data: false,error: null });await expect((saveResidenceRoom as unknown as Handler)({ data: {},context: { supabase: mocks,userId: "buyer" } })).rejects.toThrow("Admin access required");expect(mocks.from).not.toHaveBeenCalled(); });
it("only admins can list residence packages for saving views",async () => { mocks.rpc.mockResolvedValue({ data: false,error: null });await expect((listResidenceRoomPackages as unknown as Handler)({ data: {},context: { supabase: mocks,userId: "buyer" } })).rejects.toThrow("Admin access required");expect(mocks.from).not.toHaveBeenCalled(); });