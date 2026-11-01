import { createFileRoute } from '@tanstack/react-router';
import TradeAdminDirectoryActivity from '@/pages/TradeAdminDirectoryActivity';
export const Route = createFileRoute('/trade/admin_/directory-activity')({
  head: () => ({ meta: [
    { title: 'Directory Activity — Admin — Maison Affluency' },
    { name: 'description', content: 'Private directory search, initial selection, profile view and dismissal analytics for Maison Affluency.' },
    { property: 'og:title', content: 'Directory Activity — Maison Affluency' },
    { property: 'og:description', content: 'Private directory engagement dashboard.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
    { name: 'robots', content: 'noindex, nofollow' },
  ] }),
  component: TradeAdminDirectoryActivity,
});