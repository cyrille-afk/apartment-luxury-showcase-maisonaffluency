export const EYE_LEVEL_ASPECTS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] as const;

/** Fit the complete source in a supported canvas; never crop or stretch room pixels. */
export function eyeLevelFrame(width: number, height: number) {
  if (![width, height].every(n => Number.isInteger(n) && n > 0)) throw new Error("Invalid room image dimensions.");
  const ratio = width / height;
  const aspect = EYE_LEVEL_ASPECTS.reduce((best, next) => {
    const value = (label: string) => { const [w, h] = label.split(":").map(Number); return (w ?? 1) / (h ?? 1); };
    return Math.abs(Math.log(value(next) / ratio)) < Math.abs(Math.log(value(best) / ratio)) ? next : best;
  });
  const [w = 1, h = 1] = aspect.split(":").map(Number);
  const unit = Math.ceil(Math.max(width / w, height / h));
  const canvasWidth = unit * w, canvasHeight = unit * h;
  return { width, height, canvasWidth, canvasHeight, x: Math.floor((canvasWidth - width) / 2), y: Math.floor((canvasHeight - height) / 2), aspect };
}

export function eyeLevelOutputBounds(frame: ReturnType<typeof eyeLevelFrame>, width: number, height: number) {
  if (Math.abs((width / height) / (frame.canvasWidth / frame.canvasHeight) - 1) > 0.015) {
    throw new Error("The generated view changed the room framing and was not applied. Your shell and furniture are unchanged.");
  }
  return { x: Math.round(frame.x * width / frame.canvasWidth), y: Math.round(frame.y * height / frame.canvasHeight), width: Math.round(frame.width * width / frame.canvasWidth), height: Math.round(frame.height * height / frame.canvasHeight) };
}

/** A room-only ceiling/header strip cannot legitimately change during furniture staging. */
export function requireStableRoomFrame(source: ArrayLike<number>, output: ArrayLike<number>) {
  if (!source.length || source.length !== output.length) throw new Error("Room framing could not be verified.");
  let deviation = 0;
  for (let i = 0; i < source.length; i++) deviation += Math.abs((source[i] ?? 0) - (output[i] ?? 0)) / 255;
  if (deviation / source.length > 0.08) throw new Error("The AI changed the room framing, so this render was not applied. Your original room and furniture remain unchanged.");
}