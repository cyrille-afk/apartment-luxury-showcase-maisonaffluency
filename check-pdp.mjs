import { chromium } from 'playwright';
import fs from 'fs';
const ld = fs.existsSync('/tmp/browser/lt/ldpath') ? fs.readFileSync('/tmp/browser/lt/ldpath','utf8').trim() : '';
if (ld) process.env.LD_LIBRARY_PATH = ld + (process.env.LD_LIBRARY_PATH ? ':'+process.env.LD_LIBRARY_PATH : '');
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:8080/designers/alinea/angelo-m-h-high-table', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
// dismiss cookie banner
const accept = page.getByRole('button', { name: /^accept$/i });
if (await accept.count()) { await accept.first().click().catch(()=>{}); await page.waitForTimeout(500); }
await page.screenshot({ path: '/tmp/browser/pdp/1_top.png' });
// scroll progressively with wheel-like steps
for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(250); }
await page.waitForTimeout(900);
await page.screenshot({ path: '/tmp/browser/pdp/2_compact.png' });
for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 500); await page.waitForTimeout(200); }
await page.waitForTimeout(900);
await page.screenshot({ path: '/tmp/browser/pdp/3_deep.png' });
const barInfo = await page.evaluate(() => {
  const bars = [...document.querySelectorAll('div.fixed')].filter(d => d.className.includes('top-[var(--header-h)]') && d.className.includes('md:hidden'));
  const b = bars[0];
  if (!b) return 'no bar';
  const r = b.getBoundingClientRect();
  return JSON.stringify({ text: b.textContent.slice(0,100), top: r.top, visible: r.height > 0 && r.top >= 0 && r.top < 200, transform: getComputedStyle(b).transform });
});
console.log('mini bar:', barInfo);
// click the CTA via DOM to avoid overlay interception issues
const clicked = await page.evaluate(() => {
  const bars = [...document.querySelectorAll('div.fixed')].filter(d => d.className.includes('top-[var(--header-h)]') && d.className.includes('md:hidden'));
  const btn = bars[0]?.querySelector('button');
  if (!btn) return false;
  btn.click();
  return true;
});
console.log('clicked:', clicked);
await page.waitForTimeout(1600);
await page.screenshot({ path: '/tmp/browser/pdp/4_sheet.png' });
console.log('sheet visible:', await page.evaluate(() => /intent|delivery|contact|quote/i.test(document.body.textContent)));
await browser.close();
