import { createNoise2D } from 'simplex-noise';
export const TRAVERTINE_TEXTURE_SIZE = 1024;
export const OAK_BOARD_WIDTH_M = 0.12;
export const OAK_TILE_SIZE_M = OAK_BOARD_WIDTH_M * Math.SQRT2 * 6;
export const OAK_ROUGHNESS = 0.68;
export const WALL_ROUGHNESS = 0.92;
let seed = 724;
const noise = createNoise2D(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; });
const fract = (v: number) => v - Math.floor(v);
const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** Layered simplex strata are stretched along the stone cut, never periodic sine bands. */
export function travertineSample(u: number, v: number) {
  const strata = noise(u * 2, v * 24) * .48 + noise(u * 5, v * 65) * .24 + noise(u * 14, v * 150) * .1;
  const cloud = noise(u * 6, v * 8) * .14;
  const poreNoise = noise(u * 370, v * 520);
  const pores = Math.max(0, poreNoise - .56) * 1.7;
  const tone = clamp(.5 + strata + cloud);
  return { rgb: [216 + 18 * tone - pores * 35, 206 + 21 * tone - pores * 34, 190 + 23 * tone - pores * 30], height: 128 + strata * 12 - pores * 100 };
}
/** Mirrored 45° courses meet at V tips; grain runs along each board, not across it. */
export function oakChevronSample(u: number, v: number) {
  const column = Math.floor(u * 2), local = fract(u * 2) / 2;
  const side = column % 2 === 0 ? 1 : -1;
  const x = side === 1 ? local : .5 - local;
  const across = (v - x) * 6;
  const course = Math.floor(across);
  const along = v + x;
  const edge = Math.min(fract(across), 1 - fract(across));
  const tipEdge = Math.min(fract(u * 2), 1 - fract(u * 2));
  const bevel = edge < .014 || tipEdge < .008;
  const tone = fract(Math.sin(column * 17.13 + course * 43.27) * 8173.2);
  const grain = noise(along * 7, across * 120) * 2.1 + noise(along * 22, across * 380) * .8;
  return { rgb: [181 + 19 * tone + grain, 146 + 23 * tone + grain, 107 + 27 * tone + grain].map(c => c - (bevel ? 32 : 0)), height: bevel ? 98 : 128 + grain * 1.2 };
}
