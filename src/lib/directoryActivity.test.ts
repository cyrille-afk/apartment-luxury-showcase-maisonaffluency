import { describe, expect, it } from 'vitest';
import { dismissalRate, profileSlug, designerViewRanking, searchOutcomes } from './directoryActivity';
describe('directory activity rules', () => {
  it('counts searched openings once and only their subsequent linked profile views', () => {
    const result = searchOutcomes([
      { modal_id: 'a', occurred_at: '2026-11-02T00:12:00Z' },
      { modal_id: 'a', occurred_at: '2026-11-02T00:12:01Z' },
      { modal_id: 'b', occurred_at: '2026-11-02T00:12:00Z' },
    ], [
      { modal_id: 'a', designer_slug: 'emma', occurred_at: '2026-11-02T00:12:10Z' },
      { modal_id: 'a', designer_slug: 'emma', occurred_at: '2026-11-02T00:12:11Z' },
      { modal_id: null, designer_slug: 'emma', occurred_at: '2026-11-02T00:12:12Z' },
      { modal_id: 'b', designer_slug: 'emma', occurred_at: '2026-11-02T00:11:00Z' },
    ]);
    expect(result.searched).toBe(2);
    expect(result.reached).toBe(1);
    expect(result.rate).toBe(50);
  });
  it('identifies designers and counts each recorded profile view', () => {
    expect(designerViewRanking([
      { designer_slug: 'michel-amar-studio', occurred_at: '2026-11-02T00:00:00Z' },
      { designer_slug: 'emma', occurred_at: '2026-11-01T23:00:00Z' },
      { designer_slug: 'michel-amar-studio', occurred_at: '2026-11-02T00:06:00Z' },
    ], { 'michel-amar-studio': 'Michel Amar Studio', emma: 'Emma Donnersberg' })).toEqual([
      { slug: 'michel-amar-studio', name: 'Michel Amar Studio', views: 2, lastViewed: '2026-11-02T00:06:00Z' },
      { slug: 'emma', name: 'Emma Donnersberg', views: 1, lastViewed: '2026-11-01T23:00:00Z' },
    ]);
  });
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