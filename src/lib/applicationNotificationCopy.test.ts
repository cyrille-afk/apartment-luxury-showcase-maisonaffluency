import { describe, expect, it } from 'vitest';
import { createApplicationDraft, isNorthAmerica, parseDraftBody, payoutsBenefit } from '../../supabase/functions/_shared/applicationNotificationCopy';

describe('Application draft copy', () => {
  it('includes all thirteen exact benefits with the condensed payouts block by default', () => {
    const draft = createApplicationDraft('approved', 'Jane Smith', 'Atelier');
    const blocks = parseDraftBody(draft.body);
    expect(blocks.filter(b => b.kind === 'benefit')).toHaveLength(13);
    expect(blocks[0].text).toBe('Dear Jane Smith,');
    expect(blocks[2].kind).toBe('intro');
    expect(draft.body).toContain('Trade Payouts & Billing Flex');
    expect(draft.body).toContain('defaults to our Agent Commission model');
    expect(draft.body).not.toContain('US / CA / MX');
    expect(draft.body).not.toContain('Resale certificates');
  });
  it('preloads the warm decline without approval benefits', () => {
    const draft = createApplicationDraft('rejected', null, 'Atelier');
    expect(draft.body).toContain('strict onboarding limitations');
    expect(draft.body).toContain('on behalf of Atelier');
    expect(draft.body).not.toContain('◆');
  });
});

describe('Country-aware Trade Payouts block', () => {
  it('treats only US, CA and MX (any casing, trimmed) as North America', () => {
    expect(isNorthAmerica('US')).toBe(true);
    expect(isNorthAmerica(' ca ')).toBe(true);
    expect(isNorthAmerica('mx')).toBe(true);
    expect(isNorthAmerica('SG')).toBe(false);
    expect(isNorthAmerica('United States')).toBe(false);
    expect(isNorthAmerica(null)).toBe(false);
    expect(isNorthAmerica(undefined)).toBe(false);
  });
  it('renders the condensed agent-commission copy for Singapore and rest of world', () => {
    for (const country of ['SG', 'France', null, undefined]) {
      const benefit = payoutsBenefit(country);
      expect(benefit.title).toBe('Trade Payouts & Billing Flex');
      expect(benefit.details).toHaveLength(0);
      expect(benefit.description).toContain('Agent Commission model');
      expect(benefit.description).toContain('Stripe Connect');
      expect(benefit.description).not.toContain('resale certificate');
    }
    const draft = createApplicationDraft('approved', 'Jane Smith', 'Atelier', 'SG');
    expect(draft.body).toContain('Trade Payouts & Billing Flex');
    expect(draft.body).not.toContain('Resale certificates');
  });
  it('keeps the full net-buy and resale-certificate rules for US, CA and MX only', () => {
    for (const country of ['US', 'CA', 'MX']) {
      const benefit = payoutsBenefit(country);
      expect(benefit.title).toBe('Trade payouts');
      expect(benefit.details.length).toBe(6);
      expect(benefit.details.join(' ')).toContain('Resale certificates');
      const draft = createApplicationDraft('approved', 'Jane Smith', 'Atelier', country);
      expect(draft.body).toContain('Net buy (US / CA / MX default)');
      expect(draft.body).toContain('Resale certificates');
    }
  });
});
