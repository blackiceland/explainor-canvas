import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

// Usage: node measure.mjs <png> [yTopFrac yBotFrac] ...  measures text x-extent
const files = process.argv.slice(2).filter(a => a.endsWith('.png'));
const yTopFrac = parseFloat(process.argv.find(a => a.startsWith('top='))?.slice(4) ?? '0.12');
const yBotFrac = parseFloat(process.argv.find(a => a.startsWith('bot='))?.slice(4) ?? '0.88');
const TH = parseFloat(process.argv.find(a => a.startsWith('th='))?.slice(3) ?? '150');

const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
const page = await browser.newPage();
for (const f of files) {
  const abs = 'data:image/png;base64,' + fs.readFileSync(path.resolve(f)).toString('base64');
  const r = await page.evaluate(async (url, yTopFrac, yBotFrac, TH) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const W = img.width, H = img.height;
    const data = ctx.getImageData(0, 0, W, H).data;
    const yTop = Math.round(H * yTopFrac), yBot = Math.round(H * yBotFrac);
    const EDGE = 18;                        // ignore the editorial-frame tick zone at the very edges
    const ROW_MIN = 25;                     // a row is "text" only if it has >= this many bright px
    let minX = W, maxX = -1, minY = H, maxY = -1, count = 0;
    for (let y = yTop; y < yBot; y++) {
      let rowMin = W, rowMax = -1, rowCount = 0;
      for (let x = EDGE; x < W - EDGE; x++) {
        const i = (y * W + x) * 4;
        const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (luma > TH) { rowCount++; if (x < rowMin) rowMin = x; if (x > rowMax) rowMax = x; }
      }
      if (rowCount >= ROW_MIN) {            // a real text row, not a stray tick
        count += rowCount;
        if (rowMin < minX) minX = rowMin; if (rowMax > maxX) maxX = rowMax;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    return {W, H, minX, maxX, minY, maxY, count};
  }, abs, yTopFrac, yBotFrac, TH);
  const leftM = r.minX, rightM = r.W - 1 - r.maxX, width = r.maxX - r.minX + 1;
  const center = (r.minX + r.maxX) / 2;
  console.log(`${path.basename(f)}: leftMargin=${leftM} rightMargin=${rightM} width=${width} centerX=${center.toFixed(1)} (frame center=${(r.W/2).toFixed(0)}) yband=[${r.minY}..${r.maxY}] px=${r.count} TH=${TH}`);
}
await browser.close();
