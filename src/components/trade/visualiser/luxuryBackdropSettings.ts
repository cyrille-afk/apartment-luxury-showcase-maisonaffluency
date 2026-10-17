export const LUXURY_BACKDROP = {
  path: '/assets/luxury-surrounding.jpg',
  size: [96, 54] as [number, number],
  position: [0, 1.8, -30] as [number, number, number],
  maxPolarAngle: Math.PI / 2.1,
  minAzimuthAngle: -Math.PI / 6,
  maxAzimuthAngle: Math.PI / 6,
  contactOpacity: 0.65, contactBlur: 2.4, contactScale: 12,
};
export function backdropUv(width: number, height: number) {
  const ratio = width / height;
  const aspect = 16 / 9;
  const repeat: [number, number] = ratio > aspect ? [aspect / ratio, 1] : [1, ratio / aspect];
  return { repeat, offset: [(1 - repeat[0]) / 2, (1 - repeat[1]) / 2] as [number, number] };
}
export function windowLightPosition(center: [number, number, number]): [number, number, number] {
  return [center[0] - 6, center[1] + 9, center[2] + 4];
}
