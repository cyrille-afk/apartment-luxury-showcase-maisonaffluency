import { validEyeLevelCamera, type EyeLevelCamera } from "../../supabase/functions/_shared/eyeLevelCamera";
import { validEyeLevelTarget, type EyeLevelTarget } from "../../supabase/functions/_shared/eyeLevelPlacement";
export { validEyeLevelTarget, requireEyeLevelTargets } from "../../supabase/functions/_shared/eyeLevelPlacement";
export type { EyeLevelTarget } from "../../supabase/functions/_shared/eyeLevelPlacement";
export { eyeLevelCameraKey, planPoint, validEyeLevelCamera } from "../../supabase/functions/_shared/eyeLevelCamera";
export type { EyeLevelCamera, PlanPoint } from "../../supabase/functions/_shared/eyeLevelCamera";

export type ProposalProduct = {
  id: string; product_id?: string; product_name: string; brand_name: string; image_url: string;
  dimensions?: string; materials?: string; isExternal?: boolean; rotation?: number; room_section?: string;
  material_override?: string; selected_finishes?: { axis: string; name: string; image_url?: string | null }[];
  pdf_url?: string; pdf_urls?: { label: string; url: string; filename?: string }[];
  target?: EyeLevelTarget;
};
export type ProposalRenderDraft = {
  sourceKey: string; view: "axonometric" | "eye-level"; camera: EyeLevelCamera | null;
  shellUrl: string | null; shellKey: string | null; products: ProposalProduct[];
  axonometricResult: string | null; eyeLevelResult: string | null;
  shellSource?: "generated" | "upload" | "sandbox";
};
export function restoreProposalRenderDraft(raw: unknown, sourceKey: string): ProposalRenderDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value["sourceKey"] !== sourceKey) return null;
  const durable = (v: unknown) => typeof v === "string" && /^(https?:\/\/|\/)/.test(v) ? v : null;
  return {
    sourceKey, view: value["view"] === "eye-level" ? "eye-level" : "axonometric",
    camera: validEyeLevelCamera(value["camera"]) ? value["camera"] : null,
    shellUrl: durable(value["shellUrl"]), shellKey: typeof value["shellKey"] === "string" ? value["shellKey"] : null,
    shellSource: value["shellSource"] === "upload" || value["shellSource"] === "sandbox" ? value["shellSource"] : "generated",
    products: Array.isArray(value["products"]) ? value["products"].filter((p): p is ProposalProduct => Boolean(p && typeof p === "object" && typeof p.id === "string" && typeof p.product_name === "string" && typeof p.brand_name === "string" && durable(p.image_url))).slice(0, 10).map(p => { const { target, ...rest } = p; return validEyeLevelTarget(target) ? { ...rest, target } : rest; }) : [],
    axonometricResult: durable(value["axonometricResult"]), eyeLevelResult: durable(value["eyeLevelResult"]),
  };
}