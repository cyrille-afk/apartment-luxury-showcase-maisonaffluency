import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const pickId = '22e6e148-3490-48e5-9972-27b06cfee873';
const rule = {
  id: 'adaee0d1-ede9-4c49-9f86-db1f132cee0f', source_category: 'ceiling', target_category: 'tables',
  preferred_pick_id: pickId, sort_order: 1, enabled: true, finish_currency: 'USD',
  finish_options: [
    { id: 'ivory-brass', name: 'Ivory Lacquer / Aged Brass', price_cents: 870000 },
    { id: 'silver-marble', name: 'Silver / Marble', price_cents: 990000 },
  ],
};

test('custom-finish Curated Pairing survives the product drawer and passes server price verification', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 1800 });
  // Real UI/cart/router flow; isolated rule data, production verifier in Deno.
  // Never forward a payment request to the live backend or Stripe.
  await page.route('**/rest/v1/curated_pairing_rules?*', async route => {
    await route.fulfill({ json: [
      { ...rule, id: '6bd705a6-b3f4-46d5-8ed2-161b7619c8ef', target_category: 'wall', sort_order: 0, preferred_pick_id: null, finish_options: [] },
      rule,
      { ...rule, id: 'c113ceae-ea80-4fb7-9eb0-7c88f0a6db9e', target_category: 'decor', sort_order: 2, preferred_pick_id: null, finish_options: [] },
    ] });
  });
  await page.route('**/functions/v1/stripe-config', route => route.fulfill({ json: {} }));
  await page.route('https://api.stripe.com/**', route => route.abort());
  let verified: any;
  let submitted: any;
  await page.route('**/functions/v1/create-payment-intent', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200 });
    submitted = route.request().postDataJSON();
    // Original piece retains its selected RRP. The console's ordinary price
    // deliberately differs by >3% from the custom finish's admin-set price.
    const products = submitted.items.map((line: any) => ({
      id: line.pickId, source_pick_id: line.pickId, is_active: true, public_rrp_visible: true,
      currency: submitted.currency, rrp_price_cents: line.pickId === pickId ? 5700000 : Math.round(line.price * 100),
    }));
    verified = JSON.parse(execFileSync('deno', ['run', '--allow-read', '--config', 'tests/harness/deno.json', 'tests/harness/pairing-checkout.harness.ts'], {
      input: JSON.stringify({ body: submitted, products, rule }), encoding: 'utf8', timeout: 30_000,
    }).trim().split('\n').pop() || '{}');
    if (!verified.accepted.ok) return route.fulfill({ status: verified.accepted.status, json: verified.accepted });
    // A deliberate provider boundary, not a fake successful price assertion.
    await route.fulfill({ status: 503, json: { error: 'E2E: prices verified; payment provider intentionally blocked' } });
  });
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.setItem('ma_intake_done', '1');
    sessionStorage.setItem('ma_checkout_form', JSON.stringify({ buyerProfile: 'private', projectCity: 'New York', email: 'client@example.com' }));
    localStorage.setItem('trade.detectedCountry', 'US');
    localStorage.setItem('trade.displayCurrency', 'USD');
    localStorage.setItem('trade.shippingDestination.manual', '1');
  });
  await page.goto('/designers/apparatus-studio/tassel-57-pendant');
  const reject = page.getByRole('button', { name: 'Reject all', exact: true });
  if (await reject.isVisible()) await reject.click();
  await page.locator('[data-commerce-primary]:visible').click();
  await page.locator('#finish-selectors button').filter({ has: page.locator('img') }).first().click();
  await page.locator('[data-commerce-primary]:visible').click();
  await page.getByRole('button', { name: 'Configure Segment Console Table', exact: true }).click();
  await page.getByRole('button', { name: 'Finish: Ivory Lacquer / Aged Brass', exact: true }).click();
  await page.getByRole('button', { name: 'Increase Segment Console Table quantity', exact: true }).click();
  await page.getByRole('button', { name: 'Add selection to ensemble', exact: true }).click();
  await page.getByRole('button', { name: 'No, thank you', exact: true }).click();
  const response = page.waitForResponse(r => r.url().endsWith('/functions/v1/create-payment-intent') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '[ Proceed to Secure Checkout ]', exact: true }).filter({ visible: true }).click();
  const boundary = await response;
  expect(boundary.status()).toBe(503);
  expect(await boundary.json()).toEqual({ error: 'E2E: prices verified; payment provider intentionally blocked' });
  await expect(page).toHaveURL(/\/checkout$/);
  const handoff = await page.evaluate(() => history.state?.usr?.lines);
  expect(handoff).toHaveLength(2);
  expect(handoff.find((line: any) => line.pickId === pickId)).toMatchObject({
    pairing: { ruleId: rule.id, optionId: 'ivory-brass' }, finishLabel: 'Ivory Lacquer / Aged Brass', unitCents: 870000, quantity: 2, currency: 'USD',
  });
  expect(submitted.currency.toLowerCase()).toBe('usd');
  expect(submitted.items).toHaveLength(2);
  expect(submitted.items.find((line: any) => line.pickId === pickId)).toMatchObject({
    pairing: { ruleId: rule.id, optionId: 'ivory-brass' }, selectedFinish: 'Ivory Lacquer / Aged Brass', price: 8700, quantity: 2,
  });
  expect(verified.accepted.ok).toBe(true);
  expect(verified.accepted.lines.find((line: any) => line.pick_id === pickId)).toMatchObject({ finish_label: 'Ivory Lacquer / Aged Brass', unit_price_cents: 870000, quantity: 2, line_total_cents: 1740000 });
  expect(verified.reads).toContain('curated_pairing_rules');
  expect(verified.withoutReference).toMatchObject({ ok: false, status: 409 });
  expect(verified.tampered).toMatchObject({ ok: false, status: 409 });
  // This high-value ensemble naturally defaults to the bank-wire checkout.
  await expect(page.getByRole('heading', { name: 'Bank wire — contact & delivery', exact: true })).toBeVisible();
  await expect(page.getByRole('complementary').getByText('Ivory Lacquer / Aged Brass', { exact: true })).toBeVisible();
});
test('price-change rejection offers a safe retry that keeps the configured pairing', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 1800 });
  // The admin raised the custom finish price after the buyer configured it.
  const raised = { ...rule, finish_options: rule.finish_options.map(o => o.id === 'ivory-brass' ? { ...o, price_cents: 910000 } : o) };
  await page.route('**/rest/v1/curated_pairing_rules?*', route => route.fulfill({ json: [rule] }));
  await page.route('**/functions/v1/stripe-config', route => route.fulfill({ json: {} }));
  await page.route('https://api.stripe.com/**', route => route.abort());
  const calls: any[] = [];
  await page.route('**/functions/v1/create-payment-intent', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200 });
    const body = route.request().postDataJSON();
    const products = body.items.map((line: any) => ({
      id: line.pickId, source_pick_id: line.pickId, is_active: true, public_rrp_visible: true,
      currency: body.currency, rrp_price_cents: line.pickId === pickId ? 999 : Math.round(line.price * 100),
    }));
    const out = JSON.parse(execFileSync('deno', ['run', '--allow-read', '--config', 'tests/harness/deno.json', 'tests/harness/pairing-checkout.harness.ts'], {
      input: JSON.stringify({ body, products, rule: raised }), encoding: 'utf8', timeout: 30_000,
    }).trim().split('\n').pop() || '{}');
    calls.push({ body, out });
    if (!out.accepted.ok) return route.fulfill({ status: out.accepted.status, json: { error: out.accepted.error, recovery: out.accepted.recovery ?? null } });
    await route.fulfill({ status: 503, json: { error: 'E2E: prices verified; payment provider intentionally blocked' } });
  });
  await page.goto('/');
  await page.evaluate(([r, p]) => {
    sessionStorage.setItem('ma_intake_done', '1');
    sessionStorage.setItem('ma_checkout_form', JSON.stringify({ buyerProfile: 'private', projectCity: 'New York', email: 'client@example.com' }));
    localStorage.setItem('trade.detectedCountry', 'US');
    localStorage.setItem('trade.displayCurrency', 'USD');
    localStorage.setItem('trade.shippingDestination.manual', '1');
    // A small basket so the card checkout (not bank wire) is used.
    localStorage.setItem('ma_cart_v1', JSON.stringify([{ key: `${p}::ivory lacquer / aged brass::pairing:${r}:ivory-brass`, pickId: p, title: 'Segment Console Table', designerName: 'Apparatus Studio', finishLabel: 'Ivory Lacquer / Aged Brass', imageUrl: '', unitPriceCents: 870000, currency: 'USD', quantity: 1, pairing: { ruleId: r, optionId: 'ivory-brass' } }]));
  }, [rule.id, pickId]);
  const first = page.waitForResponse(r => r.url().endsWith('/functions/v1/create-payment-intent') && r.request().method() === 'POST');
  await page.goto('/checkout');
  expect((await first).status()).toBe(409);
  const panel = page.getByTestId('checkout-recovery');
  await expect(panel).toContainText('has changed');
  await expect(panel).toContainText('Ivory Lacquer / Aged Brass');
  await expect(panel).toContainText('$9,100');
  await page.screenshot({ path: '/tmp/browser/recovery-panel.png' });
  const second = page.waitForResponse(r => r.url().endsWith('/functions/v1/create-payment-intent') && r.request().method() === 'POST');
  await panel.getByRole('button', { name: 'Accept updated price and retry' }).click();
  expect((await second).status()).toBe(503);
  const retried = calls.at(-1).body.items[0];
  expect(retried).toMatchObject({ pickId, pairing: { ruleId: rule.id, optionId: 'ivory-brass' }, selectedFinish: 'Ivory Lacquer / Aged Brass', price: 9100, quantity: 1 });
  expect(calls.at(-1).out.accepted.ok).toBe(true);
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('ma_cart_v1') || '{}').lines);
  expect(cart[0]).toMatchObject({ unitPriceCents: 910000, pairing: { optionId: 'ivory-brass' }, finishLabel: 'Ivory Lacquer / Aged Brass' });
});

test('several valid prices: buyer chooses one, the pairing line is kept untouched', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 1800 });
  const pendant = 'f0000000-0000-4000-8000-000000000001';
  await page.route('**/rest/v1/curated_pairing_rules?*', route => route.fulfill({ json: [rule] }));
  await page.route('**/functions/v1/stripe-config', route => route.fulfill({ json: {} }));
  await page.route('https://api.stripe.com/**', route => route.abort());
  const calls: any[] = [];
  await page.route('**/functions/v1/create-payment-intent', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200 });
    const body = route.request().postDataJSON();
    const products = [
      { id: pickId, source_pick_id: pickId, is_active: true, public_rrp_visible: true, currency: 'USD', rrp_price_cents: 999 },
      { id: pendant, source_pick_id: pendant, is_active: true, public_rrp_visible: true, currency: 'USD', rrp_price_cents: 0 },
    ];
    // Both sizes were repriced since the buyer added the pendant at $400.
    const picks = [{ id: pendant, size_variants: [{ label: 'Small', price_cents: 45000 }, { label: 'Large', price_cents: 62000 }] }];
    const out = JSON.parse(execFileSync('deno', ['run', '--allow-read', '--config', 'tests/harness/deno.json', 'tests/harness/pairing-checkout.harness.ts'], {
      input: JSON.stringify({ body, products, picks, rule }), encoding: 'utf8', timeout: 30_000,
    }).trim().split('\n').pop() || '{}');
    calls.push({ body, out });
    if (!out.accepted.ok) return route.fulfill({ status: out.accepted.status, json: { error: out.accepted.error, recovery: out.accepted.recovery ?? null } });
    await route.fulfill({ status: 503, json: { error: 'E2E: prices verified; payment provider intentionally blocked' } });
  });
  await page.goto('/');
  await page.evaluate(([r, p, pend]) => {
    sessionStorage.setItem('ma_intake_done', '1');
    sessionStorage.setItem('ma_checkout_form', JSON.stringify({ buyerProfile: 'private', projectCity: 'New York', email: 'client@example.com' }));
    localStorage.setItem('trade.detectedCountry', 'US');
    localStorage.setItem('trade.displayCurrency', 'USD');
    localStorage.setItem('trade.shippingDestination.manual', '1');
    localStorage.setItem('ma_cart_v1', JSON.stringify([
      { key: `${pend}::`, pickId: pend, title: 'Fixture Pendant', designerName: 'Fixture Studio', finishLabel: null, imageUrl: '', unitPriceCents: 40000, currency: 'USD', quantity: 1 },
      { key: `${p}::ivory lacquer / aged brass::pairing:${r}:ivory-brass`, pickId: p, title: 'Segment Console Table', designerName: 'Apparatus Studio', finishLabel: 'Ivory Lacquer / Aged Brass', imageUrl: '', unitPriceCents: 870000, currency: 'USD', quantity: 1, pairing: { ruleId: r, optionId: 'ivory-brass' } },
    ]));
  }, [rule.id, pickId, pendant]);
  const first = page.waitForResponse(r => r.url().endsWith('/functions/v1/create-payment-intent') && r.request().method() === 'POST');
  await page.goto('/checkout');
  expect((await first).status()).toBe(409);
  const panel = page.getByTestId('checkout-recovery');
  const confirm = panel.getByRole('button', { name: 'Confirm selected price and retry' });
  await expect(confirm).toBeDisabled();
  await expect(panel.getByRole('radio')).toHaveCount(2);
  await panel.getByText('Large', { exact: true }).click();
  await page.screenshot({ path: '/tmp/browser/recovery-choice.png' });
  const before = calls.length;
  const second = page.waitForResponse(r => r.url().endsWith('/functions/v1/create-payment-intent') && r.request().method() === 'POST');
  await confirm.click();
  expect((await second).status()).toBe(503);
  expect(calls.length).toBe(before + 1);
  const items = calls.at(-1).body.items;
  expect(items.find((l: any) => l.pickId === pendant)).toMatchObject({ price: 620 });
  expect(items.find((l: any) => l.pickId === pickId)).toMatchObject({ pairing: { ruleId: rule.id, optionId: 'ivory-brass' }, selectedFinish: 'Ivory Lacquer / Aged Brass', price: 8700 });
  expect(calls.at(-1).out.accepted.ok).toBe(true);
});

test('bank wire: price-change rejection offers the chooser and retries with the pairing intact', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 1800 });
  const pendant = 'f0000000-0000-4000-8000-000000000002';
  const raised = { ...rule, finish_options: rule.finish_options.map(o => o.id === 'ivory-brass' ? { ...o, price_cents: 910000 } : o) };
  await page.route('**/rest/v1/curated_pairing_rules?*', route => route.fulfill({ json: [rule] }));
  await page.route('**/functions/v1/stripe-config', route => route.fulfill({ json: {} }));
  await page.route('**/functions/v1/create-payment-intent', route => route.fulfill({ status: 503, json: { error: 'E2E: card path not under test' } }));
  await page.route('https://api.stripe.com/**', route => route.abort());
  const calls: any[] = [];
  await page.route('**/functions/v1/request-wire-transfer', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200 });
    const body = route.request().postDataJSON();
    const harnessBody = { currency: body.currency, items: body.items.map((i: any) => ({ pickId: i.pickId, title: i.title, designer: i.designer, selectedFinish: i.finish, pairing: i.pairing, price: i.unitCents / 100, quantity: i.quantity })) };
    const products = [
      { id: pickId, source_pick_id: pickId, is_active: true, public_rrp_visible: true, currency: 'USD', rrp_price_cents: 999 },
      { id: pendant, source_pick_id: pendant, is_active: true, public_rrp_visible: true, currency: 'USD', rrp_price_cents: 5700000 },
    ];
    const out = JSON.parse(execFileSync('deno', ['run', '--allow-read', '--config', 'tests/harness/deno.json', 'tests/harness/pairing-checkout.harness.ts'], {
      input: JSON.stringify({ body: harnessBody, products, rule: raised }), encoding: 'utf8', timeout: 30_000,
    }).trim().split('\n').pop() || '{}');
    calls.push({ body, out });
    if (!out.accepted.ok) return route.fulfill({ status: out.accepted.status, json: { error: out.accepted.error, recovery: out.accepted.recovery ?? null } });
    await route.fulfill({ status: 503, json: { error: 'E2E: prices verified; wire request intentionally not recorded' } });
  });
  await page.goto('/');
  await page.evaluate(([r, p, pend]) => {
    sessionStorage.setItem('ma_intake_done', '1');
    sessionStorage.setItem('ma_checkout_form', JSON.stringify({ buyerProfile: 'private', projectCity: 'New York', email: 'client@example.com' }));
    localStorage.setItem('trade.detectedCountry', 'US');
    localStorage.setItem('trade.displayCurrency', 'USD');
    localStorage.setItem('trade.shippingDestination.manual', '1');
    localStorage.setItem('ma_cart_v1', JSON.stringify([
      { key: `${pend}::`, pickId: pend, title: 'Fixture Chandelier', designerName: 'Fixture Studio', finishLabel: null, imageUrl: '', unitPriceCents: 5700000, currency: 'USD', quantity: 1 },
      { key: `${p}::ivory lacquer / aged brass::pairing:${r}:ivory-brass`, pickId: p, title: 'Segment Console Table', designerName: 'Apparatus Studio', finishLabel: 'Ivory Lacquer / Aged Brass', imageUrl: '', unitPriceCents: 870000, currency: 'USD', quantity: 2, pairing: { ruleId: r, optionId: 'ivory-brass' } },
    ]));
  }, [rule.id, pickId, pendant]);
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Bank wire — contact & delivery', exact: true })).toBeVisible();
  const reject = page.getByRole('button', { name: 'Reject all', exact: true });
  if (await reject.isVisible()) await reject.click();
  await page.getByPlaceholder('Full name').fill('E2E Client');
  await page.getByPlaceholder('Email address').fill('client@example.com');
  const first = page.waitForResponse(r => r.url().endsWith('/functions/v1/request-wire-transfer') && r.request().method() === 'POST');
  await page.getByRole('button', { name: /Request wire instructions/ }).click();
  expect((await first).status()).toBe(409);
  const panel = page.getByTestId('checkout-recovery');
  await expect(panel).toContainText('$9,100');
  await expect(panel).toBeInViewport(); await page.screenshot({ path: '/tmp/browser/wire-recovery.png' });
  const second = page.waitForResponse(r => r.url().endsWith('/functions/v1/request-wire-transfer') && r.request().method() === 'POST');
  await panel.getByRole('button', { name: 'Accept updated price and retry' }).click();
  expect((await second).status()).toBe(503);
  const items = calls.at(-1).body.items;
  expect(items.find((l: any) => l.pickId === pickId)).toMatchObject({ pairing: { ruleId: rule.id, optionId: 'ivory-brass' }, finish: 'Ivory Lacquer / Aged Brass', unitCents: 910000, quantity: 2 });
  expect(items.find((l: any) => l.pickId === pendant)).toMatchObject({ unitCents: 5700000 });
  expect(calls.at(-1).out.accepted.ok).toBe(true);
  expect(calls.at(-1).body.amountCents).toBeGreaterThan(calls[0].body.amountCents);
});

for (const scenario of ['pairing-price', 'multiple-prices'] as const) {
  test(`instant bank transfer: ${scenario} confirms a price and preserves the configured pairing`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 1800 });
    const pendant = 'f0000000-0000-4000-8000-000000000003';
    const gbpRule = { ...rule, finish_currency: 'GBP' };
    const verifiedRule = scenario === 'pairing-price' ? { ...gbpRule, finish_options: gbpRule.finish_options.map(o => o.id === 'ivory-brass' ? { ...o, price_cents: 910000 } : o) } : gbpRule;
    await page.route('**/functions/v1/stripe-config', route => route.fulfill({ json: {} }));
    await page.route('**/functions/v1/create-payment-intent', route => route.fulfill({ status: 503, json: { error: 'E2E: card requests blocked' } }));
    await page.route('**/functions/v1/request-wire-transfer', route => route.abort());
    await page.route('**/functions/v1/create-proforma-order', route => route.abort());
    await page.route('https://api.stripe.com/**', route => route.abort());
    const calls: any[] = [];
    await page.route('**/functions/v1/create-bank-transfer-intent', async route => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200 });
      const body = route.request().postDataJSON();
      const products = [
        { id: pickId, source_pick_id: pickId, is_active: true, public_rrp_visible: true, currency: 'GBP', rrp_price_cents: 999 },
        { id: pendant, source_pick_id: pendant, is_active: true, public_rrp_visible: true, currency: 'GBP', rrp_price_cents: scenario === 'multiple-prices' ? 0 : 5700000 },
      ];
      const picks = scenario === 'multiple-prices' ? [{ id: pendant, size_variants: [{ label: 'Small', price_cents: 6000000 }, { label: 'Large', price_cents: 6500000 }] }] : [];
      const out = JSON.parse(execFileSync('deno', ['run', '--allow-read', '--config', 'tests/harness/deno.json', 'tests/harness/pairing-checkout.harness.ts'], {
        input: JSON.stringify({ body, products, picks, rule: verifiedRule }), encoding: 'utf8', timeout: 30_000,
      }).trim().split('\n').pop() || '{}');
      calls.push({ body, out });
      if (!out.accepted.ok) return route.fulfill({ status: out.accepted.status, json: { error: out.accepted.error, recovery: out.accepted.recovery ?? null } });
      // Routing is fixture-only: never create a payment or disclose real bank coordinates.
      return route.fulfill({ json: { financialAddresses: [{ type: 'sort_code', sort_code: { account_holder_name: 'E2E ONLY — NOT PAYABLE', sort_code: '00-00-00', account_number: 'TEST-ONLY' } }], reference: 'E2E-NOT-PAYABLE' } });
    });
    await page.goto('/');
    await page.evaluate(([r, p, pend]) => {
      sessionStorage.setItem('ma_intake_done', '1');
      sessionStorage.setItem('ma_checkout_form', JSON.stringify({ buyerProfile: 'private', projectCity: 'London', email: 'client@example.com' }));
      localStorage.setItem('trade.detectedCountry', 'GB');
      localStorage.setItem('trade.displayCurrency', 'GBP');
      localStorage.setItem('trade.shippingDestination.manual', '1');
      localStorage.setItem('ma_cart_v1', JSON.stringify([
        { key: `${pend}::`, pickId: pend, title: 'Fixture Chandelier', designerName: 'Fixture Studio', finishLabel: null, imageUrl: '', unitPriceCents: 5700000, currency: 'GBP', quantity: 1 },
        { key: `${p}::ivory lacquer / aged brass::pairing:${r}:ivory-brass`, pickId: p, title: 'Segment Console Table', designerName: 'Apparatus Studio', finishLabel: 'Ivory Lacquer / Aged Brass', imageUrl: '', unitPriceCents: 870000, currency: 'GBP', quantity: 2, pairing: { ruleId: r, optionId: 'ivory-brass' } },
      ]));
    }, [rule.id, pickId, pendant]);
    const first = page.waitForResponse(r => r.url().endsWith('/functions/v1/create-bank-transfer-intent') && r.request().method() === 'POST');
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'Bank wire — contact & delivery', exact: true })).toBeVisible();
    const reject = page.getByRole('button', { name: 'Reject all', exact: true });
    if (await reject.isVisible()) await reject.click();
    await page.getByPlaceholder('Email address').fill('client@example.com');
    expect((await first).status()).toBe(409);
    const panel = page.getByTestId('checkout-recovery');
    await expect(panel).toBeInViewport();
    const before = calls.length;
    const basketBefore = await page.evaluate(() => localStorage.getItem('ma_cart_v1'));
    if (scenario === 'multiple-prices') {
      await expect(panel.getByRole('button', { name: 'Confirm selected price and retry' })).toBeDisabled();
      await panel.getByText('Large', { exact: true }).click();
      expect(calls.length).toBe(before);
      expect(await page.evaluate(() => localStorage.getItem('ma_cart_v1'))).toBe(basketBefore);
    } else await expect(panel).toContainText('£9,100');
    await page.screenshot({ path: `/tmp/browser/instant-${scenario}.png` });
    const second = page.waitForResponse(r => r.url().endsWith('/functions/v1/create-bank-transfer-intent') && r.request().method() === 'POST');
    await panel.getByRole('button', { name: scenario === 'multiple-prices' ? 'Confirm selected price and retry' : 'Accept updated price and retry' }).click();
    expect((await second).status()).toBe(200);
    await expect(page.getByText('TEST-ONLY', { exact: true })).toBeVisible();
    expect(calls.length).toBe(before + 1);
    expect(calls.at(-1).out.accepted.ok).toBe(true);
    expect(calls.at(-1).body.items.find((l: any) => l.pickId === pickId)).toMatchObject({ pairing: { ruleId: rule.id, optionId: 'ivory-brass' }, selectedFinish: 'Ivory Lacquer / Aged Brass', quantity: 2, price: scenario === 'pairing-price' ? 9100 : 8700 });
    expect(calls.at(-1).body.items.find((l: any) => l.pickId === pendant).price).toBe(scenario === 'multiple-prices' ? 65000 : 57000);
    const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('ma_cart_v1') || '{}').lines);
    expect(cart.find((l: any) => l.pickId === pickId)).toMatchObject({ pairing: { ruleId: rule.id, optionId: 'ivory-brass' }, quantity: 2, finishLabel: 'Ivory Lacquer / Aged Brass' });
  });
}
