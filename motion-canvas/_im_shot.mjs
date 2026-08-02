import puppeteer from 'puppeteer';
import {createHash} from 'node:crypto';
import {readFileSync, existsSync} from 'node:fs';

// Throwaway shot harness for imProject (duplicationHateIntroScene + introMergeScene).
const SCENE = process.env.SCENE || 'introMergeScene';
const FPS = 30;
const OUT_DIR = 'C:/Users/black/IdeaProjects/explainor-canvas/motion-canvas/output/still/imProject';

const frames = process.argv.slice(2).map(Number).filter(n => Number.isFinite(n));
if (frames.length === 0) { console.error('no frames'); process.exit(1); }

const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox']});
const page = await browser.newPage();
page.on('console', m => { const t = m.text(); if (/error|fail|exception/i.test(t)) console.log('  [console]', t); });

for (const f of frames) {
  const url = `http://127.0.0.1:5173/imstill.html?scene=${SCENE}&frame=${f}&fps=${FPS}&timeoutMs=300000&grid=off`;
  const t0 = Date.now();
  try {
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 180000});
    await page.waitForFunction(
      () => window.__MC_STILL_DONE === true || typeof window.__MC_STILL_ERROR === 'string',
      {timeout: 300000, polling: 200},
    );
    const err = await page.evaluate(() => window.__MC_STILL_ERROR ?? null);
    const info = await page.evaluate(() => window.__MC_STILL ?? null);
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    if (err) { console.log(`frame ${f}: ERROR (${dt}s)\n${err}`); continue; }
    const gf = info?.globalFrame ?? f;
    const path = `${OUT_DIR}/${String(gf).padStart(6, '0')}.png`;
    let hash = 'NO-FILE';
    if (existsSync(path)) hash = createHash('sha1').update(readFileSync(path)).digest('hex').slice(0, 12);
    console.log(`frame ${String(f).padStart(5)} -> global ${gf} -> ${path}  ${hash}  (${dt}s)`);
  } catch (e) {
    console.log(`frame ${f}: DRIVER-ERROR ${String(e).split('\n')[0]}`);
  }
}
await browser.close();
console.log('done');
