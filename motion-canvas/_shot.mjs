// Multi-frame still driver. One browser, ONE page load, many frames.
//
//   SCENE=nullMeansPrologueSceneEn node _shot.mjs 120 300 640
//   SCENE=nullMeansPrologueSceneEn node _shot.mjs 0-900:30
//   SCENE=nullMeansPrologueSceneEn node _shot.mjs sweep 12
//
// env: SCENE (required), FPS=30, W=1920, H=1080, GRID=on|off, OUT=<subdir>
// output: output/still/shot/<OUT|SCENE>/<localframe>.png
import puppeteer from 'puppeteer';
import {createHash} from 'node:crypto';
import {readFileSync, existsSync} from 'node:fs';

const SCENE = process.env.SCENE;
const FPS = process.env.FPS ?? '30';
const W = process.env.W ?? '1920';
const H = process.env.H ?? '1080';
const GRID = process.env.GRID ?? 'off';
const OUT = process.env.OUT ?? SCENE;
const ROOT = 'C:/Users/black/IdeaProjects/explainor-canvas/motion-canvas';

if (!SCENE) { console.error('SCENE env is required'); process.exit(1); }

// `sweep 12` -> `sweep:12`; everything else is passed through verbatim.
const argv = process.argv.slice(2);
const spec = argv
  .flatMap((a, i) => (a === 'sweep' ? [`sweep:${argv[i + 1] ?? 12}`] : /^\d+$/.test(a) && argv[i - 1] === 'sweep' ? [] : [a]))
  .join(',');
if (!spec) { console.error('no frame spec (e.g. `120 300`, `0-900:30`, `sweep 12`)'); process.exit(1); }

const url =
  `http://127.0.0.1:5173/shot.html?scene=${SCENE}&frames=${encodeURIComponent(spec)}` +
  `&fps=${FPS}&w=${W}&h=${H}&grid=${GRID}&out=${OUT}&timeoutMs=180000`;

// Persistent profile: a fresh one has an empty HTTP cache, so every run re-fetched
// the Google Fonts faces from the network (~13 s inside ensureFontsLoaded).
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox'],
  userDataDir: `${ROOT}/.shot-profile`,
});
const page = await browser.newPage();
page.on('console', m => { const t = m.text(); if (/error|fail|exception/i.test(t)) console.log('  [console]', t); });
page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) console.log(`  [http ${r.status()}] ${r.url()}`); });
page.on('requestfailed', r => console.log(`  [req-failed] ${r.url()} ${r.failure()?.errorText ?? ''}`));

const t0 = Date.now();
await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 180000});

let printed = 0;
let setupPrinted = false;
try {
  for (;;) {
    const snap = await page.evaluate(() => ({
      shot: window.__SHOT ?? null,
      setupMs: window.__SHOT_SETUP_MS ?? null,
      steps: window.__SHOT_STEPS ?? null,
      done: window.__SHOT_DONE === true,
      error: window.__SHOT_ERROR ?? null,
    }));

    if (snap.error) { console.log(`ERROR\n${snap.error}`); break; }

    if (snap.setupMs != null && !setupPrinted) {
      setupPrinted = true;
      const s = snap.shot;
      const dur = s.duration ? `${s.duration}f (${(s.duration / Number(FPS)).toFixed(2)}s), ` : '';
      console.log(`${SCENE}: ${dur}${s.frames.length} frame(s), setup ${(snap.setupMs / 1000).toFixed(1)}s`);
      if (snap.steps) {
        const parts = Object.entries(snap.steps).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)}s`);
        console.log(`  setup breakdown: ${parts.join(' | ')}`);
      }
    }

    const results = snap.shot?.results ?? [];
    for (; printed < results.length; printed++) {
      const r = results[printed];
      if (r.error) { console.log(`frame ${String(r.frame).padStart(5)}  ERROR ${r.error}`); continue; }
      const abs = `${ROOT}/${r.file}`;
      const hash = existsSync(abs) ? createHash('sha1').update(readFileSync(abs)).digest('hex').slice(0, 12) : 'NO-FILE';
      console.log(`frame ${String(r.frame).padStart(5)} -> ${r.file}  ${hash}  (${(r.ms / 1000).toFixed(1)}s)`);
    }

    if (snap.done) break;
    await new Promise(r => setTimeout(r, 400));
  }
} catch (e) {
  console.log(`DRIVER-ERROR ${String(e).split('\n')[0]}`);
}

console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await browser.close();
