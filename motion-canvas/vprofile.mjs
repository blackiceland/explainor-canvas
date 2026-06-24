import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

// Segment a frame into vertical content bands. Usage: node vprofile.mjs <png> [th] [xL] [xR] [minCount] [gap]
const file = process.argv[2];
const TH = Number(process.argv[3] ?? 110);     // luma > TH = real content (grid/bg below this)
const xL = Number(process.argv[4] ?? 150);     // ignore editorial-frame edge ticks
const xR = Number(process.argv[5] ?? 930);
const MIN = Number(process.argv[6] ?? 12);     // a row is "on" if it has >= MIN bright px
const MERGE = Number(process.argv[7] ?? 18);   // merge bands separated by < MERGE empty rows

const dataUrl = 'data:image/png;base64,' + fs.readFileSync(path.resolve(file)).toString('base64');
const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
const page = await browser.newPage();
const rows = await page.evaluate(async (url, TH, xL, xR, MIN) => {
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const W = img.width, H = img.height, data = ctx.getImageData(0, 0, W, H).data;
  const on = [];
  for (let y = 0; y < H; y++) {
    let cnt = 0, minx = W, maxx = -1;
    for (let x = xL; x < xR; x++) {
      const i = (y * W + x) * 4;
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (luma > TH) { cnt++; if (x < minx) minx = x; if (x > maxx) maxx = x; }
    }
    on.push(cnt >= MIN ? {cnt, minx, maxx} : null);
  }
  return {H, on};
}, dataUrl, TH, xL, xR, MIN);
await browser.close();

// merge consecutive on-rows into bands (allowing small gaps)
const bands = [];
let cur = null, gap = 0;
for (let y = 0; y < rows.H; y++) {
  if (rows.on[y]) {
    if (!cur) cur = {top: y, bot: y, minx: rows.on[y].minx, maxx: rows.on[y].maxx};
    else { cur.bot = y; cur.minx = Math.min(cur.minx, rows.on[y].minx); cur.maxx = Math.max(cur.maxx, rows.on[y].maxx); }
    gap = 0;
  } else if (cur) {
    gap++;
    if (gap > MERGE) { bands.push(cur); cur = null; }
  }
}
if (cur) bands.push(cur);
console.log(`frame H=${rows.H}  bands (frame-y; sceneY = y-960):`);
for (let i = 0; i < bands.length; i++) {
  const b = bands[i];
  const gapAbove = i === 0 ? b.top : b.top - bands[i - 1].bot;
  console.log(`  [${String(b.top).padStart(4)}..${String(b.bot).padStart(4)}] h=${String(b.bot-b.top).padStart(3)}  x=[${b.minx}..${b.maxx}]  gapAbove=${gapAbove}`);
}
