import puppeteer from 'puppeteer';
import {readFileSync, writeFileSync} from 'fs';

const SRC = 'C:/Users/black/Downloads/a03fdb53ef43b56a4159abadbfac64a0.jpg';
const OUT = 'C:/Users/black/IdeaProjects/explainor-canvas/motion-canvas/public/avatar-anna.jpg';

// face-centred square crop in SOURCE px (565x753). cx,cy ~ face centre; SIDE = square edge.
const cx = Number(process.argv[2] ?? 257);
const cy = Number(process.argv[3] ?? 255);
const SIDE = Number(process.argv[4] ?? 300);
const TARGET = 256;            // shrunk output

const b64 = readFileSync(SRC).toString('base64');
const dataUrl = `data:image/jpeg;base64,${b64}`;

const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
const page = await browser.newPage();
const out = await page.evaluate(async (dataUrl, cx, cy, SIDE, TARGET) => {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const sx = cx - SIDE / 2, sy = cy - SIDE / 2;
  const c = document.createElement('canvas');
  c.width = TARGET; c.height = TARGET;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, SIDE, SIDE, 0, 0, TARGET, TARGET);
  return c.toDataURL('image/jpeg', 0.92);
}, dataUrl, cx, cy, SIDE, TARGET);
await browser.close();

const buf = Buffer.from(out.split(',')[1], 'base64');
writeFileSync(OUT, buf);
console.log('wrote', OUT, buf.length, 'bytes | crop', {cx, cy, SIDE, TARGET});
