// Render booleanTruthTreeSceneEn (throwaway treeProject) at growth checkpoints.
import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import path from 'node:path';

const URL = 'http://localhost:5173/src/treeProject';
const OUT = path.resolve('tree-shots');
await fs.mkdir(OUT, {recursive: true});

const FPS = 60;
// Cascade: trunk ~0.5-2s, split to 2 ~2.2-3.1s, to 4 ~3.4-4.2s, to 8 ~4.6-5.4s,
// tags settle ~5.5-6.1s, hold to ~8s.
const TIMES_S = [1.6, 3.0, 4.2, 6.5];

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  defaultViewport: {width: 1920, height: 1080},
  protocolTimeout: 300000,
});
const page = await browser.newPage();
page.setDefaultNavigationTimeout(90000);

const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));

const grabMain = async () =>
  await page.evaluate(() => {
    const cs = Array.from(document.querySelectorAll('canvas'));
    const main = cs.find(c => c.width === 1920 && c.height === 1080) || cs[0];
    return main ? main.toDataURL('image/png') : null;
  });

await page.goto(URL, {waitUntil: 'domcontentloaded', timeout: 90000});
await new Promise(r => setTimeout(r, 12000));

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

const sizes = [];
for (const ts of TIMES_S) {
  const f = Math.round(ts * FPS);
  await page.evaluate(v => localStorage.setItem('treeProject/frame', String(v)), f);
  await page.reload({waitUntil: 'domcontentloaded'});
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(v => localStorage.setItem('treeProject/frame', String(v)), f);
  await page.reload({waitUntil: 'domcontentloaded'});
  await new Promise(r => setTimeout(r, 14000));
  let dataUrl = await grabMain();
  let png = dataUrl ? Buffer.from(dataUrl.split(',')[1], 'base64') : null;
  for (let tries = 0; png && png.length < 120000 && tries < 3; tries++) {
    await new Promise(r => setTimeout(r, 5000));
    dataUrl = await grabMain();
    png = dataUrl ? Buffer.from(dataUrl.split(',')[1], 'base64') : null;
    console.log(`  t=${ts}s retry ${tries + 1} -> ${png ? png.length : 'null'}b`);
  }
  if (!png) { console.log(`t=${ts}s f=${f} NO CANVAS`); continue; }
  const file = path.join(OUT, `t${String(ts).replace('.', '_')}s.png`);
  await fs.writeFile(file, png);
  sizes.push(`${ts}s=${png.length}b`);
  console.log(`t=${ts}s f=${f} -> ${path.basename(file)} (${png.length}b)`);
}

await fs.writeFile(path.join(OUT, 'console.log'), logs.join('\n'));
const errs = logs.filter(l => l.includes('[error]') || l.includes('[pageerror]'));
console.log(`\nsizes: ${sizes.join('  ')}`);
console.log(`=== ${errs.length} errors/pageerrors ===`);
console.log(errs.slice(0, 40).join('\n'));

await browser.close();
