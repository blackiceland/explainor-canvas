// Render the SAFETY scene (first in the enabled render list) at several
// timestamps and capture console / page errors. Seeks via localStorage frame.
import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import path from 'node:path';

const URL = 'http://localhost:5173/src/project';
const OUT = path.resolve('safety-shots');
await fs.mkdir(OUT, {recursive: true});

const FPS = 60;
const TIMES_S = [19, 20, 21, 26];

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  defaultViewport: {width: 1920, height: 1080},
});
const page = await browser.newPage();

const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));

const grabMain = async () =>
  await page.evaluate(() => {
    const cs = Array.from(document.querySelectorAll('canvas'));
    const main = cs.find(c => c.width === 1920 && c.height === 1080) || cs[0];
    return main ? main.toDataURL('image/png') : null;
  });

await page.goto(URL, {waitUntil: 'domcontentloaded', timeout: 30000});
await new Promise(r => setTimeout(r, 9000));

// Detect a vite compile-error overlay (a common "ерунда" cause).
const overlay = await page.evaluate(() => {
  const el = document.querySelector('vite-error-overlay');
  if (!el) return null;
  const msg = el.shadowRoot?.querySelector('.message')?.textContent ?? el.textContent;
  return (msg || '').slice(0, 800);
});
if (overlay) console.log('VITE ERROR OVERLAY:\n' + overlay);

const meta = await page.evaluate(() => ({
  title: document.title,
  canvases: Array.from(document.querySelectorAll('canvas')).map(c => `${c.width}x${c.height}`),
}));
console.log('meta', JSON.stringify(meta));

for (const ts of TIMES_S) {
  const f = Math.round(ts * FPS);
  await page.evaluate(v => localStorage.setItem('project/frame', String(v)), f);
  await page.reload({waitUntil: 'domcontentloaded'});
  await new Promise(r => setTimeout(r, 12000));
  const dataUrl = await grabMain();
  if (!dataUrl) { console.log(`t=${ts}s f=${f} NO CANVAS`); continue; }
  const png = Buffer.from(dataUrl.split(',')[1], 'base64');
  const file = path.join(OUT, `t${String(ts).padStart(2, '0')}s.png`);
  await fs.writeFile(file, png);
  console.log(`t=${ts}s f=${f} -> ${path.basename(file)} (${png.length}b)`);
}

await fs.writeFile(path.join(OUT, 'console.log'), logs.join('\n'));
const errs = logs.filter(l => l.includes('[error]') || l.includes('[pageerror]'));
console.log(`\n=== ${errs.length} errors/pageerrors ===`);
console.log(errs.slice(0, 40).join('\n'));

await browser.close();
