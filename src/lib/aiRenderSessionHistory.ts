type SessionResult = { imageUrl: string; storedUrl: string | null };
export function sessionImageKey(result: SessionResult): string {
  const url = result.storedUrl || result.imageUrl;
  // Re-signing the same private object does not create a new image.
  return url.includes("/storage/v1/object/") ? url.split("?")[0] ?? url : url;
}
export function uniqueSessionVersions<T extends SessionResult>(versions: T[]): T[] {
  const seen = new Set<string>();
  return versions.filter(version => { const key = sessionImageKey(version); if (seen.has(key)) return false; seen.add(key); return true; });
}
export function removeSessionVersion<T extends SessionResult>(versions: T[], target: T): T[] {
  return versions.filter(version => sessionImageKey(version) !== sessionImageKey(target));
}