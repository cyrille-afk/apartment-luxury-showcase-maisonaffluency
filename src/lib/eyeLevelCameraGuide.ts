import type { EyeLevelCamera } from "../../supabase/functions/_shared/eyeLevelCamera";

export function cameraGuideGeometry(camera: EyeLevelCamera, width: number, height: number) {
  const position = { x: camera.position.x * width / 100, y: camera.position.y * height / 100 };
  const target = { x: camera.target.x * width / 100, y: camera.target.y * height / 100 };
  const angle = Math.atan2(target.y - position.y, target.x - position.x);
  const size = Math.max(12, Math.min(width, height) * 0.025);
  return { position, target, size, left: { x: target.x - size * Math.cos(angle - Math.PI / 6), y: target.y - size * Math.sin(angle - Math.PI / 6) }, right: { x: target.x - size * Math.cos(angle + Math.PI / 6), y: target.y - size * Math.sin(angle + Math.PI / 6) } };
}

export function drawCameraGuide(ctx: CanvasRenderingContext2D, camera: EyeLevelCamera, width: number, height: number) {
  const { position, target, size, left, right } = cameraGuideGeometry(camera, width, height);
  const theme = getComputedStyle(document.documentElement);
  ctx.save();
  const color = (name: string) => { const value = theme.getPropertyValue(name).trim(); return CSS.supports("color", value) ? value : `hsl(${value})`; };
  ctx.strokeStyle = color("--primary");
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = Math.max(3, size / 5);
  ctx.beginPath(); ctx.moveTo(position.x, position.y); ctx.lineTo(target.x, target.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(target.x, target.y); ctx.lineTo(left.x, left.y); ctx.lineTo(right.x, right.y); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(position.x, position.y, size / 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color("--background"); ctx.stroke();
  ctx.restore();
}