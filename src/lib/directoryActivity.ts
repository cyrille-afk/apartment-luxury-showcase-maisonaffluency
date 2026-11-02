import { supabase } from '@/integrations/supabase/client';
import { hasConsent } from '@/lib/consent/consentStore';

export type DirectoryDay = { day: string; searches: number; letters: number; profiles: number; opens: number; dismissed: number };
export type DirectoryActivity = { updated_at: string; started_at: string | null; days: DirectoryDay[]; letters: { letter: string; count: number }[]; reasons: { reason: string; count: number }[] };
export type DesignerView = { designer_slug: string; occurred_at: string; modal_id?: string | null };
export const SEARCH_ATTRIBUTION_STARTED = '2026-11-02T00:12:00Z';
export function searchOutcomes(searches: { modal_id: string | null; occurred_at: string }[], views: DesignerView[]) {
  const firstSearch = new Map<string, string>();
  for (const search of searches) if (search.modal_id && (!firstSearch.has(search.modal_id) || search.occurred_at < (firstSearch.get(search.modal_id) ?? ''))) firstSearch.set(search.modal_id, search.occurred_at);
  const reached = new Set<string>();
  const destinations: DesignerView[] = [];
  for (const view of views) {
    const searchedAt = view.modal_id ? firstSearch.get(view.modal_id) : undefined;
    if (view.modal_id && searchedAt && view.occurred_at >= searchedAt && !reached.has(view.modal_id)) { reached.add(view.modal_id); destinations.push(view); }
  }
  return { searched: firstSearch.size, reached: reached.size, rate: dismissalRate(firstSearch.size, reached.size), destinations, firstSearch, reachedIds: reached };
}
let activeDirectory: { modalId: string; searched: boolean } | null = null;
let profileHandoff: { modalId: string; slug: string; at: number } | null = null;
export function prepareDirectoryProfile(slug: string) {
  profileHandoff = activeDirectory?.searched ? { modalId: activeDirectory.modalId, slug, at: Date.now() } : null;
}
export function consumeDirectoryProfile(slug: string) {
  const handoff = profileHandoff;
  profileHandoff = null;
  activeDirectory = null;
  return handoff?.slug === slug && Date.now() - handoff.at <= 60_000 ? handoff.modalId : null;
}
export function designerViewRanking(views: DesignerView[], names: Record<string, string>) {
  const grouped = new Map<string, { slug: string; name: string; views: number; lastViewed: string }>();
  for (const view of views) {
    const row = grouped.get(view.designer_slug) ?? { slug: view.designer_slug, name: names[view.designer_slug] ?? view.designer_slug, views: 0, lastViewed: view.occurred_at };
    row.views++;
    if (view.occurred_at > row.lastViewed) row.lastViewed = view.occurred_at;
    grouped.set(row.slug, row);
  }
  return [...grouped.values()].sort((a, b) => b.views - a.views || a.name.localeCompare(b.name));
}
export function dismissalRate(opens: number, dismissed: number): number | null {
  return opens > 0 ? dismissed / opens * 100 : null;
}
export function profileSlug(path: string): string | null {
  return path.match(/^\/(?:designers|trade\/gallery)\/([a-z0-9][a-z0-9-]{0,159})\/?$/)?.[1] ?? null;
}
let pending: Promise<unknown> = Promise.resolve();
// A separate consent-aware operational feed; the injected event pipeline remains unchanged.
export function recordDirectoryActivity(kind: 'open' | 'search' | 'letter' | 'dismiss' | 'profile', modalId: string | null, details: { letter?: string; reason?: string; designerSlug?: string } = {}) {
  if (kind === 'open' && modalId) activeDirectory = { modalId, searched: false };
  if (kind === 'search' && activeDirectory?.modalId === modalId) activeDirectory.searched = true;
  if (kind === 'letter' && activeDirectory) activeDirectory.searched = false;
  if (kind === 'dismiss') activeDirectory = null;
  if (typeof window === 'undefined' || !hasConsent('analytics') || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
  const host = window.location.hostname;
  const environment = host === 'localhost' || host === '127.0.0.1' || host.startsWith('id-preview--') || host.endsWith('-dev.lovable.app') ? 'preview' : 'production';
  const event = { _id: crypto.randomUUID(), _kind: kind, _modal_id: modalId ?? undefined, _surface: window.innerWidth >= 1024 ? 'desktop' : 'mobile', _environment: environment, _letter: details.letter, _reason: details.reason, _designer_slug: details.designerSlug };
  pending = pending.catch(() => undefined).then(async () => {
    if (!hasConsent('analytics')) return;
    await supabase.rpc('record_directory_activity', event);
  });
}