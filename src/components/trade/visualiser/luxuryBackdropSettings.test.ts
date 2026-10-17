import { describe, expect, it } from 'vitest';
import { backdropUv, LUXURY_BACKDROP, windowLightPosition } from './luxuryBackdropSettings';
describe('luxury photo staging', () => {
  it('limits orbit to thirty degrees each way', () => {
    expect(LUXURY_BACKDROP.minAzimuthAngle).toBe(-Math.PI / 6);
    expect(LUXURY_BACKDROP.maxAzimuthAngle).toBe(Math.PI / 6);
  });
  it('prevents looking under the floor', () => expect(LUXURY_BACKDROP.maxPolarAngle).toBe(Math.PI / 2.1));
  it('uses requested shadow values', () => expect([LUXURY_BACKDROP.contactOpacity, LUXURY_BACKDROP.contactBlur, LUXURY_BACKDROP.contactScale]).toEqual([0.65, 2.4, 12]));
  it('crops instead of stretching on a widescreen plane', () => {
    expect(LUXURY_BACKDROP.size[0] / LUXURY_BACKDROP.size[1]).toBe(16 / 9);
    expect(backdropUv(1200, 900)).toEqual({ repeat: [1, 0.75], offset: [0, 0.125] });
  });
  it('places window daylight relative to furniture', () => expect(windowLightPosition([2, 0, 3])).toEqual([-4, 9, 7]));
});
