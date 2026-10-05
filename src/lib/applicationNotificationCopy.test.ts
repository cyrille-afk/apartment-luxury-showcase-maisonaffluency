import { describe, expect, it } from 'vitest';
import { createApplicationDraft, parseDraftBody } from '../../supabase/functions/_shared/applicationNotificationCopy';

describe('Application draft copy', () => {
  it('includes all thirteen exact benefits and commission breakdowns', () => {
    const draft = createApplicationDraft('approved', 'Jane Smith', 'Atelier');
    const blocks = parseDraftBody(draft.body);
    expect(blocks.filter(b => b.kind === 'benefit')).toHaveLength(13);
    expect(blocks[0].text).toBe('Dear Jane Smith,');
    expect(blocks[2].kind).toBe('intro');
    expect(draft.body).toContain('Agent commission (EU / Asia default)');
    expect(draft.body).toContain('Net buy (US / CA / MX default)');
  });
  it('preloads the warm decline without approval benefits', () => {
    const draft = createApplicationDraft('rejected', null, 'Atelier');
    expect(draft.body).toContain('strict onboarding limitations');
    expect(draft.body).toContain('on behalf of Atelier');
    expect(draft.body).not.toContain('◆');
  });
});