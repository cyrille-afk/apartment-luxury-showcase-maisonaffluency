import { chromium } from 'playwright';
import fs from 'fs';
const ld = fs.existsSync('/tmp/browser/lt/ldpath') ? fs.readFileSync('/tmp/browser/lt/ldpath','utf8').trim() : '';
if (ld) process.env.LD_LIBRARY_PATH = ld + (process.env.LD_LIBRARY_PATH ? ':'+process.env.LD_LIBRARY_PATH : '');
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:8080/designers/alinea/angelo-m-h-high-table', { waitUntil: 'domcontentloaded' }).catch(()=>{});
// find a product link
await page.waitForTimeout(4000);
const href = '/designers/alinea/angelo-m-h-high-table'; const _unused = await page.evaluate(() => {
  const a = document.querySelector('a[href*="/product/"]');
  return null;
});
console.log('product href:', href);
await page.goto('http://localhost:8080' + href, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4500);
await page.screenshot({ path: '/tmp/browser/pdp/1_top.png' });
// scroll to trigger compact + sticky bar
await page.evaluate(() => window.scrollTo({ top: 1400, behavior: 'instant' }));
await page.waitForTimeout(1200);
await page.screenshot({ path: '/tmp/browser/pdp/2_compact.png' });
await page.evaluate(() => window.scrollTo({ top: 2600, behavior: 'instant' }));
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/browser/pdp/3_deep.png' });
// click the mini bar CTA
const btn = page.locator('button', { hasText: /Request Quote|Place Order|Proceed to Order/i }).first();
const ctaInfo = await page.evaluate(() => {
  const bar = document.querySelector('.fixed.top-\\[var\\(--header-h\\)\\]');
  return bar ? bar.textContent.slice(0,120) : 'no bar found';
});
console.log('mini bar text:', ctaInfo);
// click specifically inside the fixed mini bar
const miniBtn = await page.evaluateHandle(() => {
  const bars = [...document.querySelectorAll('div.fixed')].filter(d => d.className.includes('top-[var(--header-h)]'));
  return bars[0]?.querySelector('button') || null;
});
console.log('miniBtn found:', !!miniBtn); if (miniBtn && miniBtn.asElement()) {
  await miniBtn.asElement().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/browser/pdp/4_sheet.png' });
  console.log('sheet open:', await page.evaluate(() => document.body.textContent.includes('Your Details') || document.body.textContent.includes('Contact') || document.body.textContent.includes('Intent')));
}
await browser.close();
