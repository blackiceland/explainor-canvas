// Measure ink extents on the ALGOL page so highlighter rects match the type
// instead of being eyeballed. Reports dark-pixel runs per horizontal band.
import puppeteer from 'puppeteer';
import {readFileSync} from 'node:fs';

const SRC = 'C:/Users/black/IdeaProjects/explainor-canvas/motion-canvas/public/hoare/algol-paper-horizontal-3200x1800.jpg';
const b64 = readFileSync(SRC).toString('base64');

const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox']});
const page = await browser.newPage();
const out = await page.evaluate(async b64 => {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = 'data:image/jpeg;base64,' + b64;
  });
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = new OffscreenCanvas(W, H);
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, W, H).data;
  const lum = (px, py) => 0.299 * d[(py * W + px) * 4] + 0.587 * d[(py * W + px) * 4 + 1] + 0.114 * d[(py * W + px) * 4 + 2];

  // runs of ink within a horizontal band, merged across gaps <= maxGap
  const runs = (y0, y1, maxGap, thr = 130) => {
    const ink = new Uint8Array(W);
    for (let px = 0; px < W; px++) {
      for (let py = y0; py <= y1; py++) {
        if (lum(px, py) < thr) { ink[px] = 1; break; }
      }
    }
    const res = [];
    let start = -1, gap = 0;
    for (let px = 0; px < W; px++) {
      if (ink[px]) {
        if (start < 0) start = px;
        gap = 0;
      } else if (start >= 0) {
        gap++;
        if (gap > maxGap) { res.push([start, px - gap]); start = -1; gap = 0; }
      }
    }
    if (start >= 0) res.push([start, W - 1]);
    return res.filter(r => r[1] - r[0] > 12);
  };

  // vertical ink extent of a column range (to place the marker height)
  const vExtent = (x0, x1, y0, y1, thr = 130) => {
    let top = -1, bot = -1;
    for (let py = y0; py <= y1; py++) {
      let any = false;
      for (let px = x0; px <= x1; px++) if (lum(px, py) < thr) { any = true; break; }
      if (any) { if (top < 0) top = py; bot = py; }
    }
    return [top, bot];
  };

  // page (white sheet) bounds: bright pixels
  const sheet = (() => {
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    for (let py = 0; py < H; py += 4) {
      for (let px = 0; px < W; px += 4) {
        if (lum(px, py) > 205) {
          if (px < x0) x0 = px; if (px > x1) x1 = px;
          if (py < y0) y0 = py; if (py > y1) y1 = py;
        }
      }
    }
    return {x0, x1, y0, y1};
  })();

  const corner = px => [d[px * 4], d[px * 4 + 1], d[px * 4 + 2]];
  return {
    W, H, sheet,
    margin: {
      tl: corner(20 * W + 20),
      tr: corner(20 * W + (W - 20)),
      bl: corner((H - 20) * W + 20),
      br: corner((H - 20) * W + (W - 20)),
      midLeft: corner(((H / 2) | 0) * W + 20),
      midTop: corner(20 * W + ((W / 2) | 0)),
    },
    title: {runs: runs(340, 385, 60), v: vExtent(1100, 2100, 330, 395)},
    authors: {runs: runs(392, 425, 60), v: vExtent(1700, 2000, 385, 432)},
    footer: {runs: runs(1630, 1665, 7), v: vExtent(950, 1500, 1620, 1680)},
  };
}, b64);
console.log(JSON.stringify(out, null, 1));
await browser.close();
