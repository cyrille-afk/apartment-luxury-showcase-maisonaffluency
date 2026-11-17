import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { viewingRoomSchema, viewingRoomItemSchema } from "./viewingRoom";

const token = z.string().min(20).max(128).regex(/^[a-zA-Z0-9_-]+(?:-[a-zA-Z0-9_-]+)*$/);
function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) throw new Error("Viewing room is temporarily unavailable.");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers); if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization"); headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  } } });
}
export const getViewingRoom = createServerFn({ method: "POST" }).inputValidator(z.object({ token })).handler(async ({ data }) => {
  setResponseHeader("Cache-Control", "private, no-store");
  const { data: room, error } = await publicClient().rpc("get_developer_viewing_room", { _token: data.token });
  if (error) throw new Error("Viewing room is temporarily unavailable.");
  return room ? viewingRoomSchema.parse(room) : null;
});
export const getViewingRoomPackage = createServerFn({ method: "POST" }).inputValidator(z.object({ token, packageId: z.string().uuid() })).handler(async ({ data }) => {
  setResponseHeader("Cache-Control", "private, no-store");
  const { data: result, error } = await publicClient().rpc("get_viewing_room_package", { _token: data.token, _package_id: data.packageId });
  if (error) throw new Error("This package is temporarily unavailable.");
  return result ? z.object({ items: z.array(viewingRoomItemSchema).max(50) }).parse(result) : null;
});