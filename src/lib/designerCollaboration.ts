/** PostgREST candidate filter; exact collaborator matching happens before display. */
export function attributedDesignerFilter(name: string): string {
  const escaped = name.replace(/,/g, "\\,");
  return `title.ilike.% by ${escaped},subtitle.ilike.by ${escaped},edition.ilike.%${escaped}%`;
}

export function creditsDesigner(
  pick: { title?: string | null; subtitle?: string | null; edition?: string | null },
  name: string,
): boolean {
  const normalize = (value: string) => value.trim().toLocaleLowerCase();
  const target = normalize(name);
  const titleCredit = pick.title?.match(/\s+by\s+(.+)$/i)?.[1];
  const subtitleCredit = pick.subtitle?.match(/^by\s+(.+)$/i)?.[1];
  if ([titleCredit, subtitleCredit].some((credit) => credit && normalize(credit) === target)) return true;
  const collaborators = (pick.edition || "").split(/\s+[x×]\s+/i);
  return collaborators.length > 1 && collaborators.some((credit) => normalize(credit) === target);
}