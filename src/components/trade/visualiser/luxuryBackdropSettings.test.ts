import { describe, expect, it } from 'vitest';
import { backdropFit, LUXURY_BACKDROP, windowLightPosition } from './luxuryBackdropSettings';
describe('luxury photo staging', () => {
  it('limits orbit to thirty degrees each way', () => {
    expect(LUXURY_BACKDROP.minAzimuthAngle).toBe(-Math.PI / 6);
    expect(LUXURY_BACKDROP.maxAzimuthAngle).toBe(Math.PI / 6);
  });
  it('prevents looking under the floor', () => expect(LUXURY_BACKDROP.maxPolarAngle).toBe(Math.PI / 2.1));
  it('uses requested shadow values', () => expect([LUXURY_BACKDROP.contactOpacity, LUXURY_BACKDROP.contactBlur, LUXURY_BACKDROP.contactScale]).toEqual([0.65, 2.4, 12]));
  it('preserves the entire photo on a widescreen view', () => {
    expect(backdropFit(1200, 900, 1600, 900)).toEqual([1200, 900]);
    expect(backdropFit(1600, 900, 900, 900)).toEqual([900, 506.25]);
  });
  it('places window daylight relative to furniture', () => expect(windowLightPosition([2, 0, 3])).toEqual([-4, 9, 7]));
});
