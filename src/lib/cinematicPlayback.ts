export const CINEMATIC_ENTRY_SECONDS = 2.5;

export function advancePlayback(time: number, delta: number, speed: number, duration: number) {
  return Math.min(duration, Math.max(0, time) + Math.min(Math.max(0, delta), 0.05) * speed);
}

export function playbackTimeLabel(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}