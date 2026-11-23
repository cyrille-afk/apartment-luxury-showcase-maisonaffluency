import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, getRequestUrl, getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { viewingRoomSchema, viewingRoomItemSchema, viewingRoomSlotSchema, viewingRoomChoiceSchema } from "./viewingRoom";
import { viewingRoomPath, viewingRoomCookieName, isShortViewingRoomCode } from "./viewingRoomLink";

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
export const lockViewingRoomProposal = createServerFn({ method: "POST" }).inputValidator(z.object({ token: locator, packageId: z.string().uuid(), requestKey: z.string().uuid(), choices: z.array(z.object({ slot_id: z.string().uuid(), product_id: z.string().uuid(), finish_key: z.string().max(20).optional(), size_key: z.string().max(300).optional(), colourway_id: z.string().max(80).optional() })).max(50) })).handler(async ({ data }) => {
  setResponseHeader("Cache-Control", "private, no-store");
  const access = await verifiedRoom(data.token);
  if (!access) throw new Error("Please enter your private access code again.");
  const result = await publicClient().rpc("lock_viewing_room_proposal", { _token: access.credential, _package_id: data.packageId, _request_key: data.requestKey, _choices: data.choices });
  if (result.error) throw new Error("Your proposal couldn’t be locked. Please try again.");
  return z.object({ package: z.string(), currency: z.string(), total: z.number(), items: z.array(viewingRoomChoiceSchema), status: z.literal("requested") }).parse(result.data);
});
export const getViewingRoomPackage = createServerFn({ method: "POST" }).inputValidator(z.object({ token: locator, packageId: z.string().uuid() })).handler(async ({ data }) => {
  setResponseHeader("Cache-Control", "private, no-store");
  const access = await verifiedRoom(data.token);
  if (!access) return null;
  const { data: result, error } = await publicClient().rpc("get_viewing_room_package", { _token: access.credential, _package_id: data.packageId });
  if (error) throw new Error("This package is temporarily unavailable.");
  return result ? z.object({ items: z.array(viewingRoomItemSchema).max(50) }).parse(result) : null;
});