// Render pages of a scanned PDF to PNG (no poppler): pdf.js inside puppeteer.
//   node _pdfpages.mjs <pdf> <outDir> <from> <to> [widthPx]
import puppeteer from 'puppeteer';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';

const [pdfPath, outDir, fromArg, toArg, widthArg] = process.argv.slice(2);
const from = Number(fromArg ?? 1);
const to = Number(toArg ?? from);
const targetW = Number(widthArg ?? 1500);

mkdirSync(outDir, {recursive: true});
const b64 = readFileSync(pdfPath).toString('base64');

const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox']});
const page = await browser.newPage();
page.on('console', m => console.log('  [pg]', m.text().slice(0, 200)));
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'});

const pages = await page.evaluate(async (b64, from, to, targetW) => {
  const lib = window['pdfjs-dist/build/pdf'] ?? window.pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const doc = await lib.getDocument({data: bin}).promise;
  const out = [];
  for (let n = from; n <= Math.min(to, doc.numPages); n++) {
    const p = await doc.getPage(n);
    const base = p.getViewport({scale: 1});
    const viewport = p.getViewport({scale: targetW / base.width});
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await p.render({canvasContext: ctx, viewport}).promise;
    out.push({n, data: canvas.toDataURL('image/png').split(',')[1]});
  }
  return {total: doc.numPages, out};
}, b64, from, to, targetW);

for (const p of pages.out) {
  const f = `${outDir}/p${String(p.n).padStart(3, '0')}.png`;
  writeFileSync(f, Buffer.from(p.data, 'base64'));
  console.log('wrote', f);
}
console.log('total pages:', pages.total);
await browser.close();
