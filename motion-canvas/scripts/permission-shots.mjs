// Render the PERMISSION scene (only enabled scene in the project) at the
// rack-focus checkpoints and capture console / page errors. Seeks via the
// saved localStorage frame + reload (frame-exact, no playback drift).
import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import path from 'node:path';

const URL = 'http://localhost:5173/src/project';
const OUT = path.resolve('permission-shots');
await fs.mkdir(OUT, {recursive: true});

const FPS = 60;
// Rack-focus now runs BEFORE the gauge (~t17.2 start). Checkpoints:
//   18.1 defocused except `overwrite = true` (weaker blur), NO gauge yet
//   22.0 most of the boolean path sharp, NO gauge yet
//   23.6 whole path sharp (just before rack-back)
//   25.2 rack-back done, gauge bloomed over whole-block blur (scale appears AFTER)
const TIMES_S = [18.1, 22.0, 23.6, 25.2];

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
  // Double-seek: set frame, reload, set again, reload — defeats the
  // intermittent "stuck on previous frame" restore race.
  await page.evaluate(v => localStorage.setItem('project/frame', String(v)), f);
  await page.reload({waitUntil: 'domcontentloaded'});
  await new Promise(r => setTimeout(r, 2000));
  await page.evaluate(v => localStorage.setItem('project/frame', String(v)), f);
  await page.reload({waitUntil: 'domcontentloaded'});
  await new Promise(r => setTimeout(r, 13000));
  const dataUrl = await grabMain();
  if (!dataUrl) { console.log(`t=${ts}s f=${f} NO CANVAS`); continue; }
  const png = Buffer.from(dataUrl.split(',')[1], 'base64');
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
