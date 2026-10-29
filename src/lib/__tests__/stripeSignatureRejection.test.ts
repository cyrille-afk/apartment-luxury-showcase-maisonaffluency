import { describe, expect, it } from 'vitest';
import Stripe from 'stripe';
import { isExpectedSmokeRejection } from '../../../supabase/functions/_shared/stripeSignatureRejection';

const stripe = new Stripe('test_fixture_not_a_credential');
const testSecret = 'test_signing_fixture_not_a_credential';
const smoke = { id: 'evt_smoke_123', type: 'invoice.paid', livemode: false,
  data: { object: { id: 'in_smoke_123', metadata: { smoke: 'api-providers.spec' } } } };
const verify = async (body: string, header: string) => stripe.webhooks.constructEvent(body, header, testSecret);
const accepted = async () => true;
function corrupted(body: string, secret = testSecret, timestamp = Math.floor(Date.now() / 1000)) {
  return stripe.webhooks.generateTestHeaderString({ payload: body, secret, timestamp }) + '0';
}

describe('Stripe deliberately corrupted daily test exclusion', () => {
  it('excludes the exact daily corrupted test only after verification and a saved receipt', async () => {
    const body = JSON.stringify(smoke);
    expect(await isExpectedSmokeRejection(body, corrupted(body), verify, accepted)).toBe(true);
  });
  it('does not exclude a forged smoke marker signed with another secret', async () => {
    const body = JSON.stringify(smoke);
    expect(await isExpectedSmokeRejection(body, corrupted(body, 'wrong_test_fixture'), verify, accepted)).toBe(false);
  });
  it('does not exclude expired test signatures', async () => {
    const body = JSON.stringify(smoke);
    expect(await isExpectedSmokeRejection(body, corrupted(body, testSecret, 1000), verify, accepted)).toBe(false);
  });
  it('does not exclude a test without the accepted original receipt', async () => {
    const body = JSON.stringify(smoke);
    expect(await isExpectedSmokeRejection(body, corrupted(body), verify, async () => false)).toBe(false);
  });
  it('does not exclude live notices, even if signed and labelled as smoke tests', async () => {
    const body = JSON.stringify({ ...smoke, livemode: true });
    expect(await isExpectedSmokeRejection(body, corrupted(body), verify, accepted)).toBe(false);
  });
  it('does not exclude unrelated signed test events', async () => {
    const body = JSON.stringify({ ...smoke, type: 'payment_intent.succeeded' });
    expect(await isExpectedSmokeRejection(body, corrupted(body), verify, accepted)).toBe(false);
  });
  it('does not exclude any other corruption pattern', async () => {
    const body = JSON.stringify(smoke);
    expect(await isExpectedSmokeRejection(body, corrupted(body) + '0', verify, accepted)).toBe(false);
  });
  it('fails closed when the receipt check fails', async () => {
    const body = JSON.stringify(smoke);
    expect(await isExpectedSmokeRejection(body, corrupted(body), verify, async () => { throw new Error('read failed'); })).toBe(false);
  });
});