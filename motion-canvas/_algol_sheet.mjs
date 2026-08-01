// Вырезает ЛИСТ из плиты algol-paper-horizontal-3200x1800.jpg: находит наклон
// страницы по верхней кромке, разворачивает в ось, обрезает по бумаге.
// Нужно потому, что на стене должен висеть лист, а не фотография листа на сером
// поле (серый прямоугольник на стене читается как плакат, а не как документ).
// Тень рисует уже сцена — своя, чтобы лист лежал в свете кадра.
// Выход: public/hoare/algol-sheet-<w>x<h>.jpg + печатает координаты шапки.
import puppeteer from 'puppeteer';
import {readFileSync, writeFileSync} from 'node:fs';

const SRC = 'C:/Users/black/IdeaProjects/explainor-canvas/motion-canvas/public/hoare/algol-paper-horizontal-3200x1800.jpg';
const OUT_DIR = 'C:/Users/black/IdeaProjects/explainor-canvas/motion-canvas/public/hoare';
const b64 = readFileSync(SRC).toString('base64');

const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox']});
const page = await browser.newPage();
page.on('console', m => console.log('  [pg]', m.text().slice(0, 300)));
await page.setContent('<!doctype html><html><body></body></html>');

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

  // верхняя кромка листа: первая яркая строка в колонке (серое поле 198…226,
  // бумага заметно светлее)
  const TH = 234;
  const topAt = px => {
    let run = 0;
    for (let py = 20; py < H - 20; py++) {
      if (lum(px, py) > TH) { run++; if (run >= 6) return py - 5; }
      else run = 0;
    }
    return -1;
  };
  const xs = [];
  for (let px = 1100; px <= 2100; px += 25) {
    const t = topAt(px);
    if (t > 0) xs.push([px, t]);
  }
  // МНК по (x, y) — наклон кромки
  const n = xs.length;
  const mx = xs.reduce((s, p) => s + p[0], 0) / n;
  const my = xs.reduce((s, p) => s + p[1], 0) / n;
  let num = 0, den = 0;
  for (const [px, py] of xs) { num += (px - mx) * (py - my); den += (px - mx) ** 2; }
  const slope = num / den;
  const angleDeg = (Math.atan(slope) * 180) / Math.PI;

  // разворот в ось вокруг центра кадра
  const rc = new OffscreenCanvas(W, H);
  const rx = rc.getContext('2d');
  rx.fillStyle = 'rgb(208,208,210)';
  rx.fillRect(0, 0, W, H);
  rx.translate(W / 2, H / 2);
  rx.rotate((-angleDeg * Math.PI) / 180);
  rx.drawImage(c, -W / 2, -H / 2);
  rx.setTransform(1, 0, 0, 1, 0, 0);

  const rd = rx.getImageData(0, 0, W, H).data;
  const rlum = (px, py) => 0.299 * rd[(py * W + px) * 4] + 0.587 * rd[(py * W + px) * 4 + 1] + 0.114 * rd[(py * W + px) * 4 + 2];
  // bbox бумаги: строка/колонка считается бумажной, если ярких пикселей много
  let y0 = 0, y1 = H - 1, x0 = 0, x1 = W - 1;
  const rowBright = py => { let k = 0; for (let px = 0; px < W; px += 3) if (rlum(px, py) > TH) k++; return k; };
  const colBright = px => { let k = 0; for (let py = 0; py < H; py += 3) if (rlum(px, py) > TH) k++; return k; };
  const ROW_MIN = 200, COL_MIN = 260;
  for (let py = 0; py < H; py++) if (rowBright(py) > ROW_MIN) { y0 = py; break; }
  for (let py = H - 1; py >= 0; py--) if (rowBright(py) > ROW_MIN) { y1 = py; break; }
  for (let px = 0; px < W; px++) if (colBright(px) > COL_MIN) { x0 = px; break; }
  for (let px = W - 1; px >= 0; px--) if (colBright(px) > COL_MIN) { x1 = px; break; }

  // подрезаем на пиксель внутрь, чтобы не поймать кромку тени
  x0 += 3; x1 -= 3; y0 += 3; y1 -= 3;
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const sc = new OffscreenCanvas(cw, ch);
  sc.getContext('2d').drawImage(rc, -x0, -y0);

  // где на вырезанном листе шапка (для света в сцене): пересчитываем известные
  // координаты плиты через тот же разворот
  const toSheet = (ax, ay) => {
    const a = (-angleDeg * Math.PI) / 180;
    const dx = ax - W / 2, dy = ay - H / 2;
    const rxp = W / 2 + dx * Math.cos(a) - dy * Math.sin(a);
    const ryp = H / 2 + dx * Math.sin(a) + dy * Math.cos(a);
    return [Math.round(rxp - x0), Math.round(ryp - y0)];
  };

  const blob = await sc.convertToBlob({type: 'image/jpeg', quality: 0.95});
  const b = await new Promise(res => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result.split(',')[1]);
    fr.readAsDataURL(blob);
  });
  return {
    b64: b, cw, ch, angleDeg,
    titleCentre: toSheet(1586, 362),
    titleLeft: toSheet(1204, 362),
    titleRight: toSheet(1968, 362),
    authorsCentre: toSheet(1620, 417),
    hoare: toSheet(1825, 417),
  };
}, b64);

const name = `algol-sheet-${out.cw}x${out.ch}.jpg`;
writeFileSync(`${OUT_DIR}/${name}`, Buffer.from(out.b64, 'base64'));
console.log(`наклон плиты ${out.angleDeg.toFixed(3)}°`);
console.log(`лист ${out.cw}x${out.ch} -> ${name}`);
console.log('шапка в координатах листа:', JSON.stringify({
  titleCentre: out.titleCentre, titleLeft: out.titleLeft, titleRight: out.titleRight,
  authorsCentre: out.authorsCentre, hoare: out.hoare,
}));
await browser.close();
