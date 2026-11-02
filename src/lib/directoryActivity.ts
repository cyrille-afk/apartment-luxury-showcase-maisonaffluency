import { supabase } from '@/integrations/supabase/client';
import { hasConsent } from '@/lib/consent/consentStore';

export type DirectoryDay = { day: string; searches: number; letters: number; profiles: number; opens: number; dismissed: number };
export type DirectoryActivity = { updated_at: string; started_at: string | null; days: DirectoryDay[]; letters: { letter: string; count: number }[]; reasons: { reason: string; count: number }[] };
export type DesignerView = { designer_slug: string; occurred_at: string };
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
  if (typeof window === 'undefined' || !hasConsent('analytics') || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
  const host = window.location.hostname;
  const environment = host === 'localhost' || host === '127.0.0.1' || host.startsWith('id-preview--') || host.endsWith('-dev.lovable.app') ? 'preview' : 'production';
  const event = { _id: crypto.randomUUID(), _kind: kind, _modal_id: modalId ?? undefined, _surface: window.innerWidth >= 1024 ? 'desktop' : 'mobile', _environment: environment, _letter: details.letter, _reason: details.reason, _designer_slug: details.designerSlug };
  pending = pending.catch(() => undefined).then(async () => {
    if (!hasConsent('analytics')) return;
    await supabase.rpc('record_directory_activity', event);
  });
}