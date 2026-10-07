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