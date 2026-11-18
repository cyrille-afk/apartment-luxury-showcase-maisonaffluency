import { expect, it } from 'vitest';
import { studioProjectId, studioProjectHref, studioTabPreference, switchedStudioHref } from './studioProjectRouting';
it('opens the active accessible project before a recent project', () => { expect(studioProjectId(['active','recent'], 'active', ['recent'])).toBe('active'); });
it('opens the latest accessible recent project and skips inaccessible folders', () => { expect(studioProjectId(['recent','older'], 'hidden', ['hidden','recent','older'])).toBe('recent'); });
it('requires project selection instead of opening an arbitrary project', () => { expect(studioProjectId(['other'], null, [])).toBeNull(); expect(studioProjectHref(null)).toBe('/trade/project-studio'); });
it('routes the chosen project into its Studio', () => { expect(studioProjectHref('active')).toBe('/trade/projects/active/studio'); });
it('keeps remembered Admin when another project opens without an explicit tab', () => { expect(studioTabPreference(null, 'admin')).toBe('admin'); });
it('honors explicitly choosing the canvas over remembered Admin', () => { expect(studioTabPreference('canvas', 'admin')).toBe('canvas'); });
it('switches to the new project with Admin but never transfers the old board', () => { expect(switchedStudioHref('next', 'admin')).toBe('/trade/projects/next/studio?project=next&tab=admin'); });