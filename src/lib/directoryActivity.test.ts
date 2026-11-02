import { describe, expect, it } from 'vitest';
import { dismissalRate, profileSlug, designerViewRanking, searchOutcomes, refinementOutcomes, type DirectoryRefinement } from './directoryActivity';
const edit = (modal_id: string, refinement: string, seconds: number): DirectoryRefinement => ({ modal_id, occurred_at: `2026-11-02T00:12:${String(seconds).padStart(2,'0')}Z`, search_details: { refinement, match_kind: 'partial_designer', matched_designers: ['emma'], result_count: 1 } });
describe('directory activity rules', () => {
  it('connects refinements to named committed profile opens, not unrelated views', () => {
    const result = refinementOutcomes([edit('a','initial',0), edit('a','extend',1), edit('b','initial',0), edit('b','replace',2)], [{ modal_id:'a', designer_slug:'emma', occurred_at:'2026-11-02T00:12:10Z' }, { modal_id:null, designer_slug:'emma', occurred_at:'2026-11-02T00:12:11Z' }], { emma:'Emma Donnersberg' });
    expect(result.refined).toBe(2); expect(result.reached).toBe(1); expect(result.rate).toBe(50);
    expect(result.journeys.find(j => j.id === 'a')?.designer).toBe('Emma Donnersberg');
  });
  it('does not attribute profiles after a cleared search or A–Z switch', () => {
    for (const reset of ['clear','letter']) expect(refinementOutcomes([edit('a','extend',0),edit('a',reset,1)], [{ modal_id:'a',designer_slug:'emma',occurred_at:'2026-11-02T00:12:10Z' }],{}).reached).toBe(0);
  });
  it('ignores refinements after the first profile and duplicate views', () => {
    const result = refinementOutcomes([edit('a','initial',0),edit('a','extend',1),edit('a','replace',20)], [10,11].map(n => ({ modal_id:'a',designer_slug:'emma',occurred_at:`2026-11-02T00:12:${n}Z` })),{});
    expect(result.reached).toBe(1); expect(result.journeys[0]?.steps).toHaveLength(2);
  });
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