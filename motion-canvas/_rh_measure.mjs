// Report every text line of the Record Handling page in PAPER space (1672x2440,
// no tilt) with its word runs, so highlighter rects are placed on measured ink.
// The scene rotates them by TILT around the sheet centre.
import puppeteer from 'puppeteer';
import {readFileSync} from 'node:fs';

const PDF = 'C:/Users/black/AppData/Local/Temp/claude/C--Users-black-IdeaProjects-explainor-canvas/10025f88-07bd-46e3-8a70-a87e46f4daa2/scratchpad/record-handling.pdf';
const PDF_PAGE = 10;
const PAPER_W = 1672, PAPER_H = 2440;

const b64 = readFileSync(PDF).toString('base64');
const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox']});
const page = await browser.newPage();
page.on('console', m => console.log('  [pg]', m.text().slice(0,200)));
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'});

const lines = await page.evaluate(async (b64, pdfPage, PW, PH) => {
  const lib = window['pdfjs-dist/build/pdf'] ?? window.pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const doc = await lib.getDocument({data: Uint8Array.from(atob(b64), c => c.charCodeAt(0))}).promise;
  const p = await doc.getPage(pdfPage);
  const base = p.getViewport({scale: 1});
  const viewport = p.getViewport({scale: PW / base.width});
  const c = document.createElement('canvas');
  c.width = PW; c.height = PH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, PW, PH);
  await p.render({canvasContext: ctx, viewport}).promise;
  const d = ctx.getImageData(0, 0, PW, PH).data;
  const dark = (x, y) => d[(y * PW + x) * 4] < 140;
  {let mn=255,mx=0,cnt=0;for(let i=0;i<d.length;i+=4){if(d[i]<mn)mn=d[i];if(d[i]>mx)mx=d[i];if(d[i]<140)cnt++;}console.log(`probe min=${mn} max=${mx} darkpx=${cnt} canvas=${PW}x${PH}`);}

  // rows that carry ink (ignore the punch marks in the left margin)
  const X0 = 120;
  const rowInk = [];
  for (let y = 0; y < PH; y++) {
    let n = 0;
    for (let x = X0; x < PW; x++) if (dark(x, y)) n++;
    rowInk.push(n);
  }
  const out = [];
  let y0 = -1;
  for (let y = 0; y < PH; y++) {
    if (rowInk[y] > 25) { if (y0 < 0) y0 = y; }
    else if (y0 >= 0) {
      if (y - y0 >= 8) out.push([y0, y - 1]);
      y0 = -1;
    }
  }
  console.log(`rows>2=${rowInk.filter(v=>v>2).length} maxRow=${Math.max(...rowInk)} bands=${out.length}`);
  return out.map(([a, b], i) => {
    const ink = new Uint8Array(PW);
    for (let x = X0; x < PW; x++) for (let y = a; y <= b; y++) if (dark(x, y)) { ink[x] = 1; break; }
    const runs = [];
    let s = -1, gap = 0;
    for (let x = 0; x < PW; x++) {
      if (ink[x]) { if (s < 0) s = x; gap = 0; }
      else if (s >= 0) { gap++; if (gap > 9) { runs.push([s, x - gap]); s = -1; gap = 0; } }
    }
    if (s >= 0) runs.push([s, PW - 1]);
    return {i, y0: a, y1: b, x0: runs.length ? runs[0][0] : 0, x1: runs.length ? runs[runs.length - 1][1] : 0, runs};
  });
}, b64, PDF_PAGE, PAPER_W, PAPER_H);

for (const l of lines) {
  console.log(`#${String(l.i).padStart(2)}  y ${l.y0}-${l.y1}  x ${l.x0}-${l.x1}  runs ${l.runs.length}`);
}
console.log('\n--- runs of the lines we care about ---');
for (const idx of (process.argv.slice(2).map(Number).filter(Number.isFinite))) {
  const l = lines[idx];
  if (l) console.log(`#${idx} y ${l.y0}-${l.y1}: ${JSON.stringify(l.runs)}`);
}
await browser.close();
