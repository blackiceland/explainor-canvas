// One-off asset prep for the Hoare prologue:
//  - stretch all three plates to exactly 3200x1350
//  - key the chroma-green cutout -> transparent PNG (despill + grayscale edges)
//  - align background plate and cutout to the full reference plate (SAD solver),
//    bake the relative offset into the cutout so bg+cutout share ONE coordinate space
//  - report the figure bbox (for composition constants in the scene)
// Outputs: public/hoare/hoare-background-3200x1350.jpg, public/hoare/hoare-cutout-3200x1350.png
import puppeteer from 'puppeteer';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';

const SRC = 'C:/Users/black/Downloads/hoar';
const FULL = `${SRC}/2455a709-f73c-4a6d-a1b4-f0b4dfcc5580.png`;   // man in scene (reference)
const GREEN = `${SRC}/ce19d846-99fc-4193-9c0f-46b17ad82601.png`;  // man on chroma green
const EMPTY = `${SRC}/e893be52-416d-476d-a8c3-f313b0dce5cf.png`;  // room without man, shadow kept
const OUT_DIR = 'C:/Users/black/IdeaProjects/explainor-canvas/motion-canvas/public/hoare';
const W = 3200, H = 1350;

mkdirSync(OUT_DIR, {recursive: true});

const b64 = p => readFileSync(p).toString('base64');

const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox']});
const page = await browser.newPage();
page.on('console', m => console.log('  [pg]', m.text().slice(0, 300)));

const result = await page.evaluate(async (fullB64, greenB64, emptyB64, W, H) => {
  const load = b64 => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = 'data:image/png;base64,' + b64;
  });
  const [imgFull, imgGreen, imgEmpty] = await Promise.all([load(fullB64), load(greenB64), load(emptyB64)]);

  const draw = img => {
    const c = new OffscreenCanvas(W, H);
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, W, H);
    return {c, d: x.getImageData(0, 0, W, H)};
  };
  const full = draw(imgFull);
  const green = draw(imgGreen);
  const empty = draw(imgEmpty);

  // ── key the green plate ──────────────────────────────────────────────
  const kd = new ImageData(W, H);
  const g = green.d.data, k = kd.data;
  const LO = 24, HI = 96; // greenness ramp
  const aRaw = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = g[i * 4], gg = g[i * 4 + 1], b = g[i * 4 + 2];
    const greenness = gg - Math.max(r, b);
    if (greenness <= LO) aRaw[i] = 255;
    else if (greenness >= HI) aRaw[i] = 0;
    else aRaw[i] = Math.round(255 * (1 - (greenness - LO) / (HI - LO)));
  }
  // erode alpha 2px (source cutout keeps a sliver of the ORIGINAL light wall
  // around the figure -> bright halo when composited; trim it off), then feather 1px
  const ER = 2;
  const aEr = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let m = 255;
      for (let dy = -ER; dy <= ER; dy++) {
        const yy = Math.min(H - 1, Math.max(0, y + dy));
        for (let dx = -ER; dx <= ER; dx++) {
          const xx = Math.min(W - 1, Math.max(0, x + dx));
          const v = aRaw[yy * W + xx];
          if (v < m) m = v;
        }
      }
      aEr[y * W + x] = m;
    }
  }
  const aFin = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = Math.min(H - 1, Math.max(0, y + dy));
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(W - 1, Math.max(0, x + dx));
          s += aEr[yy * W + xx];
        }
      }
      aFin[y * W + x] = Math.round(s / 9);
    }
  }
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let i = 0; i < W * H; i++) {
    const a = aFin[i];
    if (a === 0) { k[i * 4 + 3] = 0; continue; }
    const r = g[i * 4], gg = g[i * 4 + 1], b = g[i * 4 + 2];
    let rr = r, gc = Math.min(gg, Math.max(r, b) + 4), bb = b; // despill
    if (a < 255) { const gray = Math.round((rr + bb) / 2); rr = gc = bb = gray; } // edge: kill any cast
    k[i * 4] = rr; k[i * 4 + 1] = gc; k[i * 4 + 2] = bb; k[i * 4 + 3] = a;
    const x = i % W, y = (i / W) | 0;
    if (a > 128) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }

  // ── SAD alignment helper: shift candidate layer over the full plate ──
  const lum = d => { // grayscale plane
    const out = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) out[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    return out;
  };
  const lumFull = lum(full.d.data);
  const lumEmpty = lum(empty.d.data);

  // figure region (from cutout alpha bbox, padded)
  const fx0 = Math.max(0, minX - 40), fx1 = Math.min(W - 1, maxX + 40);
  const fy0 = Math.max(0, minY - 40), fy1 = Math.min(H - 1, maxY + 40);

  const search = (score, r0, step) => {
    let best = {dx: 0, dy: 0, s: Infinity};
    for (let dy = -r0; dy <= r0; dy += step)
      for (let dx = -r0; dx <= r0; dx += step) {
        const s = score(dx, dy);
        if (s < best.s) best = {dx, dy, s};
      }
    return best;
  };
  const refine = (score, c) => {
    let best = {...c};
    for (let dy = c.dy - 4; dy <= c.dy + 4; dy++)
      for (let dx = c.dx - 4; dx <= c.dx + 4; dx++) {
        const s = score(dx, dy);
        if (s < best.s) best = {dx, dy, s};
      }
    return best;
  };

  // (a) empty plate vs full plate — static features OUTSIDE the figure region
  const scoreEmpty = (dx, dy) => {
    let s = 0, n = 0;
    for (let y = 60; y < H - 60; y += 7) {
      for (let x = 60; x < W - 60; x += 7) {
        if (x >= fx0 && x <= fx1 && y >= fy0 && y <= fy1) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        s += Math.abs(lumEmpty[yy * W + xx] - lumFull[y * W + x]);
        n++;
      }
    }
    return s / n;
  };
  // (b) keyed cutout vs full plate — opaque figure pixels only
  const scoreCut = (dx, dy) => {
    let s = 0, n = 0;
    for (let y = minY; y <= maxY; y += 3) {
      for (let x = minX; x <= maxX; x += 3) {
        const i = y * W + x;
        if (k[i * 4 + 3] < 250) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
        const kl = 0.299 * k[i * 4] + 0.587 * k[i * 4 + 1] + 0.114 * k[i * 4 + 2];
        s += Math.abs(kl - lumFull[yy * W + xx]);
        n++;
      }
    }
    return n ? s / n : Infinity;
  };

  const offEmpty = refine(scoreEmpty, search(scoreEmpty, 36, 4)); // empty -> full
  const offCut = refine(scoreCut, search(scoreCut, 36, 4));       // cutout -> full
  // cutout position in EMPTY-plate coordinates: shift by (offCut - offEmpty)
  const bake = {dx: offCut.dx - offEmpty.dx, dy: offCut.dy - offEmpty.dy};

  // ── export ───────────────────────────────────────────────────────────
  // background: the empty plate as-is (it IS the coordinate base)
  const bgBlob = await empty.c.convertToBlob({type: 'image/jpeg', quality: 0.92});

  // cutout: keyed pixels drawn with the baked offset
  const kc = new OffscreenCanvas(W, H);
  const kx = kc.getContext('2d');
  const tmp = new OffscreenCanvas(W, H);
  tmp.getContext('2d').putImageData(kd, 0, 0);
  kx.drawImage(tmp, -bake.dx, -bake.dy); // full->empty coords: shift content by -(bake)
  const cutBlob = await kc.convertToBlob({type: 'image/png'});

  const toB64 = blob => new Promise(res => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result.split(',')[1]);
    fr.readAsDataURL(blob);
  });

  return {
    bgB64: await toB64(bgBlob),
    cutB64: await toB64(cutBlob),
    bbox: {minX: minX - bake.dx, maxX: maxX - bake.dx, minY: minY - bake.dy, maxY: maxY - bake.dy},
    offEmpty, offCut, bake,
  };
}, b64(FULL), b64(GREEN), b64(EMPTY), W, H);

writeFileSync(`${OUT_DIR}/hoare-background-3200x1350.jpg`, Buffer.from(result.bgB64, 'base64'));
writeFileSync(`${OUT_DIR}/hoare-cutout-3200x1350.png`, Buffer.from(result.cutB64, 'base64'));
console.log('align empty->full:', JSON.stringify(result.offEmpty));
console.log('align cutout->full:', JSON.stringify(result.offCut));
console.log('baked cutout shift (empty coords):', JSON.stringify(result.bake));
console.log('figure bbox in final coords:', JSON.stringify(result.bbox));
const cx = (result.bbox.minX + result.bbox.maxX) / 2;
console.log(`figure center x=${cx.toFixed(0)} (${(100 * cx / W).toFixed(1)}% of width), width=${result.bbox.maxX - result.bbox.minX}px`);
await browser.close();
