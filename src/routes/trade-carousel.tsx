import { createFileRoute } from '@tanstack/react-router';
import TradeMarketingCarousel from '@/components/TradeMarketingCarousel';

export const Route = createFileRoute('/trade-carousel')({
  head: () => ({ meta: [
    { title: 'Maison Affluency — Global Trade Program Carousel' },
    { name: 'description', content: 'Explore the Maison Affluency Global Trade Program, Felix, designer sourcing, comparisons and client presentation.' },
    { property: 'og:title', content: 'Maison Affluency — Global Trade Program Carousel' },
    { property: 'og:description', content: 'Six editorial views of the Maison Affluency trade experience.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'robots', content: 'noindex, nofollow' },
  ] }),
  component: TradeMarketingCarousel,
});