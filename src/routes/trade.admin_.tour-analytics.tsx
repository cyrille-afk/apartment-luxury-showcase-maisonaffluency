import { createFileRoute } from '@tanstack/react-router';
import TradeAdminTourAnalytics from '@/pages/TradeAdminTourAnalytics';
import { Button } from '@/components/ui/button';
export const Route = createFileRoute('/trade/admin_/tour-analytics')({
  validateSearch: (s: Record<string, unknown>): { days?: 7 | 30 | 90; environment?: 'production' | 'preview'; tour?: 'felix' | 'quick' } => ({ days: [7,30,90].includes(Number(s.days)) ? Number(s.days) as 7 | 30 | 90 : 30, environment: s.environment === 'preview' ? 'preview' : 'production', tour: s.tour === 'quick' ? 'quick' : 'felix' }),
  head: () => ({ meta: [{title:'Onboarding Tour Activity — Maison Affluency Admin'}, {name:'description',content:'Private onboarding starts, completions, replay rates and step drop-off dashboard.'},{property:'og:title',content:'Onboarding Tour Activity — Maison Affluency'}, {property:'og:description',content:'Private Trade Programme onboarding activity.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'},{name:'robots',content:'noindex, nofollow'}] }),
  component: TradeAdminTourAnalytics,
  errorComponent: () => <div role="alert">Tour activity could not be loaded. <Button variant="outline" onClick={() => window.location.reload()}>Try again</Button></div>,
});