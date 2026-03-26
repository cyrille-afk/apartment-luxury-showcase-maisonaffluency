import { supabase } from "@/integrations/supabase/client";

const SESSION_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

let startTime: number | null = null;

function getWatchDuration(): number | null {
  if (!startTime) return null;
  return Math.round((Date.now() - startTime) / 1000);
}

export function trackVideoEvent(
  eventType: "play" | "pause" | "complete" | "milestone",
  videoId = "apartment-tour",
  progressPercent?: number
) {
  if (eventType === "play") startTime = Date.now();

  const watchDuration = getWatchDuration();

  supabase
    .from("video_watch_events" as any)
    .insert({
      session_id: SESSION_ID,
      event_type: eventType,
      video_id: videoId,
      progress_percent: progressPercent ?? null,
      watch_duration_seconds: watchDuration,
      user_agent: navigator.userAgent.slice(0, 200),
      referrer: document.referrer.slice(0, 500) || null,
    })
    .then(({ error }) => {
      if (error) console.warn("Video tracking error:", error.message);
    });
}

/** Attach milestone tracking (25/50/75/100%) to a video element */
export function attachMilestoneTracking(
  video: HTMLVideoElement,
  videoId = "apartment-tour"
) {
  const fired = new Set<number>();

  const handler = () => {
    if (!video.duration) return;
    const pct = Math.floor((video.currentTime / video.duration) * 100);

    for (const milestone of [25, 50, 75]) {
      if (pct >= milestone && !fired.has(milestone)) {
        fired.add(milestone);
        trackVideoEvent("milestone", videoId, milestone);
      }
    }
  };

  const onEnded = () => {
    if (!fired.has(100)) {
      fired.add(100);
      trackVideoEvent("complete", videoId, 100);
    }
  };

  video.addEventListener("timeupdate", handler);
  video.addEventListener("ended", onEnded);

  return () => {
    video.removeEventListener("timeupdate", handler);
    video.removeEventListener("ended", onEnded);
  };
}
