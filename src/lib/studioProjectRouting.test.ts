import { expect, it } from 'vitest';
import { studioProjectId, studioProjectHref } from './studioProjectRouting';
it('opens the active accessible project before a recent project', () => { expect(studioProjectId(['active','recent'], 'active', ['recent'])).toBe('active'); });
it('opens the latest accessible recent project and skips inaccessible folders', () => { expect(studioProjectId(['recent','older'], 'hidden', ['hidden','recent','older'])).toBe('recent'); });
it('requires project selection instead of opening an arbitrary project', () => { expect(studioProjectId(['other'], null, [])).toBeNull(); expect(studioProjectHref(null)).toBe('/trade/project-studio'); });
it('routes the chosen project into its Studio', () => { expect(studioProjectHref('active')).toBe('/trade/projects/active/studio'); });