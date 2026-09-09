import { chromium } from '@playwright/test';
const b = await chromium.launch();
const c = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true });
const pg = await c.newPage();
const cdp = await c.newCDPSession(pg);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await cdp.send('Profiler.start');
await pg.goto('http://localhost:4321/', { waitUntil:'load' });
await pg.waitForTimeout(6000);
const { profile } = await cdp.send('Profiler.stop');
const self = new Map();
const byNode = new Map(profile.nodes.map(n=>[n.id,n]));
for (let i=0;i<profile.samples.length;i++){
  const n = byNode.get(profile.samples[i]); if(!n) continue;
  const d = profile.timeDeltas[i]||0;
  const f = n.callFrame;
  const k = `${f.functionName||'(anon)'} @ ${(f.url||'').split('/').pop()}:${f.lineNumber}`;
  self.set(k,(self.get(k)||0)+d);
}
[...self.entries()].sort((a,b)=>b[1]-a[1]).slice(0,30).forEach(([k,v])=>console.log((v/1000).toFixed(1)+'ms', k));
await b.close();
