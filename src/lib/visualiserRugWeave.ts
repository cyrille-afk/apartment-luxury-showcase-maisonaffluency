import type { RugWeave } from './visualiserRoomSurfaces';

/** Only loop pile uses the photographic pile fibres; woven finishes own their albedo and relief. */
export function usesPilePhotograph(weave: RugWeave): boolean {
  return weave === 'loop';
}

/** Alternating diagonal twill courses with fine yarn channels, not rounded pile tufts. */
export function berberWeaveHeight(x: number, y: number): number {
  const band = Math.floor(x / 96);
  const local = x % 96;
  const diagonal = band % 2 ? local : 96 - local;
  const course = ((y + diagonal) % 24 + 24) % 24;
  const rib = Math.pow(Math.sin(Math.PI * course / 24), 0.65);
  const yarn = Math.sin(Math.PI * ((x + y) % 4) / 4) * 0.04;
  return 0.15 + rib * 0.65 + yarn;
}