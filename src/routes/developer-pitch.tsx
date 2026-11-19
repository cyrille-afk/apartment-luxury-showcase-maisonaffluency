import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PitchSlide, slideTitles } from '@/components/developer-pitch/slides';
import { exportPitchPdf } from '@/components/developer-pitch/exportPitch';

export const Route = createFileRoute('/developer-pitch')({
  validateSearch: (search: Record<string, unknown>): { slide?: number } => ({ slide: Number.isInteger(Number(search.slide)) ? Math.max(1, Math.min(8, Number(search.slide))) : undefined }),
  head: () => ({ meta: [
    { title: 'Developer Partnership — Cipriani × Maison Affluency' },
    { name: 'description', content: 'An eight-slide developer partnership presentation: Cipriani Residences Miami, collectible interiors, private viewing rooms and a proposed 14-day pilot.' },
    { property: 'og:title', content: 'Developer Partnership — Cipriani × Maison Affluency' },
    { property: 'og:description', content: 'From residence plans to curated 3D personalization and a fully managed interiors proposal.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: DeveloperPitch,
});

function DeveloperPitch() {
  const { slide } = Route.useSearch();
  const navigate = Route.useNavigate();
  const deck = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState((slide ?? 1) - 1);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const touch = useRef<number | null>(null);
  const initial = useRef(false);
  const go = (index: number) => {
    const next = Math.max(0, Math.min(7, index));
    setActive(next);
    void navigate({ search: { slide: next + 1 }, replace: true, resetScroll: false });
    document.getElementById(`pitch-${next + 1}`)?.scrollIntoView({ behavior: 'instant', block: 'start' });
  };
  useEffect(() => {
    if (initial.current) return;
    initial.current = true;
    if (slide) requestAnimationFrame(() => document.getElementById(`pitch-${slide}`)?.scrollIntoView({ block: 'start' }));
  }, [slide]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const next = Number(visible.target.id.replace('pitch-', '')) - 1;
      setActive(next);
      void navigate({ search: { slide: next + 1 }, replace: true, resetScroll: false });
    }, { threshold: [0.5, 0.75], rootMargin: '-65px 0px 0px 0px' });
    deck.current?.querySelectorAll('.pitch-slide-viewport').forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [navigate]);
  useEffect(() => { document.title = `${active + 1}/8 — ${slideTitles[active]} | Maison Affluency`; }, [active]);
  const download = async () => {
    if (!deck.current || exporting) return;
    setExporting(true); setError('');
    try { await exportPitchPdf(deck.current); }
    catch { setError('The pitch could not download. Please try again.'); }
    finally { setExporting(false); }
  };
  return <main className="developer-pitch" onTouchStart={event => { touch.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={event => {
    const end = event.changedTouches[0]?.clientX;
    if (touch.current != null && end != null && Math.abs(end - touch.current) > 65) go(active + (end < touch.current ? 1 : -1));
    touch.current = null;
  }}>
    <nav className="pitch-toolbar" aria-label="Presentation controls"><div><span className="pitch-toolbar-brand">Maison Affluency</span><span className="pitch-toolbar-label">Developer partnerships</span></div><div className="pitch-controls"><Button variant="ghost" size="icon-sm" aria-label="Previous slide" title="Previous slide" disabled={active === 0} onClick={() => go(active - 1)}><ChevronLeft /></Button><span className="pitch-counter">{String(active + 1).padStart(2, '0')} / 08</span><Button variant="ghost" size="icon-sm" aria-label="Next slide" title="Next slide" disabled={active === 7} onClick={() => go(active + 1)}><ChevronRight /></Button></div><Button className="pitch-download" disabled={exporting} onClick={() => void download()}>{exporting ? <Loader2 className="animate-spin" /> : <Download />}{exporting ? 'Preparing PDF…' : 'Download Partnership PDF'}</Button></nav>
    {error && <p role="alert" className="pitch-export-error">{error}</p>}
    <div ref={deck} className="pitch-deck">{slideTitles.map((title, index) => <PitchSlide key={title} index={index} />)}</div>
  </main>;
}