import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

// Find exact card-PANEL top/bottom edges (the SURFACE fill rectangle, brighter than BG) and
// the code function-line tops, in a frame. Reports the TRUE panel-bottom -> method-top gaps.
const file = process.argv[2];
const dataUrl = 'data:image/png;base64,' + fs.readFileSync(path.resolve(file)).toString('base64');
const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
const page = await browser.newPage();
const out = await page.evaluate(async (url) => {
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const W = img.width, H = img.height, d = ctx.getImageData(0, 0, W, H).data;
  const luma = (x, y) => { const i = (y * W + x) * 4; return 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2]; };
  // Card x-band: cards span ~x 200..880. Sample the panel interior column band 300..760.
  const xL = 300, xR = 760;
  // For each row, count panel-fill pixels (luma 29..50: SURFACE is ~33, BG ~26, text >80 excluded
  // so we measure the SLAB not the glyphs). A panel row has nearly the whole band filled.
  const rowFill = [];
  for (let y = 0; y < H; y++) {
    let cnt = 0;
    for (let x = xL; x < xR; x++) { const L = luma(x, y); if (L >= 29) cnt++; }
    rowFill.push(cnt / (xR - xL));   // fraction of band that is panel-or-brighter
  }
  // Panel rows = fraction > 0.6 (the slab fills the band). Find contiguous panel bands.
  const bands = [];
  let cur = null;
  for (let y = 0; y < H; y++) {
    if (rowFill[y] > 0.6) { if (!cur) cur = {top: y, bot: y}; else cur.bot = y; }
    else if (cur) { if (cur.bot - cur.top > 80) bands.push(cur); cur = null; }
  }
  if (cur && cur.bot - cur.top > 80) bands.push(cur);
  // Code function-line tops: scan full width for bright code glyphs (luma>90) in the code regions
  // (between/around the panels). A code row has some bright px but does NOT fill the band.
  const codeRows = [];
  for (let y = 0; y < H; y++) {
    let cnt = 0, minx = W, maxx = -1;
    for (let x = 120; x < 960; x++) { if (luma(x, y) > 95) { cnt++; if (x<minx) minx=x; if (x>maxx) maxx=x; } }
    codeRows.push(cnt >= 8 ? {minx, maxx} : null);
  }
  // group code rows into line bands
  const codeBands = [];
  let cc = null, gap = 0;
  for (let y = 0; y < H; y++) {
    if (codeRows[y]) { if (!cc) cc = {top:y, bot:y, minx:codeRows[y].minx, maxx:codeRows[y].maxx}; else {cc.bot=y; cc.minx=Math.min(cc.minx,codeRows[y].minx); cc.maxx=Math.max(cc.maxx,codeRows[y].maxx);} gap=0; }
    else if (cc) { gap++; if (gap>14){ codeBands.push(cc); cc=null; } }
  }
  if (cc) codeBands.push(cc);
  return {bands, codeBands};
}, dataUrl);
await browser.close();

console.log('CARD PANELS (slab top..bot, frame-y):');
for (const b of out.bands) console.log(`  panel [${b.top}..${b.bot}]  h=${b.bot-b.top}  centerY=${((b.top+b.bot)/2).toFixed(0)}`);
console.log('CODE LINES (top..bot, x-extent):');
for (const b of out.codeBands) console.log(`  line  [${b.top}..${b.bot}]  x=[${b.minx}..${b.maxx}]  w=${b.maxx-b.minx}  cx=${((b.minx+b.maxx)/2).toFixed(0)}`);

// Pair panels with the nearest code line BELOW them and report the gap.
console.log('\nPANEL-BOTTOM -> NEXT-CODE-LINE-TOP gaps:');
for (const p of out.bands) {
  const below = out.codeBands.filter(l => l.top > p.bot).sort((a,b)=>a.top-b.top)[0];
  if (below) console.log(`  panel bot ${p.bot} -> code top ${below.top}  GAP=${below.top - p.bot}`);
}
