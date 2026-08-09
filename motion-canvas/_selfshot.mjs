// Рендер кадров БЕЗ внешнего дев-сервера: поднимает vite в этом же процессе,
// снимает кадры, гасит всё за собой. Если на 5173 уже есть живой сервер —
// пользуется им и своего НЕ поднимает (два инстанса ломают редактор автора).
//
//   SCENE=nullMeansActOneSceneEn node _selfshot.mjs 138 165 230
//   SCENE=... OUT=act1 node _selfshot.mjs 0-900:30
//
// env: SCENE (обяз.), FPS=30, W=1920, H=1080, GRID=off, OUT=<подпапка>
import puppeteer from 'puppeteer';
import {createHash} from 'node:crypto';
import {readFileSync, existsSync} from 'node:fs';
import {createConnection} from 'node:net';

const SCENE = process.env.SCENE;
const FPS = process.env.FPS ?? '30';
const W = process.env.W ?? '1920';
const H = process.env.H ?? '1080';
const GRID = process.env.GRID ?? 'off';
const OUT = process.env.OUT ?? SCENE;
const ROOT = 'C:/Users/black/IdeaProjects/explainor-canvas/motion-canvas';

if (!SCENE) { console.error('SCENE env is required'); process.exit(1); }

const argv = process.argv.slice(2);
const spec = argv
  .flatMap((a, i) => (a === 'sweep' ? [`sweep:${argv[i + 1] ?? 12}`] : /^\d+$/.test(a) && argv[i - 1] === 'sweep' ? [] : [a]))
  .join(',');
if (!spec) { console.error('no frame spec'); process.exit(1); }

const alive = port =>
  new Promise(res => {
    const s = createConnection({host: '127.0.0.1', port, timeout: 700}, () => { s.destroy(); res(true); });
    s.on('error', () => res(false));
    s.on('timeout', () => { s.destroy(); res(false); });
  });

let port = 5173;
let server = null;
if (await alive(5173)) {
  console.log('используется уже работающий дев-сервер на 5173');
} else {
  const {createServer} = await import('vite');
  server = await createServer({root: ROOT, configFile: `${ROOT}/vite.config.ts`, server: {port: 0, strictPort: false}, logLevel: 'error'});
  await server.listen();
  port = server.config.server.port ?? server.httpServer.address().port;
  console.log(`поднят собственный vite на ${port}`);
}

const url =
  `http://127.0.0.1:${port}/shot.html?scene=${SCENE}&frames=${encodeURIComponent(spec)}` +
  `&fps=${FPS}&w=${W}&h=${H}&grid=${GRID}&out=${OUT}&timeoutMs=300000`;

const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox'], userDataDir: `${ROOT}/.shot-profile`});
const page = await browser.newPage();
page.on('console', m => { const t = m.text(); if (/error|fail|exception/i.test(t) && !/favicon/.test(t)) console.log('  [console]', t.slice(0, 200)); });
page.on('pageerror', e => console.log('  [pageerror]', String(e).slice(0, 300)));

const t0 = Date.now();
await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 300000});

let printed = 0;
let setupPrinted = false;
try {
  for (;;) {
    const snap = await page.evaluate(() => ({
      shot: window.__SHOT ?? null,
      setupMs: window.__SHOT_SETUP_MS ?? null,
      done: window.__SHOT_DONE === true,
      error: window.__SHOT_ERROR ?? null,
    }));
    if (snap.error) { console.log(`ERROR\n${snap.error}`); break; }
    if (snap.setupMs != null && !setupPrinted) {
      setupPrinted = true;
      const s = snap.shot;
      const dur = s.duration ? `${s.duration}f (${(s.duration / Number(FPS)).toFixed(2)}s), ` : '';
      console.log(`${SCENE}: ${dur}${s.frames.length} кадр(ов), setup ${(snap.setupMs / 1000).toFixed(1)}s`);
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
    await new Promise(r => setTimeout(r, 350));
  }
} catch (e) {
  console.log(`DRIVER-ERROR ${String(e).split('\n')[0]}`);
}

console.log(`готово за ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await browser.close();
if (server) await server.close();
process.exit(0);
