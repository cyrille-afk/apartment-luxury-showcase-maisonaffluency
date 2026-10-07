import type { CinematicPreset } from "@/hooks/useCinematicPath";

export const CINEMATIC_ENTRY_SECONDS = 2.5;
export const CINEMATIC_TRANSITION_SECONDS = 3;

/** Preserve route phase rather than restarting when a preset has a new duration. */
export function remapPlaybackTime(time: number, previousDuration: number, nextDuration: number) {
  if (time < CINEMATIC_ENTRY_SECONDS) return Math.max(0, time);
  const phase = Math.max(0, Math.min(1, (time - CINEMATIC_ENTRY_SECONDS) / previousDuration));
  return CINEMATIC_ENTRY_SECONDS + phase * nextDuration;
}

export function cameraTransitionBlend(time: number) {
  const t = Math.max(0, Math.min(1, time / CINEMATIC_TRANSITION_SECONDS));
  return Math.max(0, Math.min(1, t * t * t * (t * (t * 6 - 15) + 10)));
}
export const WALKTHROUGH_SPEEDS = [0.5, 0.75, 1, 1.5, 2];

export const WALKTHROUGH_PREFERENCES_KEY = "ma_walkthrough_preferences_v1";
export type WalkthroughPreferences = { preset: CinematicPreset; speed: number; loop: boolean };

export function readWalkthroughPreferences(): WalkthroughPreferences {
  const defaults: WalkthroughPreferences = { preset: "sweep", speed: 1, loop: false };
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(WALKTHROUGH_PREFERENCES_KEY) ?? "null");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return defaults;
    const value = saved as Record<string, unknown>;
    return {
      preset: value.preset === "sweep" || value.preset === "slow-orbit" || value.preset === "furniture-tour" ? value.preset : defaults.preset,
      speed: typeof value.speed === "number" && WALKTHROUGH_SPEEDS.includes(value.speed) ? value.speed : defaults.speed,
      loop: typeof value.loop === "boolean" ? value.loop : defaults.loop,
    };
  } catch { return defaults; }
}

export function saveWalkthroughPreferences(preferences: WalkthroughPreferences) {
  try { window.localStorage.setItem(WALKTHROUGH_PREFERENCES_KEY, JSON.stringify(preferences)); }
  catch { /* Storage restrictions must not interrupt playback. */ }
}

/** Selected custom path id lives alongside the preset prefs (null = use preset). */
export const WALKTHROUGH_CUSTOM_PATH_KEY = "ma_walkthrough_custom_path_v1";
export function readCustomPathPreference(): string | null {
  try { const v = window.localStorage.getItem(WALKTHROUGH_CUSTOM_PATH_KEY); return v && v.length <= 64 ? v : null; } catch { return null; }
}
export function saveCustomPathPreference(id: string | null) {
  try { if (id) window.localStorage.setItem(WALKTHROUGH_CUSTOM_PATH_KEY, id); else window.localStorage.removeItem(WALKTHROUGH_CUSTOM_PATH_KEY); } catch { /* ignore */ }
}

/** Validate a cross-device row with the same rules as local storage. */
export function parseRemotePreferences(row: unknown): (WalkthroughPreferences & { customPathId: string | null }) | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const speed = Number(r.speed);
  return {
    preset: r.preset === "slow-orbit" || r.preset === "furniture-tour" ? r.preset : "sweep",
    speed: WALKTHROUGH_SPEEDS.includes(speed) ? speed : 1,
    loop: r.loop === true,
    customPathId: typeof r.custom_path_id === "string" && r.custom_path_id.length <= 64 ? r.custom_path_id : null,
  };
}

export function steppedPlaybackSpeed(speed: number, direction: number) {
  const index = WALKTHROUGH_SPEEDS.indexOf(speed);
  return WALKTHROUGH_SPEEDS[Math.max(0, Math.min(WALKTHROUGH_SPEEDS.length - 1, index + direction))] ?? 1;
}

/** Never capture typing, native controls, or modified browser shortcuts. */
export function walkthroughShortcut(event: KeyboardEvent): "toggle" | "restart" | "slower" | "faster" | null {
  if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return null;
  const target = event.target;
  if (target instanceof Element && target.closest('input, textarea, select, button, a, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="combobox"], [role="menu"], [role="listbox"], [role="dialog"]')) return null;
  if (event.code === "Space") return "toggle";
  if (event.key.toLowerCase() === "r") return "restart";
  if (event.key === "[" || event.key === "-" || event.key === "_") return "slower";
  if (event.key === "]" || event.key === "+" || event.key === "=") return "faster";
  return null;
}

export function advancePlayback(time: number, delta: number, speed: number, duration: number) {
  return Math.min(duration, Math.max(0, time) + Math.min(Math.max(0, delta), 0.05) * speed);
}

export function playbackTimeLabel(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}