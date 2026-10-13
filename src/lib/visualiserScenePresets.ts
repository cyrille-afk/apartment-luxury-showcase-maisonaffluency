import type { PlacedObject } from "@/components/trade/visualiser/SceneObject";
import type { RoomFloorFinish, RoomWallColor, RoomWallFinish } from "@/lib/visualiserRoomSurfaces";

export type ScenePresetData = {
  objects: PlacedObject[];
  spacing?: number;
  snapToGrid?: boolean;
  showGrid?: boolean;
  /** Labels/badges visibility state saved with the preset. */
  showLabels?: boolean;
  depthOfField?: boolean;
  /** Background blur strength (bokeh scale), 1–10. */
  dofStrength?: number;
  /** DoF focus mode: true = clicked piece stays sharp, false = view centre. */
  dofFocusSelected?: boolean;
  /** Which HDRI the environment loads: empty-room EXR or built-in studio HDRI. */
  environmentSource?: "empty-room-exr" | "studio-hdr";
  floorFinish?: RoomFloorFinish;
  showRearWall?: boolean;
  /** Wall height percentage of the full cyclorama (20–100). */
  wallHeight?: number;
  /** Floor reflection strength, 0 (matte) – 100 (polished). */
  floorGlare?: number;
  /** Plaster wall colour preset key. */
  wallColor?: RoomWallColor;
  /** Plaster wall finish preset key. */
  wallFinish?: RoomWallFinish;
  /** Hex value used when wallColor is "custom". */
  wallCustomHex?: string | null;
  /** How strongly the plaster finish catches light, 0–100 (100 = the finish as designed). */
  wallFinishIntensity?: number;
  /** Uploaded room-photo backdrop (data URL, downscaled for storage). */
  backdropDataUrl?: string | null;
};
export type ScenePreset = { id: string; name: string; savedAt: string; data: ScenePresetData; thumbnail?: string };

const KEY = "trade-visualiser-scene-presets-v1";

export const readScenePresets = (): ScenePreset[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
};

const write = (list: ScenePreset[]): ScenePreset[] | null => {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return list; } catch { return null; }
};

/** Saving under an existing name (case-insensitive) overwrites that preset. Returns null if storage is full. */
export const saveScenePreset = (name: string, data: ScenePresetData, thumbnail?: string): ScenePreset[] | null => {
  const clean = name.trim();
  const list = readScenePresets();
  const existing = list.find((p) => p.name.toLowerCase() === clean.toLowerCase());
  const preset: ScenePreset = {
    id: existing?.id ?? crypto.randomUUID(),
    name: clean,
    savedAt: new Date().toISOString(),
    data: JSON.parse(JSON.stringify(data)),
    ...(thumbnail ? { thumbnail } : {}),
  };
  return write([preset, ...list.filter((p) => p.id !== preset.id)]);
};

export const deleteScenePreset = (id: string) => write(readScenePresets().filter((p) => p.id !== id)) ?? readScenePresets();

const loadImg = (src: string) => new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
const drawCover = (ctx: CanvasRenderingContext2D, img: CanvasImageSource, iw: number, ih: number, w: number, h: number) => {
  const s = Math.max(w / iw, h / ih); ctx.drawImage(img, (w - iw * s) / 2, (h - ih * s) / 2, iw * s, ih * s);
};
/** Small JPEG of the room photo + current 3D canvas, for preset list thumbnails. */
export const makePresetThumbnail = async (backdrop?: string | null, w = 240, h = 150): Promise<string | undefined> => {
  try {
    const out = document.createElement("canvas"); out.width = w; out.height = h;
    const ctx = out.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#f4f1ec"; ctx.fillRect(0, 0, w, h);
    if (backdrop) { const b = await loadImg(backdrop); if (b) drawCover(ctx, b, b.naturalWidth, b.naturalHeight, w, h); }
    const gl = document.querySelector("canvas");
    if (gl && gl.width) drawCover(ctx, gl, gl.width, gl.height, w, h);
    return out.toDataURL("image/jpeg", 0.7);
  } catch { return undefined; }
};
