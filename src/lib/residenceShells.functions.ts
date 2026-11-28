import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { residenceShellSchema } from "./residenceVisualization";

export const listResidenceShellLayouts = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (role.error || !role.data) throw new Error("Admin access required.");
  const result = await context.supabase.from("residence_layouts").select("id,name,floorplan_url,developer_project_id").order("name");
  if (result.error) throw new Error("Residences couldn’t load.");
  return result.data;
});
export const saveResidenceShell = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ layoutId: z.string().uuid(), shell: residenceShellSchema })).handler(async ({ data, context }) => {
  const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (role.error || !role.data) throw new Error("Admin access required.");
  const result = await context.supabase.rpc("append_residence_eye_level_shell", { _layout_id: data.layoutId, _shell: data.shell });
  if (result.error) throw new Error("The residence view couldn’t be saved. Please retry.");
  return { saved: true };
});