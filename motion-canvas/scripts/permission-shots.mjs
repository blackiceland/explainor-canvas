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
// Verify the LEFT call adopts saveOrReplace (the boolean argument vanishes).
//   33.0  saveOrReplace inserted on the right; call still save(…, overwrite=true)
//   35.0  call mid/post-morph — should read fileStorage.saveOrReplace(…), no overwrite line
//   36.5  call settled on saveOrReplace
//   38.5  big method reveal still intact downstream
//   50.5  gauge finale still intact downstream
// Finale + restored migration + taller/higher top fade.
//   44.0  mid-scroll — judge the TOP fade (should be higher & smoother)
//   52.5  gauge bloomed ON TOP of the blurred method
//   54.5  blurred code dissolving
//   56.2  gauge migrating UP toward PERMISSION
//   57.3  gauge docked as small rating under PERMISSION (как было)
// Restructured finale: raise block, one scroll to the !overwrite guard, rack-focus
// (guard sharp / rest soft) for ~9s, then blur all + verdict, then migrate.
//   40.0  guard rack-focus — rest blurred, `if (… !overwrite)` sharp
//   43.0  guard rack-focus (mid hold)
//   46.0  whole method blurring / verdict starting
//   49.0  verdict bloomed on fully-blurred method
//   53.0  verdict docked under PERMISSION
// RESTORED per author: top fade kept, method y0, scroll kept, boolean highlight
// kept, then blur-all → gauge. Bottom: no fade/limiter (noClip).
//   40.0  mid-scroll — top fade dissolves cleanly (no overflow lines), bottom runs off
//   42.0  rack-focus settled — guard SHARP, rest soft, no bottom stripe
//   44.5  blur-all — everything soft
//   46.0  verdict over the blurred method
const TIMES_S = [40.0, 42.0, 44.5, 46.0];

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  defaultViewport: {width: 1920, height: 1080},
  protocolTimeout: 300000,
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
  await new Promise(r => setTimeout(r, 22000));
  // Seeking to a deep frame means simulating every frame up to it; if the
  // player hasn't finished, the canvas is still black (a tiny PNG). Retry.
  let dataUrl = await grabMain();
  let png = dataUrl ? Buffer.from(dataUrl.split(',')[1], 'base64') : null;
  for (let tries = 0; png && png.length < 200000 && tries < 3; tries++) {
    await new Promise(r => setTimeout(r, 6000));
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
