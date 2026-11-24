import { createFileRoute } from '@tanstack/react-router';
import TradeAdminArAnalytics from '@/pages/TradeAdminArAnalytics';
import { Button } from '@/components/ui/button';
import type { ArSurface } from '@/lib/arAnalytics';

export const Route = createFileRoute('/trade/admin_/ar-analytics')({
  validateSearch: (s: Record<string, unknown>): { surface?: ArSurface } => ({ surface: s['surface'] === 'board' || s['surface'] === 'viewing-room' || s['surface'] === 'product' ? s['surface'] : 'all' }),
  head: () => ({ meta: [
    { title: 'AR Experience — Maison Affluency Admin' },
    { name: 'description', content: 'Private AR launch attempts, confirmed opens and fallback-rate trends for Maison Affluency.' },
    { property: 'og:title', content: 'AR Experience — Maison Affluency' },
    { property: 'og:description', content: 'Private client augmented-reality activity dashboard.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
    { name: 'robots', content: 'noindex, nofollow' },
  ] }),
  component: TradeAdminArAnalytics,
  errorComponent: () => <div role="alert" className="space-y-3"><p>AR activity could not be loaded or admin access could not be confirmed.</p><Button variant="outline" onClick={() => window.location.reload()}>Try again</Button></div>,
});