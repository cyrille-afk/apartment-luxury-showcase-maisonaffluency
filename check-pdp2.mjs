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
const accept = page.getByRole('button', { name: /^accept$/i });
if (await accept.count()) { await accept.first().click().catch(()=>{}); await page.waitForTimeout(600); }
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 500); await page.waitForTimeout(200); }
await page.waitForTimeout(800);
// measure gap: pixel column between header bottom and image top while compact
const gap = await page.evaluate(() => {
  const header = document.querySelector('header, [class*="z-50"]');
  const frame = document.querySelector('.product-image-frame');
  if (!frame) return 'no frame';
  const hb = header ? header.getBoundingClientRect().bottom : null;
  const fr = frame.getBoundingClientRect();
  return JSON.stringify({ headerBottom: hb, frameTop: fr.top, scrollY: window.scrollY });
});
console.log('compact seating:', gap);
await page.screenshot({ path: '/tmp/browser/pdp/5_compact_seat.png' });
// scroll to very bottom
for (let i = 0; i < 25; i++) { await page.mouse.wheel(0, 800); await page.waitForTimeout(150); }
await page.waitForTimeout(1000);
const bar = await page.evaluate(() => {
  const b = [...document.querySelectorAll('div.fixed')].find(d => d.className.includes('top-[var(--header-h)]') && d.className.includes('md:hidden'));
  if (!b) return 'none';
  const r = b.getBoundingClientRect();
  return JSON.stringify({ top: Math.round(r.top), shown: getComputedStyle(b).transform === 'none' || r.top >= 0, text: b.textContent.slice(0,80), scrollY: window.scrollY });
});
console.log('bar at bottom:', bar);
await page.screenshot({ path: '/tmp/browser/pdp/6_deep.png' });
await browser.close();
