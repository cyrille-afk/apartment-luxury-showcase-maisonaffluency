import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import lamp from '@/assets/trade-carousel-lamp.asset.json';
import directory from '@/assets/trade-carousel-directory.asset.json';
import felix from '@/assets/trade-carousel-felix.asset.json';
import comparator from '@/assets/trade-carousel-comparator.asset.json';
import presentation from '@/assets/trade-carousel-presentation.asset.json';
import logo from '@/assets/trade-carousel-logo.asset.json';

const slides = [
  { title: "The World's Best Design Brands. One Unified Trade Account.", image: lamp.url, alt: 'Pierre Bonnefille Bloc Table Lamp', kind: 'lamp', body: '' },
  { title: '300+ Master Designers & Ateliers.', image: directory.url, alt: 'Masters and Contemporary Talents directory', kind: 'directory', body: "Source directly from the world's most distinguished furniture houses and artisan workshops, unified in one network." },
  { title: 'Meet Felix: Your AI Curatorial Assistant.', image: felix.url, alt: 'Good evening, CYRILLE — Felix welcome dashboard', kind: 'screen', body: 'Tell Felix what you are designing. From fabric compatibility to sourcing custom bronze tables, your assistant curates options instantly.' },
  { title: 'Deep Side-by-Side Comparisons.', image: comparator.url, alt: 'Four-piece Product Comparator with complete specification tables', kind: 'screen', body: 'Evaluate custom finishes, dimensions, and global lead times across up to 4 items simultaneously on a single dashboard screen.' },
  { title: 'Client-Safe Viewports.', image: presentation.url, alt: 'Alexander Lamont profile with active Client Editorial Presentation toggle', kind: 'screen', body: 'Switch instantly from internal trade costs to an elegant, retail-ready presentation view with a single tap. Protect your studio margins automatically. 🔒' },
  { title: '', image: logo.url, alt: 'Maison Affluency gold and white A logo', kind: 'end', body: "The Global Trade Program is officially live. Secure your studio's trade access and meet Felix via the link in our bio." },
];

export default function TradeMarketingCarousel() {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      element.scrollTo({ left: 0, behavior: 'instant' });
      setActive(0);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const move = (index: number) => {
    const element = track.current;
    if (!element) return;
    const target = Math.max(0, Math.min(slides.length - 1, index));
    element.scrollTo({ left: target * element.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  return (
    <main className="trade-marketing-stage">
      <section className="trade-marketing-carousel" aria-label="Maison Affluency Trade Program carousel" aria-roledescription="carousel">
        <div ref={track} className="trade-marketing-track" tabIndex={0}
          onScroll={() => { const element = track.current; if (element) setActive(Math.round(element.scrollLeft / element.clientWidth)); }}
          onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(active + (event.key === 'ArrowRight' ? 1 : -1)); } }}>
          {slides.map((slide, index) => (
            <article key={slide.alt} className={`trade-marketing-slide trade-marketing-${slide.kind}`} aria-label={`${index + 1} of ${slides.length}`} aria-roledescription="slide">
              {slide.title && <h1 className="trade-marketing-title">{slide.title}</h1>}
              <figure className="trade-marketing-media"><img src={slide.image} alt={slide.alt} loading={index === 0 ? 'eager' : 'lazy'} draggable={false} />{slide.kind === 'lamp' && <figcaption className="trade-marketing-caption">PIERRE BONNEFILLE — BLOC TABLE LAMP</figcaption>}</figure>
              {slide.body && <div className="trade-marketing-copy"><p className="trade-marketing-body">{slide.body}</p>{slide.kind === 'directory' && <p className="trade-marketing-archive">106 digital archives live today with new collections expanding weekly.</p>}{slide.kind === 'end' && <Button asChild variant="outline" className="trade-marketing-apply"><a href="https://www.maisonaffluency.com/trade-program?intent=apply" target="_blank" rel="noopener">Apply to the Trade Program <ArrowUpRight size={16} /></a></Button>}</div>}
            </article>
          ))}
        </div>
        <nav className="trade-marketing-pagination" aria-label="Carousel slides">
          <Button variant="ghost" size="icon-sm" aria-label="Previous slide" onClick={() => move(active - 1)} disabled={active === 0}><ChevronLeft strokeWidth={1.3} /></Button>
          <div className="trade-marketing-dots">{slides.map((slide, index) => <Button key={slide.alt} variant="ghost" size="icon-sm" aria-label={`Go to slide ${index + 1}`} aria-current={active === index ? 'true' : undefined} onClick={() => move(index)}><span className="trade-marketing-dot" /></Button>)}</div>
          <Button variant="ghost" size="icon-sm" aria-label="Next slide" onClick={() => move(active + 1)} disabled={active === slides.length - 1}><ChevronRight strokeWidth={1.3} /></Button>
        </nav>
      </section>
    </main>
  );
}