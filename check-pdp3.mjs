import { chromium } from 'playwright';
import fs from 'fs';
const ld = fs.existsSync('/tmp/browser/lt/ldpath') ? fs.readFileSync('/tmp/browser/lt/ldpath','utf8').trim() : '';
if (ld) process.env.LD_LIBRARY_PATH = ld + (process.env.LD_LIBRARY_PATH ? ':'+process.env.LD_LIBRARY_PATH : '');
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('http://localhost:8080/designers/alinea/angelo-m-h-high-table', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
const accept = page.getByRole('button', { name: /^accept$/i });
if (await accept.count()) { await accept.first().click().catch(()=>{}); }
await page.waitForTimeout(500);
const info = await page.evaluate(() => {
  const d = document.documentElement, b = document.body;
  return JSON.stringify({
    docH: d.scrollHeight, bodyH: b.scrollHeight, winY: window.scrollY,
    docOverflow: getComputedStyle(d).overflow, bodyOverflow: getComputedStyle(b).overflow,
    bodyPos: getComputedStyle(b).position,
    hasFinish: /Select Your/i.test(b.textContent), textLen: b.textContent.length
  });
});
console.log(info);
// try scrolling the actual scrollable element
const target = await page.evaluate(() => {
  const els = [document.scrollingElement, ...document.querySelectorAll('main, [class*="overflow-y"], div')];
  for (const e of els) { if (e && e.scrollHeight > e.clientHeight + 500) { e.scrollTop = e.scrollHeight; if (e.scrollTop > 1000) return e.tagName + '.' + (typeof e.className === 'string' ? e.className.slice(0,60) : ''); } }
  return 'none scrolled';
});
console.log('scroll target:', target, 'scrollY now:', await page.evaluate(() => window.scrollY));
await page.waitForTimeout(1000);
const bar = await page.evaluate(() => {
  const bb = [...document.querySelectorAll('div.fixed')].find(x => x.className.includes('top-[var(--header-h)]') && x.className.includes('md:hidden'));
  const r = bb?.getBoundingClientRect();
  return r ? JSON.stringify({ top: Math.round(r.top), y: window.scrollY }) : 'none';
});
console.log('bar:', bar);
await page.screenshot({ path: '/tmp/browser/pdp/7_deep.png' });
await browser.close();
