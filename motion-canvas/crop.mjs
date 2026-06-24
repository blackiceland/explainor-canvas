import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

// crop.mjs <png> <x> <y> <w> <h> <outName>
const [file, X, Y, W, H, outName] = process.argv.slice(2);
const dataUrl = 'data:image/png;base64,' + fs.readFileSync(path.resolve(file)).toString('base64');
const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
const page = await browser.newPage();
const b64 = await page.evaluate(async (url, x, y, w, h) => {
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
  return c.toDataURL('image/png').split(',')[1];
}, dataUrl, +X, +Y, +W, +H);
await browser.close();
fs.writeFileSync(path.resolve(outName), Buffer.from(b64, 'base64'));
console.log('wrote ' + outName);
