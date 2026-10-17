import { describe, expect, it } from 'vitest';
import { uploadedEnvironmentPresentation } from './uploadedEnvironmentPresentation';

describe('uploaded EXR surroundings', () => {
  it('lights the scene without a panoramic background (flat backdrop shows the picture)', () => {
    expect(uploadedEnvironmentPresentation(true, false)).toEqual({ background: false, blur: 0 });
  });
  it('keeps the uploaded backdrop unblurred in Photoreal', () => {
    expect(uploadedEnvironmentPresentation(true, true)).toEqual({ background: false, blur: 0.85 });
  });
  it('keeps ordinary live lighting reflection-only', () => {
    expect(uploadedEnvironmentPresentation(false, false).background).toBe(false);
  });
});
