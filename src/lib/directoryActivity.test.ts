import { describe, expect, it } from 'vitest';
import { dismissalRate, profileSlug } from './directoryActivity';
describe('directory activity rules', () => {
  it('measures dismissed openings rather than search edits', () => {
    expect(dismissalRate(4, 3)).toBe(75);
    expect(dismissalRate(0, 0)).toBeNull();
  });
  it('counts only profile paths on public and Trade', () => {
    expect(profileSlug('/designers/michel-amar-studio')).toBe('michel-amar-studio');
    expect(profileSlug('/trade/gallery/michel-amar-studio')).toBe('michel-amar-studio');
    expect(profileSlug('/designers/michel-amar-studio/jules-lamp')).toBeNull();
    expect(profileSlug('/designers')).toBeNull();
  });
});