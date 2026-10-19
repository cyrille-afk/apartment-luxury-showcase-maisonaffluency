// Mirrors private_client_code_request: 10-minute codes, 45-second resend wait.
export const CODE_LIFETIME_MS = 10 * 60 * 1000;
export const RESEND_WAIT_MS = 45 * 1000;

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
