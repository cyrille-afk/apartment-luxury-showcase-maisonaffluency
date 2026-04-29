import { supabase } from "@/integrations/supabase/client";

export type StudioEventType =
  | "profile_view"
  | "cta_click"
  | "directory_card_click"
  | "filter_applied";

export type StudioCtaKind = "website" | "email" | "instagram" | "contact_form";

interface LogStudioEventInput {
  studioId: string | null;
  eventType: StudioEventType;
  ctaKind?: StudioCtaKind;
  filterKey?: string;
  filterValue?: string | null;
}

/**
 * Compute a stable per-day visitor hash from user agent + UTC date.
 * Anonymous, no PII. Resets daily so unique-day counts are meaningful.
 */
async function computeVisitorHash(): Promise<string | null> {
  try {
    const ua = navigator.userAgent || "";
    const day = new Date().toISOString().slice(0, 10);
    const data = new TextEncoder().encode(`${ua}|${day}`);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);
  } catch {
    return null;
  }
}

// In-memory dedupe so a single page load doesn't double-log on re-renders
const sessionLogged = new Set<string>();

export async function logStudioEvent({
  studioId,
  eventType,
  ctaKind,
  filterKey,
  filterValue,
}: LogStudioEventInput): Promise<void> {
  if (!studioId) return;

  // Dedupe profile_view per studio per page load
  if (eventType === "profile_view") {
    const key = `pv:${studioId}`;
    if (sessionLogged.has(key)) return;
    sessionLogged.add(key);
  }

  try {
    const [{ data: sessionData }, visitor_hash] = await Promise.all([
      supabase.auth.getSession(),
      computeVisitorHash(),
    ]);
    const user_id = sessionData?.session?.user?.id ?? null;

    await supabase.from("studio_lead_events").insert({
      studio_id: studioId,
      event_type: eventType,
      cta_kind: ctaKind ?? null,
      filter_key: filterKey ?? null,
      filter_value: filterValue ?? null,
      user_id,
      visitor_hash,
      user_agent: navigator.userAgent?.slice(0, 500) ?? null,
      referrer: document.referrer?.slice(0, 500) || null,
    });
  } catch {
    // Tracking should never break the UI
  }
}
