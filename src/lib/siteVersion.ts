// The build time is baked into the bundle at build time, so on the published
// site it reads as the last publish time; in the preview it is the preview's
// own build time. Either way it identifies the version the guest is viewing.
export function siteBuildLabel(): string | null {
  const raw = String(import.meta.env["VITE_APP_BUILD_TIME"] ?? "");
  const date = new Date(raw);
  if (!raw || Number.isNaN(date.getTime())) return null;
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" }).format(date);
  return `${day} · ${time} UTC`;
}
