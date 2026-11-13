import * as THREE from 'three';
import { FEATURE_WALL_FINISHES, type FeatureWallFinish } from './visualiserFeatureWall';
export const SURFACE_TEXTURE_SIZE = 2048;
export type ProceduralSurface = FeatureWallFinish | 'oak-chevron' | 'micro-cement';
const canvasCache = new Map<ProceduralSurface, HTMLCanvasElement[]>();
/** Seamless, deterministic metre-scale PBR surfaces, without network dependencies. */
export function createProceduralSurface(finish: ProceduralSurface) {
  const size = SURFACE_TEXTURE_SIZE;
  const cached = canvasCache.get(finish);
  const canvases = cached ?? Array.from({ length: 3 }, () => { const c = document.createElement('canvas'); c.width = c.height = size; return c; });
  const contexts = canvases.map(c => c.getContext('2d'));
  if (contexts.some(c => !c)) throw new Error('Surface canvas unavailable');
  const images = contexts.map(c => c?.createImageData(size, size));
  const wood = finish === 'oak-chevron' || finish === 'dark-walnut';
  const base = new THREE.Color(finish === 'oak-chevron' ? '#bf9562' : finish === 'dark-walnut' ? '#50382a' : finish === 'travertine' ? '#ded0b6' : finish === 'raw-concrete' ? '#aaa9a4' : finish === 'warm-white' ? '#f4efe7' : finish === 'limewash' ? '#e2dfd1' : '#d4cec3');
  // Canvas pixels are sRGB, unlike Three's linear working colour.
  base.convertLinearToSRGB();
  if (!cached) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const hash = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    const noise = hash - Math.floor(hash) - .5;
    let relief = noise * .08, shade = noise * .028;
    if (wood) {
      const column = Math.floor(u * 8), side = column % 2 ? -1 : 1;
      const along = finish === 'oak-chevron' ? v * 8 + side * (u * 8 % 1) : v * 8;
      const seam = (u * 8 % 1) < .008 || (finish === 'oak-chevron' && (along - Math.floor(along)) < .012);
      const grain = Math.sin((u * 256 + Math.sin(v * Math.PI * 8) * .6) * Math.PI * 2);
      shade += grain * .032 + Math.sin(column * 19 + (finish === 'oak-chevron' ? Math.floor(along) * 7 : 0)) * .05;
      relief += grain * .12;
      if (seam) { shade -= .19; relief -= .45; }
    } else if (finish === 'travertine') {
      const vein = Math.sin(v * Math.PI * 36 + Math.sin(u * Math.PI * 4) * .65);
      const pore = noise > .477 ? -.28 : 0;
      shade += vein * .035 + pore; relief += vein * .10 + pore;
    } else {
      const cloud = Math.sin(u * Math.PI * 6) * Math.cos(v * Math.PI * 4) + Math.sin((u + v) * Math.PI * 10) * .3;
      shade += cloud * (finish === 'warm-white' ? .004 : .018);
      relief += cloud * .06;
      if (finish === 'raw-concrete' && noise > .47) { shade -= .08; relief -= .2; }
    }
    const idx = (y * size + x) * 4;
    const colour = images[0], bump = images[1], rough = images[2];
    if (colour && bump && rough) {
      colour.data[idx] = (base.r + shade) * 255;
      colour.data[idx + 1] = (base.g + shade) * 255;
      colour.data[idx + 2] = (base.b + shade) * 255;
      colour.data[idx + 3] = 255;
      const height = 128 + relief * 180, grit = (wood ? 190 : 235) + noise * 20;
      for (let ch = 0; ch < 3; ch++) { bump.data[idx + ch] = height; rough.data[idx + ch] = grit; }
      bump.data[idx + 3] = rough.data[idx + 3] = 255;
    }
  }
  const textures = canvases.map((canvas, i) => {
    const ctx = contexts[i], image = images[i]; if (!cached && ctx && image) ctx.putImageData(image, 0, 0);
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = i === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
  });
  if (!cached) { canvasCache.set(finish, canvases); if (canvasCache.size > 2) { const oldest = canvasCache.keys().next().value; if (oldest) canvasCache.delete(oldest); } }
  const [color, bump, roughness] = textures;
  return { color, bump, roughness, surface: finish in FEATURE_WALL_FINISHES ? FEATURE_WALL_FINISHES[finish as FeatureWallFinish] : undefined };
}
