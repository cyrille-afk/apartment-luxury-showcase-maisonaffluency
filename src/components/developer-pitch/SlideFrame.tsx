import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PITCH_WIDTH, PITCH_HEIGHT } from './exportPitch';

export function SlideFrame({ children, index, title }: { children: ReactNode; index: number; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(Math.min(entry.contentRect.width / PITCH_WIDTH, entry.contentRect.height / PITCH_HEIGHT));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <section ref={ref} className="pitch-slide-viewport" id={`pitch-${index + 1}`} aria-label={`Slide ${index + 1}: ${title}`}>
    <article className="pitch-slide" style={{ transform: `scale(${scale})` }}>{children}</article>
  </section>;
}