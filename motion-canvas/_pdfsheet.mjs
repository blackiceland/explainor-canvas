// Contact sheet of scanned PDF pages, to locate the interesting ones cheaply.
//   node _pdfsheet.mjs <pdf> <out.png> <from> <to> [cols] [cellW]
import puppeteer from 'puppeteer';
import {readFileSync, writeFileSync} from 'node:fs';

const [pdfPath, outFile, fromArg, toArg, colsArg, cellArg] = process.argv.slice(2);
const from = Number(fromArg ?? 1);
const to = Number(toArg ?? from);
const cols = Number(colsArg ?? 4);
const cellW = Number(cellArg ?? 620);

const b64 = readFileSync(pdfPath).toString('base64');
const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox']});
const page = await browser.newPage();
page.on('console', m => console.log('  [pg]', m.text().slice(0, 200)));
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'});

const data = await page.evaluate(async (b64, from, to, cols, cellW) => {
  const lib = window['pdfjs-dist/build/pdf'] ?? window.pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const doc = await lib.getDocument({data: bin}).promise;
  const last = Math.min(to, doc.numPages);
  const n = last - from + 1;
  const rows = Math.ceil(n / cols);

  const probe = await doc.getPage(from);
  const pv = probe.getViewport({scale: 1});
  const cellH = Math.round((cellW * pv.height) / pv.width);
  const LABEL = 26;

  const sheet = document.createElement('canvas');
  sheet.width = cols * cellW;
  sheet.height = rows * (cellH + LABEL);
  const sx = sheet.getContext('2d');
  sx.fillStyle = '#888';
  sx.fillRect(0, 0, sheet.width, sheet.height);

  for (let i = 0; i < n; i++) {
    const p = await doc.getPage(from + i);
    const base = p.getViewport({scale: 1});
    const viewport = p.getViewport({scale: cellW / base.width});
    const c = document.createElement('canvas');
    c.width = Math.round(viewport.width);
    c.height = Math.round(viewport.height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    await p.render({canvasContext: ctx, viewport}).promise;
    const col = i % cols;
    const row = (i / cols) | 0;
    const x = col * cellW;
    const y = row * (cellH + LABEL);
    sx.fillStyle = '#111';
    sx.fillRect(x, y, cellW, LABEL);
    sx.fillStyle = '#fff';
    sx.font = 'bold 18px monospace';
    sx.fillText(`pdf p${from + i}`, x + 8, y + 19);
    sx.drawImage(c, x, y + LABEL, cellW, cellH);
  }
  return {png: sheet.toDataURL('image/png').split(',')[1], total: doc.numPages};
}, b64, from, to, cols, cellW);

writeFileSync(outFile, Buffer.from(data.png, 'base64'));
console.log('wrote', outFile, '| total pages', data.total);
await browser.close();
