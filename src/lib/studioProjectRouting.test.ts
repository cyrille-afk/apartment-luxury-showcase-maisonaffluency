import { expect, it } from 'vitest';
import { studioProjectId, studioProjectHref, studioTabPreference, switchedStudioHref, resolvedProjectId, projectSwitchesAway } from './studioProjectRouting';
it('opens the active accessible project before a recent project', () => { expect(studioProjectId(['active','recent'], 'active', ['recent'])).toBe('active'); });
it('opens the latest accessible recent project and skips inaccessible folders', () => { expect(studioProjectId(['recent','older'], 'hidden', ['hidden','recent','older'])).toBe('recent'); });
it('requires project selection instead of opening an arbitrary project', () => { expect(studioProjectId(['other'], null, [])).toBeNull(); expect(studioProjectHref(null)).toBe('/trade/project-studio'); });
it('routes the chosen project into its Studio', () => { expect(studioProjectHref('active')).toBe('/trade/projects/active/studio'); });
it('keeps remembered Admin when another project opens without an explicit tab', () => { expect(studioTabPreference(null, 'admin')).toBe('admin'); });
it('honors explicitly choosing the canvas over remembered Admin', () => { expect(studioTabPreference('canvas', 'admin')).toBe('canvas'); });
it('switches to the new project with Admin but never transfers the old board', () => { expect(switchedStudioHref('next', 'admin')).toBe('/trade/projects/next/studio?project=next&tab=admin'); });
it('reads the project from the path before the filter parameter', () => {
  expect(resolvedProjectId('/trade/projects/p2/studio', { project: 'p1' })).toBe('p2');
  expect(resolvedProjectId('/trade/boards/b1', { project: 'p1' })).toBe('p1');
  expect(resolvedProjectId('/trade/mood-board', {})).toBeNull();
  expect(resolvedProjectId('/trade/projects/p2%20x', undefined)).toBe('p2 x');
});
it('warns only when the destination opens a different project', () => {
  expect(projectSwitchesAway('p1', { pathname: '/trade/projects/p2/studio', search: {} })).toBe(true);
  expect(projectSwitchesAway('p1', { pathname: '/trade/boards/b1', search: { project: 'p2' } })).toBe(true);
  expect(projectSwitchesAway('p1', { pathname: '/trade/projects/p1/studio', search: { project: 'p1', tab: 'canvas' } })).toBe(false);
  expect(projectSwitchesAway('p1', { pathname: '/trade/visualiser', search: { project: 'p1' } })).toBe(false);
  expect(projectSwitchesAway('p1', { pathname: '/trade/mood-board', search: {} })).toBe(false);
});