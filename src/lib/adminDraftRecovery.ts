import { z } from "zod";

const developer = z.object({ developer_name: z.string(), developer_logo_url: z.string(), hero_image_url: z.string() });
const layout = z.object({ name: z.string(), floorplan_url: z.string(), specs_label: z.string(), room_environment_glb: z.string() });
const packageDraft = z.object({ moodboard_id: z.string(), tier_name: z.string(), package_price: z.string(), currency: z.string(), description: z.string(), lead_time_weeks: z.string().optional(), allow_alternatives: z.boolean().optional() });
export const adminRecoverySchema = z.object({
  version: z.literal(1), updatedAt: z.number(), developerId: z.string(), layoutId: z.string(),
  developer: developer.optional(), layout: layout.optional(), packages: z.array(packageDraft).optional(),
  assignment: z.object({ index: z.number().int().nonnegative().nullable(), draft: packageDraft }).optional(),
});
export type AdminRecoveryDraft = z.infer<typeof adminRecoverySchema>;
export const adminRecoveryKey = (userId: string, projectId: string) => `ma-admin-recovery-v1:${encodeURIComponent(userId)}:${encodeURIComponent(projectId)}`;
export function parseAdminRecovery(raw: string | null): AdminRecoveryDraft | null {
  try { const result = adminRecoverySchema.safeParse(JSON.parse(raw ?? "null")); return result.success ? result.data : null; }
  catch { return null; }
}
export function hasRecoveryChanges(draft: AdminRecoveryDraft): boolean {
  return !!(draft.developer || draft.layout || draft.packages || draft.assignment);
}