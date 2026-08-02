// Точные bbox элементов схемы Хоара (стр. 11) в координатах ЛИСТА (1672×2440).
// Схема — не текст, построчная сегментация тут не работает: коробки стоят на
// разной высоте. Поэтому ищем ЯЩИКИ по длинным горизонтальным линиям (он чертил
// их по линейке), а внутри ящиков — строки-отсеки и краску в них.
import puppeteer from 'puppeteer';
import {readFileSync} from 'node:fs';

const PDF = 'C:/Users/black/AppData/Local/Temp/claude/C--Users-black-IdeaProjects-explainor-canvas/10025f88-07bd-46e3-8a70-a87e46f4daa2/scratchpad/record-handling.pdf';
const PDF_PAGE = 12;
const PW = 1672, PH = 2440;

const b64 = readFileSync(PDF).toString('base64');
const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox']});
const page = await browser.newPage();
page.on('console', m => console.log('  [pg]', m.text().slice(0, 300)));
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'});

const res = await page.evaluate(async (b64, pdfPage, PW, PH) => {
  const lib = window['pdfjs-dist/build/pdf'] ?? window.pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const doc = await lib.getDocument({data: Uint8Array.from(atob(b64), c => c.charCodeAt(0))}).promise;
  const p = await doc.getPage(pdfPage);
  const base = p.getViewport({scale: 1});
  const c = document.createElement('canvas');
  c.width = PW; c.height = PH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, PW, PH);
  await p.render({canvasContext: ctx, viewport: p.getViewport({scale: PW / base.width})}).promise;
  const d = ctx.getImageData(0, 0, PW, PH).data;
  const dark = (x, y) => d[(y * PW + x) * 4] < 140;

  // горизонтальные отрезки: в строке ищем непрерывные тёмные пробеги длиннее MIN
  const MIN = 90;
  const segs = [];
  for (let y = 0; y < PH; y++) {
    let s = -1;
    for (let x = 0; x <= PW; x++) {
      const on = x < PW && dark(x, y);
      if (on) { if (s < 0) s = x; }
      else if (s >= 0) { if (x - s >= MIN) segs.push({y, x0: s, x1: x - 1}); s = -1; }
    }
  }
  // группируем отрезки в «ящики»: одинаковый x-диапазон (±14), сортировка по y
  const boxes = [];
  for (const sg of segs) {
    let b = boxes.find(bb => Math.abs(bb.x0 - sg.x0) < 16 && Math.abs(bb.x1 - sg.x1) < 16);
    if (!b) { b = {x0: sg.x0, x1: sg.x1, rows: []}; boxes.push(b); }
    b.rows.push(sg.y);
  }
  // склеиваем соседние y в одну линию
  const merged = boxes.map(b => {
    const ys = [...new Set(b.rows)].sort((a, z) => a - z);
    const lines = [];
    let run = [ys[0]];
    for (let i = 1; i < ys.length; i++) {
      if (ys[i] - ys[i - 1] <= 3) run.push(ys[i]);
      else { lines.push(Math.round(run.reduce((s, v) => s + v, 0) / run.length)); run = [ys[i]]; }
    }
    lines.push(Math.round(run.reduce((s, v) => s + v, 0) / run.length));
    return {x0: b.x0, x1: b.x1, lines};
  }).filter(b => b.lines.length >= 3);

  // краска внутри отсека (между двумя соседними линиями), с полями
  const inkIn = (x0, x1, y0, y1) => {
    let ax = PW, bx = 0, ay = PH, by = 0, n = 0;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (dark(x, y)) { n++; if (x < ax) ax = x; if (x > bx) bx = x; if (y < ay) ay = y; if (y > by) by = y; }
    return n < 12 ? null : {x0: ax, x1: bx, y0: ay, y1: by, n};
  };

  const out = merged
    .sort((a, z) => a.lines[0] - z.lines[0])
    .map(b => ({
      x0: b.x0, x1: b.x1,
      top: b.lines[0], bottom: b.lines[b.lines.length - 1],
      cells: b.lines.slice(0, -1).map((y, i) => {
        const y2 = b.lines[i + 1];
        return {y0: y, y1: y2, ink: inkIn(b.x0 + 6, b.x1 - 6, y + 4, y2 - 4)};
      }),
    }));
  return out;
}, b64, PDF_PAGE, PW, PH);

for (const b of res) {
  console.log(`box x ${b.x0}-${b.x1}  y ${b.top}-${b.bottom}  cells ${b.cells.length}`);
  b.cells.forEach((c, i) => {
    const k = c.ink;
    console.log(`   cell${i} y ${c.y0}-${c.y1}  ${k ? `ink x ${k.x0}-${k.x1} y ${k.y0}-${k.y1} (n=${k.n})` : 'EMPTY'}`);
  });
}
await browser.close();
