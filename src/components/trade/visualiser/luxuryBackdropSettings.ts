export const LUXURY_BACKDROP = {
  path: '/assets/luxury-surrounding.jpg',
  distance: 50,
  cameraPosition: [0, 4.2, 9] as [number, number, number],
  cameraTarget: [0, 1.8, 0] as [number, number, number],
  minPolarAngle: Math.PI / 3,
  maxPolarAngle: Math.PI / 2.1,
  minAzimuthAngle: -Math.PI / 6,
  maxAzimuthAngle: Math.PI / 6,
  contactOpacity: 0.65, contactBlur: 2.4, contactScale: 12,
};
export function backdropFit(width: number, height: number, viewWidth: number, viewHeight: number): [number, number] {
  const scale = Math.min(viewWidth / width, viewHeight / height);
  return [width * scale, height * scale];
}
export function windowLightPosition(center: [number, number, number]): [number, number, number] {
  return [center[0] - 6, center[1] + 9, center[2] + 4];
}
