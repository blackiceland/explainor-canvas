// Asset prep for Hoare's "Record Handling" (NATO Summer School, Sept 1966), p.9 —
// the page that carries the whole argument: the `record class person` declaration,
// partial functional relationships, and the introduction of `null`.
//
// The source is a bilevel CCITT scan: pure black on pure white. Dropped in raw it
// reads as a screenshot next to the ALGOL plate (a photographed sheet on a grey
// surface). So we match that plate: warm paper tone, grain, soft vignette, a
// fraction of a degree of rotation, drop shadow on the same grey field.
//
// Output: public/hoare/record-handling-p9-4800x2700.jpg
//   (4800×2700 so there is real resolution to zoom into body copy; scene draws it
//    at RH_S = 0.4 to fill 1920×1080)
import puppeteer from 'puppeteer';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';

const PDF = 'C:/Users/black/AppData/Local/Temp/claude/C--Users-black-IdeaProjects-explainor-canvas/10025f88-07bd-46e3-8a70-a87e46f4daa2/scratchpad/record-handling.pdf';
const OUT_DIR = 'C:/Users/black/IdeaProjects/explainor-canvas/motion-canvas/public/hoare';
const PDF_PAGE = Number(process.argv[2] ?? 10);   // pdf 10 = док. стр. 9, pdf 12 = стр. 11
const W = 4800, H = 2700;
const PAPER_H = 2440;         // sheet height inside the frame
const TILT = -0.45;           // degrees

mkdirSync(OUT_DIR, {recursive: true});
const b64 = readFileSync(PDF).toString('base64');

const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox']});
const page = await browser.newPage();
page.on('console', m => console.log('  [pg]', m.text().slice(0, 200)));
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'});

const out = await page.evaluate(async (b64, pdfPage, W, H, PAPER_H, TILT) => {
  const lib = window['pdfjs-dist/build/pdf'] ?? window.pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const doc = await lib.getDocument({data: Uint8Array.from(atob(b64), c => c.charCodeAt(0))}).promise;
  const p = await doc.getPage(pdfPage);
  const base = p.getViewport({scale: 1});
  const ratio = base.width / base.height;
  const paperW = Math.round(PAPER_H * ratio);

  // render at 2× then downsample — the scan is 3185px wide, so there is detail to keep
  const viewport = p.getViewport({scale: (paperW * 2) / base.width});
  const src = document.createElement('canvas');
  src.width = Math.round(viewport.width);
  src.height = Math.round(viewport.height);
  const sctx = src.getContext('2d');
  sctx.fillStyle = '#fff';
  sctx.fillRect(0, 0, src.width, src.height);
  await p.render({canvasContext: sctx, viewport}).promise;

  // ── paper: bilevel -> warm stock with ink that is not pure black ──────
  const paper = document.createElement('canvas');
  paper.width = paperW;
  paper.height = PAPER_H;
  const pctx = paper.getContext('2d');
  pctx.imageSmoothingEnabled = true;
  pctx.imageSmoothingQuality = 'high';
  pctx.drawImage(src, 0, 0, paperW, PAPER_H);

  const img = pctx.getImageData(0, 0, paperW, PAPER_H);
  const d = img.data;
  const PAPER = [234, 226, 209];
  const INK = [38, 36, 33];
  let seed = 20240912;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let y = 0; y < PAPER_H; y++) {
    // paper is never evenly lit: a very low-frequency gradient across the sheet
    const ly = y / PAPER_H;
    for (let x = 0; x < paperW; x++) {
      const i = (y * paperW + x) * 4;
      const t = d[i] / 255;                      // 1 = paper, 0 = ink
      const lx = x / paperW;
      const lift = 1 - 0.085 * (lx * 0.55 + ly * 0.45);   // slight fall-off to bottom-right
      // vignette on the sheet edges
      const ex = Math.min(lx, 1 - lx) / 0.16;
      const ey = Math.min(ly, 1 - ly) / 0.13;
      const edge = 1 - 0.17 * (1 - Math.min(1, Math.min(ex, ey)));
      const n = (rnd() - 0.5) * 17;              // grain
      for (let c = 0; c < 3; c++) {
        const v = INK[c] + (PAPER[c] - INK[c]) * t;
        d[i + c] = Math.max(0, Math.min(255, v * lift * edge + n * (0.35 + 0.65 * t)));
      }
      d[i + 3] = 255;
    }
  }
  pctx.putImageData(img, 0, 0);

  // ── frame: the same grey field as the ALGOL plate ────────────────────
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W * 0.35, H);
  g.addColorStop(0, 'rgb(219,219,220)');
  g.addColorStop(0.55, 'rgb(207,207,209)');
  g.addColorStop(1, 'rgb(197,197,199)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // grain on the surface too, otherwise the flat field betrays the composite
  const surf = ctx.getImageData(0, 0, W, H);
  const sd = surf.data;
  for (let i = 0; i < sd.length; i += 4) {
    const n = (rnd() - 0.5) * 9;
    sd[i] += n; sd[i + 1] += n; sd[i + 2] += n;
  }
  ctx.putImageData(surf, 0, 0);

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate((TILT * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,0.34)';
  ctx.shadowBlur = 58;
  ctx.shadowOffsetX = 10;
  ctx.shadowOffsetY = 26;
  ctx.drawImage(paper, -paperW / 2, -PAPER_H / 2);
  ctx.restore();

  const blob = await out.convertToBlob
    ? await out.convertToBlob({type: 'image/jpeg', quality: 0.94})
    : await new Promise(res => out.toBlob(res, 'image/jpeg', 0.94));
  const b = await new Promise(res => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result.split(',')[1]);
    fr.readAsDataURL(blob);
  });
  return {b64: b, paperW, paperH: PAPER_H, cx: W / 2, cy: H / 2, tilt: TILT};
}, b64, PDF_PAGE, W, H, PAPER_H, TILT);

writeFileSync(`${OUT_DIR}/${process.argv[3] ?? "record-handling-p9"}-${W}x${H}.jpg`, Buffer.from(out.b64, 'base64'));
console.log(`sheet ${out.paperW}x${out.paperH} centred at ${out.cx},${out.cy}, tilt ${out.tilt}deg`);
console.log(`wrote ${OUT_DIR}/${process.argv[3] ?? "record-handling-p9"}-${W}x${H}.jpg`);
await browser.close();
