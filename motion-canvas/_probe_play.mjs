// Проверка плеера: грузится ли, идёт ли реальное время, рисует ли кадры.
//   node _probe_play.mjs <scene> [секунд наблюдения]
import puppeteer from 'puppeteer';

const ROOT = 'C:/Users/black/IdeaProjects/explainor-canvas/motion-canvas';
const SCENE = process.argv[2] ?? 'introMergeScene';
const WATCH_S = Number(process.argv[3] ?? 6);
const SHOT =
  'C:/Users/black/AppData/Local/Temp/claude/C--Users-black-IdeaProjects-explainor-canvas/10025f88-07bd-46e3-8a70-a87e46f4daa2/scratchpad/_play_' +
  SCENE +
  '.png';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox'],
  userDataDir: `${ROOT}/.probe-editor-profile`,
});
const page = await browser.newPage();
await page.setViewport({width: 1440, height: 900});
const errors = [];
page.on('console', m => { const t = m.text(); if (/error|fail|exception/i.test(t)) errors.push(t.slice(0, 140)); });
page.on('pageerror', e => errors.push('PAGEERROR ' + String(e).slice(0, 140)));

const t0 = Date.now();
await page.goto(`http://127.0.0.1:5173/play.html?scene=${SCENE}&from=0`, {waitUntil: 'domcontentloaded', timeout: 60000});
await page.waitForFunction(() => window.__PLAY != null || document.querySelector('.err'), {timeout: 120000}).catch(() => null);
const boot = await page.evaluate(() => {
  const p = window.__PLAY;
  const err = document.querySelector('.err');
  return err ? {error: err.textContent.slice(0, 200)} : p ? {duration: p.duration, fps: p.fps} : {error: 'no __PLAY'};
});
console.log(`boot ${Date.now() - t0} ms  ${JSON.stringify(boot)}`);
if (!('error' in boot)) {
  const samples = [];
  for (let i = 0; i < WATCH_S; i++) {
    await new Promise(r => setTimeout(r, 1000));
    samples.push(await page.evaluate(() => window.__PLAY.frame()));
  }
  console.log(`кадр по секундам:  ${samples.join(' → ')}  (ожидание ~+${boot.fps}/с)`);
  await page.screenshot({path: SHOT});
  console.log(`скрин: ${SHOT}`);
}
if (errors.length) { console.log('консоль:'); errors.slice(0, 8).forEach(e => console.log('  ' + e)); }
await browser.close();
