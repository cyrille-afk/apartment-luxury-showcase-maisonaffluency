import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc:vi.fn(),from:vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => { const builder = {middleware:()=>builder,inputValidator:()=>builder,handler:(fn:unknown)=>fn};return builder; } }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({requireSupabaseAuth:{}}));
import { listResidenceShellLayouts,saveResidenceShell } from "./residenceShells.functions";
type Handler=(args:{data?:unknown;context:{supabase:typeof mocks;userId:string}})=>Promise<unknown>;
beforeEach(()=>vi.resetAllMocks());
it("only admins can attach residence shells",async()=>{
  mocks.rpc.mockResolvedValue({data:false,error:null});
  const args={data:{layoutId:"layout",shell:{label:"Living Room View",url:"https://example.com/empty.jpg"}},context:{supabase:mocks,userId:"buyer"}};
  await expect((saveResidenceShell as unknown as Handler)(args)).rejects.toThrow("Admin access required");
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  expect(mocks.from).not.toHaveBeenCalled();
});
it("admin saving passes the exact named shell and residence to the atomic append",async()=>{
  mocks.rpc.mockResolvedValueOnce({data:true,error:null}).mockResolvedValueOnce({data:null,error:null});
  const data={layoutId:"layout",shell:{label:"Living Room View",url:"https://example.com/empty.jpg"}};
  expect(await (saveResidenceShell as unknown as Handler)({data,context:{supabase:mocks,userId:"admin"}})).toEqual({saved:true});
  expect(mocks.rpc).toHaveBeenLastCalledWith("append_residence_eye_level_shell",{_layout_id:"layout",_shell:data.shell});
});
it("non-admins cannot list private residence layouts",async()=>{
  mocks.rpc.mockResolvedValue({data:false,error:null});
  await expect((listResidenceShellLayouts as unknown as Handler)({context:{supabase:mocks,userId:"buyer"}})).rejects.toThrow("Admin access required");
  expect(mocks.from).not.toHaveBeenCalled();
});