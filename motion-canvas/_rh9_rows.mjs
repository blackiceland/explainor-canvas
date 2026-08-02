// Точные bbox печатных строк стр. 9 в координатах ЛИСТА (1672×2440).
// Нужны для: (а) хайлайта всех трёх строк объявления, (б) вычисления реального
// шага литеры машинописи — от него зависит кегль нашего набора при кроссфейде
// «печатная строка → наш код на том же месте и того же размера».
import puppeteer from 'puppeteer';
import {readFileSync} from 'node:fs';

const PDF = 'C:/Users/black/AppData/Local/Temp/claude/C--Users-black-IdeaProjects-explainor-canvas/10025f88-07bd-46e3-8a70-a87e46f4daa2/scratchpad/record-handling.pdf';
const PDF_PAGE = 10;
const PW = 1672, PH = 2440;
const Y0 = Number(process.argv[2] ?? 900);
const Y1 = Number(process.argv[3] ?? 1200);

const b64 = readFileSync(PDF).toString('base64');
const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox']});
const page = await browser.newPage();
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'});

const res = await page.evaluate(async (b64, pdfPage, PW, PH, Y0, Y1) => {
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

  // строки: ряды, где тёмных пикселей больше порога (скан спеклит, >25)
  const rowInk = [];
  for (let y = 0; y < PH; y++) {
    let n = 0;
    for (let x = 0; x < PW; x++) if (dark(x, y)) n++;
    rowInk.push(n);
  }
  const lines = [];
  let s = -1;
  for (let y = 0; y <= PH; y++) {
    const on = y < PH && rowInk[y] > 25;
    if (on) { if (s < 0) s = y; }
    else if (s >= 0) { if (y - s >= 8) lines.push({y0: s, y1: y - 1}); s = -1; }
  }
  return lines
    .filter(l => l.y1 >= Y0 && l.y0 <= Y1)
    .map(l => {
      // ⚠️ у скана тёмный край переплёта справа — считаем колонку «занятой»
      // только если в ней ≥2 тёмных пикселя, и режем поля листа.
      let ax = PW, bx = 0;
      for (let x = 60; x < PW - 120; x++) {
        let n = 0;
        for (let y = l.y0; y <= l.y1; y++) if (dark(x, y)) n++;
        if (n >= 2) { if (x < ax) ax = x; if (x > bx) bx = x; }
      }
      return {...l, x0: ax, x1: bx, cy: Math.round((l.y0 + l.y1) / 2), h: l.y1 - l.y0 + 1};
    });
}, b64, PDF_PAGE, PW, PH, Y0, Y1);

for (const l of res) console.log(`y ${l.y0}-${l.y1}  cy ${l.cy}  h ${l.h}  x ${l.x0}-${l.x1}  w ${l.x1 - l.x0}`);
await browser.close();
