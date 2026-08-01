import { supabase } from "@/integrations/supabase/client";

/**
 * PWA push opt-in for trade users.
 *
 * Uses a dedicated messaging service worker (`/push-sw.js`) — it is not an
 * app-shell cache and never intercepts navigation, so it does not interfere
 * with previews or deploys.
 */

// VAPID public key is, by design, public.
export const VAPID_PUBLIC_KEY =
  "BH_YvYrN0eUrwJpFmmVMvaVjSjCbv_X0LogODKwr-U3byzRAvx11MP_HgPAsYgrfHm_YzK_FX4uZGUvGCpm3R74";

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission(): NotificationPermission | "unsupported" {
  return pushSupported() ? Notification.permission : "unsupported";
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function keyToBase64(key: ArrayBuffer | null) {
  if (!key) return "";
  return btoa(String.fromCharCode(...new Uint8Array(key)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Asks for permission, subscribes, and stores the subscription for this user. */
export async function enablePush(userId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: permission };

  const registration = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const p256dh = json.keys?.p256dh || keyToBase64(subscription.getKey("p256dh"));
  const auth = json.keys?.auth || keyToBase64(subscription.getKey("auth"));

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent.slice(0, 300),
    },
    { onConflict: "endpoint" },
  );

  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

/** Removes the browser subscription and the stored row. */
export async function disablePush() {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration("/push-sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    await subscription.unsubscribe();
  }
  await registration?.unregister();
}
