import puppeteer from 'puppeteer';
import {readFileSync, writeFileSync} from 'fs';

const SRC = process.argv[2];
const OUT = process.argv[3];
const x = Number(process.argv[4] ?? 140);
const y = Number(process.argv[5] ?? 740);
const w = Number(process.argv[6] ?? 820);
const h = Number(process.argv[7] ?? 200);
const ZOOM = Number(process.argv[8] ?? 2);

const b64 = readFileSync(SRC).toString('base64');
const dataUrl = `data:image/png;base64,${b64}`;
const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
const page = await browser.newPage();
const out = await page.evaluate(async (dataUrl, x, y, w, h, ZOOM) => {
  const img = new Image(); img.src = dataUrl; await img.decode();
  const c = document.createElement('canvas');
  c.width = w * ZOOM; c.height = h * ZOOM;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x, y, w, h, 0, 0, w * ZOOM, h * ZOOM);
  return c.toDataURL('image/png');
}, dataUrl, x, y, w, h, ZOOM);
await browser.close();
writeFileSync(OUT, Buffer.from(out.split(',')[1], 'base64'));
console.log('wrote', OUT);
