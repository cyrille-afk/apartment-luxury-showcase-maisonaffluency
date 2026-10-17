import { describe, expect, it } from 'vitest';
import { uploadedEnvironmentPresentation } from './uploadedEnvironmentPresentation';

describe('uploaded EXR surroundings', () => {
  it('shows uploaded interiors with Photoreal off', () => {
    expect(uploadedEnvironmentPresentation(true, false)).toEqual({ background: true, blur: 0 });
  });
  it('does not blur uploaded interiors in Photoreal', () => {
    expect(uploadedEnvironmentPresentation(true, true)).toEqual({ background: true, blur: 0 });
  });
  it('keeps ordinary live lighting reflection-only', () => {
    expect(uploadedEnvironmentPresentation(false, false).background).toBe(false);
  });
});