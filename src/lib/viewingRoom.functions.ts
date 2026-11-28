import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, getRequestUrl, getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { viewingRoomSchema, viewingRoomItemSchema, viewingRoomSlotSchema, viewingRoomChoiceSchema } from "./viewingRoom";
import { viewingRoomPath, viewingRoomCookieName, isShortViewingRoomCode } from "./viewingRoomLink";
import { approvedVisualizationPieces, residenceShellsSchema, visualizationChoiceSchema, visualizationPlacements, visualizationSignature } from "./residenceVisualization";

const token = z.string().min(8).max(128).regex(/^[a-zA-Z0-9_-]+(?:-[a-zA-Z0-9_-]+)*$/);
const locator = z.string().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) throw new Error("Viewing room is temporarily unavailable.");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers); if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization"); headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  } } });
}
async function resolveCredential(value: string, allowEnded = false): Promise<string | null> {
  if (!isShortViewingRoomCode(value)) return value.length >= 20 ? value : null;
  const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-real-ip") ?? "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`viewing-room:${ip}`));
  const attemptKey = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result = await supabaseAdmin.rpc("resolve_viewing_room_short_code", { _code: value.toUpperCase(), _attempt_key: attemptKey, _allow_ended: allowEnded });
  if (result.error) throw new Error("Viewing room is temporarily unavailable.");
  return result.data ?? null;
}
export const redeemViewingRoomAccess = createServerFn({ method: "POST" }).inputValidator(z.object({ token, locator: locator.optional() })).handler(async ({ data }) => {
  setResponseHeader("Cache-Control", "private, no-store");
  const credential = await resolveCredential(data.token);
  if (!credential) return null;
  const { data: room, error } = await publicClient().rpc("get_developer_viewing_room", { _token: credential });
  if (error) throw new Error("Viewing room is temporarily unavailable.");
  if (!room) return null;
  const parsed = viewingRoomSchema.parse(room);
  const path = viewingRoomPath(parsed.name);
  const slug = path.split("/").pop() ?? "";
  if (data.locator && data.locator !== slug) return null;
  setCookie(viewingRoomCookieName(slug), credential, { httpOnly: true, secure: getRequestUrl().protocol === "https:", sameSite: "strict", path: "/", maxAge: 604800 });
  return { path };
});
async function verifiedRoom(slug: string) {
  const credential = getCookie(viewingRoomCookieName(slug));
  if (!credential) return null;
  const { data, error } = await publicClient().rpc("get_developer_viewing_room", { _token: credential });
  if (error) throw new Error("Viewing room is temporarily unavailable.");
  const room = data ? viewingRoomSchema.parse(data) : null;
  return room && viewingRoomPath(room.name) === `/viewing-room/${slug}` ? { room, credential } : null;
}
export const getViewingRoom = createServerFn({ method: "POST" }).inputValidator(z.object({ token: locator })).handler(async ({ data }) => {
  setResponseHeader("Cache-Control", "private, no-store");
  return (await verifiedRoom(data.token))?.room ?? null;
});
export const checkViewingRoomAccess = createServerFn({ method: "POST" }).inputValidator(z.object({ token })).handler(async ({ data }) => {
  setResponseHeader("Cache-Control", "private, no-store");
  const credential = await resolveCredential(data.token, true);
  if (!credential) return null;
  const { data: status, error } = await publicClient().rpc("get_viewing_room_access_status", { _token: credential });
  if (error) throw new Error("Viewing room is temporarily unavailable.");
  return status === "expired" || status === "revoked" ? status : null;
});
export const getViewingRoomChoices = createServerFn({ method: "POST" }).inputValidator(z.object({ token: locator, packageId: z.string().uuid() })).handler(async ({ data }) => {
  setResponseHeader("Cache-Control", "private, no-store");
  const access = await verifiedRoom(data.token);
  if (!access) return null;
  const result = await publicClient().rpc("get_viewing_room_personalization", { _token: access.credential, _package_id: data.packageId });
  if (result.error) throw new Error("Collection choices couldn’t load.");
  return result.data ? z.object({ items: z.array(viewingRoomSlotSchema), allow_alternatives: z.boolean().default(true) }).parse(result.data) : null;
});
export const lockViewingRoomProposal = createServerFn({ method: "POST" }).inputValidator(z.object({ token: locator, packageId: z.string().uuid(), requestKey: z.string().uuid(), choices: z.array(visualizationChoiceSchema).max(50), visualizationId: z.string().uuid().optional() })).handler(async ({ data }) => {
  setResponseHeader("Cache-Control", "private, no-store");
  const access = await verifiedRoom(data.token);
  if (!access) throw new Error("Please enter your private access code again.");
  const result = await publicClient().rpc("lock_viewing_room_proposal", { _token: access.credential, _package_id: data.packageId, _request_key: data.requestKey, _choices: data.choices });
  if (result.error) throw new Error("Your proposal couldn’t be locked. Please try again.");
  const final = z.object({
    package: z.string(),
    currency: z.string(),
    total: z.number(),
    items: z.array(viewingRoomChoiceSchema),
    status: z.literal("requested"),
    proposal_id: z.string().uuid().optional(),
    share_token: z.string().optional(),
    axonometric_render_url: z.string().nullable().optional(),
    walkthrough_url: z.string().nullable().optional(),
  }).parse(result.data);
  if (data.visualizationId && final.proposal_id) {
    final.axonometric_render_url = await attachPrivateVisualization(access.credential, data.packageId, data.visualizationId, final.proposal_id, final.items);
  }
  return final;
});
export const getViewingRoomPackage = createServerFn({ method: "POST" }).inputValidator(z.object({ token: locator, packageId: z.string().uuid() })).handler(async ({ data }) => {
  setResponseHeader("Cache-Control", "private, no-store");
  const access = await verifiedRoom(data.token);
  if (!access) return null;
  const { data: result, error } = await publicClient().rpc("get_viewing_room_package", { _token: access.credential, _package_id: data.packageId });
  if (error) throw new Error("This package is temporarily unavailable.");
  return result ? z.object({ items: z.array(viewingRoomItemSchema).max(50) }).parse(result) : null;
});

async function credentialHash(credential: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(credential));
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2,"0")).join("");
}
async function attachPrivateVisualization(credential: string, packageId: string, visualizationId: string, proposalId: string, items: z.infer<typeof viewingRoomChoiceSchema>[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result = await supabaseAdmin.from("viewing_room_visualizations").select("image_url,selection_signature").eq("id",visualizationId).eq("package_id",packageId).eq("credential_hash",await credentialHash(credential)).eq("status","completed").single();
  if (result.error || !result.data.image_url || result.data.selection_signature !== visualizationSignature(items)) throw new Error("Your collection changed. Generate a new visualization before attaching it.");
  const saved = await supabaseAdmin.from("viewing_room_proposal_requests").update({ axonometric_render_url: result.data.image_url, visualiser_published_at: new Date().toISOString() }).eq("id",proposalId).eq("package_id",packageId).select("axonometric_render_url").single();
  if (saved.error || saved.data.axonometric_render_url !== result.data.image_url) throw new Error("The visualization couldn’t be attached. Please retry.");
  return result.data.image_url;
}
export const getResidenceVisualizationShells = createServerFn({ method: "POST" }).inputValidator(z.object({ token: locator, packageId: z.string().uuid() })).handler(async ({ data }) => {
  setResponseHeader("Cache-Control","private, no-store");
  const access = await verifiedRoom(data.token);
  const layout = access?.room.layouts.find(row => row.packages.some(pkg => pkg.id === data.packageId));
  if (!access || !layout) throw new Error("Please enter your private access code again.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result = await supabaseAdmin.from("residence_layouts").select("eye_level_shell_urls").eq("id",layout.id).single();
  if (result.error) throw new Error("Residence views couldn’t load.");
  return residenceShellsSchema.parse(result.data.eye_level_shell_urls);
});
export const generateResidenceVisualization = createServerFn({ method: "POST" }).inputValidator(z.object({ token: locator, packageId: z.string().uuid(), shellUrl: z.string().url().max(2048), choices: z.array(visualizationChoiceSchema).max(50) })).handler(async ({ data }) => {
  setResponseHeader("Cache-Control","private, no-store");
  const access = await verifiedRoom(data.token);
  const layout = access?.room.layouts.find(row => row.packages.some(pkg => pkg.id === data.packageId));
  if (!access || !layout) throw new Error("Please enter your private access code again.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const shells = await supabaseAdmin.from("residence_layouts").select("eye_level_shell_urls").eq("id",layout.id).single();
  if (shells.error || !residenceShellsSchema.parse(shells.data.eye_level_shell_urls).some(shell => shell.url === data.shellUrl)) throw new Error("Choose a saved view of this residence.");
  const result = await publicClient().rpc("get_viewing_room_personalization", { _token: access.credential, _package_id: data.packageId });
  if (result.error || !result.data) throw new Error("Collection choices couldn’t load.");
  const approved = z.object({ items: z.array(viewingRoomSlotSchema), allow_alternatives: z.boolean().default(true) }).parse(result.data);
  const pieces = approvedVisualizationPieces(approved.items.map(slot => ({ ...slot, is_swappable: slot.is_swappable && approved.allow_alternatives })), data.choices);
  if (pieces.some(piece => !piece.image_url)) throw new Error("Every collection piece needs a reference photo.");
  const queued = await supabaseAdmin.rpc("queue_viewing_room_visualization", { _package_id: data.packageId, _credential_hash: await credentialHash(access.credential), _selection_signature: visualizationSignature(pieces), _payload: { mode: "eye_level_proposal", imageUrl: data.shellUrl, referenceImageUrl: layout.floorplan_url?.startsWith("https://") ? layout.floorplan_url : data.shellUrl, qualityTier: "standard", placements: visualizationPlacements(pieces) } });
  if (queued.error || !queued.data) throw new Error("A visualization is already running or your hourly allowance is reached. Please try later.");
  try {
    const generation = await supabaseAdmin.functions.invoke("axonometric-generate", { body: { viewingRoomRenderId: queued.data } });
    if (generation.error || generation.data?.error || !generation.data?.storedUrl) throw new Error("Generation failed");
    // Recheck parent access after the potentially long generation.
    if (!(await verifiedRoom(data.token))) throw new Error("Access ended");
    const saved = await supabaseAdmin.from("viewing_room_visualizations").update({ status: "completed", image_url: generation.data.storedUrl }).eq("id",queued.data).select("image_url").single();
    if (saved.error || !saved.data.image_url) throw new Error("Save failed");
    return { id: queued.data, url: saved.data.image_url };
  } catch {
    await supabaseAdmin.from("viewing_room_visualizations").update({ status: "failed" }).eq("id",queued.data);
    throw new Error("Your residence visualization couldn’t be generated. Your collection is unchanged; please retry.");
  }
});