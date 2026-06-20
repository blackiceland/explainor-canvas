import puppeteer from 'puppeteer';
import {readFileSync, writeFileSync} from 'fs';

const SRC = process.argv[2];
const OUT = process.argv[3];
// card region in the 1080x1920 frame
const x = 180, y = 330, w = 720, h = 440, ZOOM = 2;

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
