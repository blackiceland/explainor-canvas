// Замер: сколько редактор Motion Canvas грузится и куда уходит время.
//
// ⚠️ Изолирован от вкладки автора: свой userDataDir + подмена WebSocket.send,
// которая режет `motion-canvas:meta`. Значит этот прогон НЕ пишет .meta и не
// шлёт HMR в открытый редактор автора.
//
//   node _probe_editor.mjs [url]
import puppeteer from 'puppeteer';

const URL = process.argv[2] ?? 'http://127.0.0.1:5173/';
const ROOT = 'C:/Users/black/IdeaProjects/explainor-canvas/motion-canvas';
const BUDGET_MS = 300_000;

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox'],
  userDataDir: `${ROOT}/.probe-editor-profile`,
});
const page = await browser.newPage();
await page.setViewport({width: 1600, height: 1000});

// глушим запись метаданных ДО загрузки любого модуля
await page.evaluateOnNewDocument(() => {
  const send = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    if (typeof data === 'string' && data.indexOf('motion-canvas:meta') !== -1) return;
    return send.apply(this, arguments);
  };
  window.__req = {count: 0, bytes: 0, byExt: {}};
});

let reqCount = 0;
const byExt = {};
const slow = [];
page.on('request', r => {
  reqCount++;
  const u = r.url();
  const ext = (u.split('?')[0].match(/\.([a-z0-9]+)$/i) ?? [, 'other'])[1].toLowerCase();
  byExt[ext] = (byExt[ext] ?? 0) + 1;
});
page.on('requestfinished', async r => {
  try {
    const t = r.timing();
    if (t && t.receiveHeadersEnd - t.requestTime * 0 > 0) {
      const ms = t.receiveHeadersEnd;
      if (ms > 500) slow.push({url: r.url().slice(-90), ms: Math.round(ms)});
    }
  } catch {}
});
const errors = [];
page.on('console', m => {
  const t = m.text();
  if (/error|fail|exception|timeout/i.test(t)) errors.push(t.slice(0, 160));
});
page.on('pageerror', e => errors.push('PAGEERROR ' + String(e).slice(0, 160)));

const t0 = Date.now();
await page.goto(URL, {waitUntil: 'domcontentloaded', timeout: BUDGET_MS});
const domMs = Date.now() - t0;

// ждём, пока в DOM появится канвас плеера и он перестанет быть пустым
let readyMs = null;
let lastState = 'no-canvas';
const deadline = Date.now() + BUDGET_MS;
while (Date.now() < deadline) {
  const st = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return {state: 'no-canvas'};
    if (c.width < 2 || c.height < 2) return {state: 'canvas-empty', w: c.width, h: c.height};
    return {state: 'canvas', w: c.width, h: c.height, n: document.querySelectorAll('canvas').length};
  });
  lastState = st.state;
  if (st.state === 'canvas') { readyMs = Date.now() - t0; break; }
  await new Promise(r => setTimeout(r, 250));
}

// ждём, пока на канвасе появится РЕАЛЬНАЯ картинка (не однотонная заливка)
let paintedMs = null;
let lastPaint = 'n/a';
const pDeadline = Date.now() + BUDGET_MS;
while (Date.now() < pDeadline) {
  const st = await page.evaluate(() => {
    const cs = [...document.querySelectorAll('canvas')];
    // берём самый большой канвас — это плеер
    const c = cs.sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!c || c.width < 2) return {ok: false, why: 'no-canvas'};
    const off = document.createElement('canvas');
    off.width = 64;
    off.height = 36;
    const g = off.getContext('2d');
    try {
      g.drawImage(c, 0, 0, 64, 36);
    } catch (e) {
      return {ok: false, why: 'draw-failed'};
    }
    const d = g.getImageData(0, 0, 64, 36).data;
    let min = 255;
    let max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return {ok: max - min > 8, why: `spread=${Math.round(max - min)}`, w: c.width, h: c.height};
  });
  lastPaint = st.why;
  if (st.ok) { paintedMs = Date.now() - t0; break; }
  await new Promise(r => setTimeout(r, 250));
}

// сколько модулей реально загрузилось и сколько это байт
const perf = await page.evaluate(() => {
  const es = performance.getEntriesByType('resource');
  const byType = {};
  let total = 0;
  for (const e of es) {
    const ext = (e.name.split('?')[0].match(/\.([a-z0-9]+)$/i) ?? [, 'other'])[1].toLowerCase();
    byType[ext] = byType[ext] ?? {n: 0, ms: 0};
    byType[ext].n++;
    byType[ext].ms += e.duration;
    total += e.duration;
  }
  const top = es
    .map(e => ({name: e.name.slice(-95), ms: Math.round(e.duration)}))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 12);
  return {
    resources: es.length,
    totalResourceMs: Math.round(total),
    byType: Object.fromEntries(
      Object.entries(byType)
        .map(([k, v]) => [k, {n: v.n, ms: Math.round(v.ms)}])
        .sort((a, b) => b[1].ms - a[1].ms)
        .slice(0, 10),
    ),
    top,
    nav: performance.getEntriesByType('navigation')[0]?.toJSON?.() ?? null,
  };
});

console.log(`URL                     ${URL}`);
console.log(`DOMContentLoaded        ${domMs} ms`);
console.log(`канвас плеера готов     ${readyMs ?? 'НЕ ДОЖДАЛСЯ (' + lastState + ')'} ${readyMs ? 'ms' : ''}`);
console.log(`сцена НАРИСОВАНА        ${paintedMs ?? 'НЕ ДОЖДАЛСЯ (' + lastPaint + ')'} ${paintedMs ? 'ms' : ''}`);
console.log(`сетевых запросов        ${perf.resources} (page.on: ${reqCount})`);
console.log(`суммарно на ресурсы     ${perf.totalResourceMs} ms`);
console.log(`по типам                ${JSON.stringify(perf.byType)}`);
console.log(`расширения запросов     ${JSON.stringify(byExt)}`);
console.log('--- самые долгие ресурсы ---');
for (const t of perf.top) console.log(`  ${String(t.ms).padStart(6)} ms  ${t.name}`);
if (errors.length) {
  console.log(`--- консоль (${errors.length}) ---`);
  for (const e of errors.slice(0, 12)) console.log('  ' + e);
}
await browser.close();
