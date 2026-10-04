// Рендер сцен в mp4 без кнопки RENDER: PNG-секвенция через shot.html + ffmpeg.
//
//   node _render.mjs coldOpenIntroSceneEn            одна сцена
//   node _render.mjs sceneA sceneB                   несколько подряд, склеенные в один файл
//   OUT_FILE=... FPS=60 CRF=18 KEEP=1 node _render.mjs scene
//   FRAMES=2160-3480 node _render.mjs scene          только кусок кадров (включительно) —
//                                                    вставка в монтаж без рендера всей сцены
//
// Настройки по умолчанию — как у автора: 1920×1080, 60 к/с, libx264, crf 18,
// preset slow, yuv420p. Файл — следующий свободный output/videoNNN.mp4.
// Сцену не нужно включать в project.ts: shotRunner грузит её из src/scenes.
// Папка кадров чистится перед рендером: экспортёр Motion Canvas старые кадры
// не удаляет, и короткий рендер получил бы хвост длинного.
import puppeteer from 'puppeteer';
import {existsSync, mkdirSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const SCENES = process.argv.slice(2);
const FPS = Number(process.env.FPS ?? 60);
const CRF = String(process.env.CRF ?? 18);
const FFMPEG = process.env.FFMPEG ?? 'C:/ffmpeg/bin/ffmpeg.exe';
const ROOT = 'C:/Users/black/IdeaProjects/explainor-canvas/motion-canvas';
const SHOT_DIR = `${ROOT}/output/still/shot`;

if (SCENES.length === 0) {
  console.error('укажи сцену: node _render.mjs <sceneName> [...]');
  process.exit(1);
}
if (!existsSync(FFMPEG)) {
  console.error(`ffmpeg не найден: ${FFMPEG}`);
  process.exit(1);
}

function nextVideoFile() {
  const nums = readdirSync(`${ROOT}/output`)
    .map(f => f.match(/^video(\d+)\.mp4$/)?.[1])
    .filter(Boolean)
    .map(Number);
  return `${ROOT}/output/video${Math.max(0, ...nums) + 1}.mp4`;
}
const OUT = process.env.OUT_FILE ?? nextVideoFile();

function encode(dir, out) {
  const files = readdirSync(dir).filter(f => f.endsWith('.png')).sort();
  const args = [
    '-y', '-framerate', String(FPS), '-start_number', files[0].replace('.png', ''),
    '-i', `${dir}/%06d.png`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', out,
  ];
  const r = spawnSync(FFMPEG, args, {stdio: ['ignore', 'ignore', 'inherit']});
  if (r.status !== 0) throw new Error(`ffmpeg упал (код ${r.status})`);
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox'],
  // PROFILE — свой профиль браузера, если основной занят другим (зависшим) рендером
  userDataDir: process.env.PROFILE ?? `${ROOT}/.shot-profile`,
});
const page = await browser.newPage();
// Кадры забираем из страницы сами и пишем из Windows: путь через dev-сервер
// (браузер → vite в WSL → /mnt/c) стоит ~5 с на кадр, этот — десятки мс.
let frameDir = null;
await page.exposeFunction('__saveFrame', (name, dataUrl) => {
  writeFileSync(`${frameDir}/${name}.png`, Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
});
page.on('console', m => {
  const t = m.text();
  if (/error|exception/i.test(t) && !/favicon/.test(t)) console.log('  [console]', t);
});

async function waitShot(count) {
  const t0 = Date.now();
  let last = -1;
  for (;;) {
    const s = await page.evaluate(() => ({
      n: window.__SHOT?.results?.length ?? 0,
      done: window.__SHOT_DONE === true,
      error: window.__SHOT_ERROR ?? null,
    })).catch(() => null);   // страница перезагрузилась — раннер начнёт заново, ждём дальше
    if (!s) { await new Promise(r => setTimeout(r, 1000)); continue; }
    if (s.error) throw new Error(s.error);
    if (count && (s.n - last >= 300 || (s.done && s.n !== last))) {
      last = s.n;
      const el = (Date.now() - t0) / 1000;
      console.log(`  ${s.n}/${count} кадров · ${el.toFixed(0)} с`);
    }
    if (s.done) return;
    await new Promise(r => setTimeout(r, 1000));
  }
}

const segments = [];
try {
  for (const scene of SCENES) {
    // 1. длительность (shotRunner считает её только для sweep:)
    frameDir = `${SHOT_DIR}/_probe`;
    mkdirSync(frameDir, {recursive: true});
    await page.goto(
      `http://127.0.0.1:5173/shot.html?scene=${scene}&frames=sweep:2&fps=${FPS}&w=1920&h=1080&grid=off&out=_probe&timeoutMs=300000&hmr=off`,
      {waitUntil: 'domcontentloaded', timeout: 300000},
    );
    await waitShot(0);
    const duration = await page.evaluate(() => window.__SHOT?.duration ?? 0);
    rmSync(`${SHOT_DIR}/_probe`, {recursive: true, force: true});
    if (!(duration > 0)) throw new Error(`${scene}: не удалось определить длительность`);
    console.log(`${scene}: ${duration} кадров (${(duration / FPS).toFixed(2)} с)`);

    // 2. PNG-секвенция в чистую папку (FRAMES=a-b — только кусок)
    let [from, to] = [0, duration - 1];
    if (process.env.FRAMES) {
      [from, to] = process.env.FRAMES.split('-').map(Number);
      if (!(from >= 0 && to >= from && to < duration)) throw new Error(`FRAMES ${process.env.FRAMES} вне 0-${duration - 1}`);
      console.log(`  кусок: кадры ${from}-${to} (${((to - from + 1) / FPS).toFixed(2)} с)`);
    }
    const count = to - from + 1;
    const tag = `_render_${scene}`;
    const dir = `${SHOT_DIR}/${tag}`;
    rmSync(dir, {recursive: true, force: true});
    mkdirSync(dir, {recursive: true});
    frameDir = dir;
    await page.goto(
      `http://127.0.0.1:5173/shot.html?scene=${scene}&frames=${from}-${to}&fps=${FPS}&w=1920&h=1080&grid=off&out=${tag}&timeoutMs=900000&hmr=off`,
      {waitUntil: 'domcontentloaded', timeout: 300000},
    );
    await waitShot(count);
    const got = readdirSync(dir).filter(f => f.endsWith('.png')).length;
    if (got < count) throw new Error(`${scene}: ожидалось ${count} кадров, получено ${got}`);

    // 3. кодирование
    const seg = SCENES.length === 1 ? OUT : `${SHOT_DIR}/${tag}.mp4`;
    encode(dir, seg);
    segments.push(seg);
    if (!process.env.KEEP) rmSync(dir, {recursive: true, force: true});
  }
} finally {
  await browser.close();
}

// 4. склейка нескольких сцен (параметры кодирования одинаковые → без перекодирования)
if (segments.length > 1) {
  const list = `${SHOT_DIR}/_render_concat.txt`;
  writeFileSync(list, segments.map(s => `file '${s}'`).join('\n'));
  const r = spawnSync(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', OUT],
    {stdio: ['ignore', 'ignore', 'inherit']});
  if (r.status !== 0) throw new Error(`склейка упала (код ${r.status})`);
  for (const s of segments) rmSync(s, {force: true});
  rmSync(list, {force: true});
}
console.log(`готово: ${OUT}`);
