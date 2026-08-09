// Плёночное зерно на весь кадр: нейтральный серый 128 + шум. Кладётся поверх
// сцены с compositeOperation 'overlay', поэтому 128 = без изменений, а
// отклонения светлят/темнят подложку — ровно то, что делает зерно отпечатка.
// Выход: public/hoare/grain-1920x1080.png
import puppeteer from 'puppeteer';
import {writeFileSync} from 'node:fs';

const OUT = 'C:/Users/black/IdeaProjects/explainor-canvas/motion-canvas/public/hoare/grain-1920x1080.png';
const W = 1920;
const H = 1080;
const SIGMA = 16;

const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox']});
const page = await browser.newPage();
await page.setContent('<!doctype html><html><body></body></html>');

const b64 = await page.evaluate(async (W, H, SIGMA) => {
  let seed = 19660912;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    // сумма двух равномерных даёт треугольное распределение — ближе к плёнке,
    // чем плоский шум, и без тяжёлых выбросов
    const n = (rnd() + rnd() - 1) * SIGMA;
    const v = Math.max(0, Math.min(255, 128 + n));
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const blob = await new Promise(res => c.toBlob(res, 'image/png'));
  return await new Promise(res => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result.split(',')[1]);
    fr.readAsDataURL(blob);
  });
}, W, H, SIGMA);

writeFileSync(OUT, Buffer.from(b64, 'base64'));
console.log(`wrote ${OUT}`);
await browser.close();
