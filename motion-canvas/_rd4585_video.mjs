// Полный рендер сцены в mp4: PNG-секвенция через shot.html + ffmpeg.
//
//   node _rd4585_video.mjs                 весь таймлайн
//   FROM=0 TO=60 node _rd4585_video.mjs    кусок (проверить пайплайн)
//   KEEP=1 ...                             не удалять PNG после кодирования
//
// Почему shot.html, а не редактор: он строит рендерер над проектом ИЗ ОДНОЙ
// сцены, поэтому recalculate() меряет только её, и seek() идёт вперёд по
// одному кадру — соседний кадр стоит дельту, а не проигрывание с нуля.
import puppeteer from 'puppeteer';
import {existsSync, mkdirSync, readdirSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const SCENE = process.env.SCENE ?? 'rd4585SceneRu';
const FPS = Number(process.env.FPS ?? 30);
const TAG = process.env.TAG ?? `${SCENE}_video`;
const FFMPEG = process.env.FFMPEG ?? 'C:/ffmpeg/bin/ffmpeg.exe';
const ROOT = 'C:/Users/black/IdeaProjects/explainor-canvas/motion-canvas';
const DIR = `${ROOT}/output/still/shot/${TAG}`;
const OUT = process.env.OUT_FILE ?? `${ROOT}/output/${SCENE}.mp4`;

if (!existsSync(FFMPEG)) {
  console.error(`ffmpeg не найден: ${FFMPEG}`);
  process.exit(1);
}

// ── 1. длительность сцены ────────────────────────────────────────────────
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox'],
  userDataDir: `${ROOT}/.shot-profile`,
});
const page = await browser.newPage();
page.on('console', m => {
  const t = m.text();
  if (/error|exception/i.test(t) && !/favicon/.test(t)) console.log('  [console]', t);
});

// ⚠️ shotRunner считает длительность только для спецификации `sweep:` —
// при явных кадрах recalculate() пропускается и __SHOT.duration остаётся 0.
const probeUrl =
  `http://127.0.0.1:5173/shot.html?scene=${SCENE}&frames=sweep:2&fps=${FPS}&w=1920&h=1080&grid=off&out=_probe&timeoutMs=180000`;
await page.goto(probeUrl, {waitUntil: 'domcontentloaded', timeout: 180000});
await page.waitForFunction(
  () => window.__SHOT_DONE === true || typeof window.__SHOT_ERROR === 'string',
  {timeout: 300000, polling: 300},
);
const probeErr = await page.evaluate(() => window.__SHOT_ERROR ?? null);
if (probeErr) {
  console.error(`ошибка сцены:\n${probeErr}`);
  await browser.close();
  process.exit(1);
}
const duration = await page.evaluate(() => window.__SHOT?.duration ?? 0);

const from = Number(process.env.FROM ?? 0);
const to = Number(process.env.TO ?? duration - 1);
const count = to - from + 1;
if (!Number.isFinite(count) || count < 1) {
  console.error(`не удалось определить длительность сцены (duration=${duration})`);
  await browser.close();
  process.exit(1);
}
rmSync(`${ROOT}/output/still/shot/_probe`, {recursive: true, force: true});
console.log(`${SCENE}: ${duration} кадров (${(duration / FPS).toFixed(1)}с), рендерю ${from}–${to}`);

// ── 2. PNG-секвенция ─────────────────────────────────────────────────────
if (existsSync(DIR)) rmSync(DIR, {recursive: true, force: true});
mkdirSync(DIR, {recursive: true});

const t0 = Date.now();
const url =
  `http://127.0.0.1:5173/shot.html?scene=${SCENE}&frames=${from}-${to}` +
  `&fps=${FPS}&w=1920&h=1080&grid=off&out=${TAG}&timeoutMs=600000`;
await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 180000});

let last = -1;
for (;;) {
  const snap = await page.evaluate(() => ({
    n: window.__SHOT?.results?.length ?? 0,
    done: window.__SHOT_DONE === true,
    error: window.__SHOT_ERROR ?? null,
    lastErr: (() => {
      const r = window.__SHOT?.results ?? [];
      for (let i = r.length - 1; i >= 0; i--) if (r[i].error) return `${r[i].frame}: ${r[i].error}`;
      return null;
    })(),
  }));
  if (snap.error) { console.error(`ERROR\n${snap.error}`); await browser.close(); process.exit(1); }
  if (snap.n - last >= 200 || (snap.done && snap.n !== last)) {
    last = snap.n;
    const el = (Date.now() - t0) / 1000;
    const rate = snap.n / Math.max(el, 0.001);
    const eta = rate > 0 ? (count - snap.n) / rate : 0;
    console.log(
      `  ${snap.n}/${count} кадров · ${el.toFixed(0)}с · ${rate.toFixed(1)} к/с · осталось ~${(eta / 60).toFixed(1)} мин`,
    );
    if (snap.lastErr) console.log(`  [кадр с ошибкой] ${snap.lastErr}`);
  }
  if (snap.done) break;
  await new Promise(r => setTimeout(r, 1000));
}
await browser.close();

const files = readdirSync(DIR).filter(f => f.endsWith('.png'));
console.log(`PNG готовы: ${files.length} файлов за ${((Date.now() - t0) / 1000).toFixed(0)}с`);
if (files.length < count) console.log(`⚠️  ожидалось ${count}, получено ${files.length}`);

// ── 3. кодирование ───────────────────────────────────────────────────────
const start = files[0].replace('.png', '');
const args = [
  '-y',
  '-framerate', String(FPS),
  '-start_number', start,
  '-i', `${DIR}/%06d.png`,
  '-c:v', 'libx264',
  '-preset', 'slow',
  '-crf', '16',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  OUT,
];
console.log(`ffmpeg → ${OUT}`);
const r = spawnSync(FFMPEG, args, {stdio: ['ignore', 'ignore', 'inherit']});
if (r.status !== 0) { console.error(`ffmpeg упал (код ${r.status})`); process.exit(1); }

if (!process.env.KEEP) rmSync(DIR, {recursive: true, force: true});
console.log(`готово: ${OUT}`);
