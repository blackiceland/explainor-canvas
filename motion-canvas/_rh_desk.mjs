// Пустой стол Record Handling: то же серое поле с тем же градиентом и зерном,
// что рисует _rh_prep.mjs, но БЕЗ листа. Нужен, чтобы документ было куда
// класть: титул приезжает справа отдельным листом, а не проявляется затемнением.
//
// Выход: public/hoare/record-handling-desk-4800x2700.jpg
import puppeteer from 'puppeteer';
import {writeFileSync} from 'node:fs';

const OUT_DIR = 'C:/Users/black/IdeaProjects/explainor-canvas/motion-canvas/public/hoare';
const W = 4800;
const H = 2700;

const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox']});
const page = await browser.newPage();
await page.setContent('<!doctype html><html><body></body></html>');

const b64 = await page.evaluate(async (W, H) => {
  let seed = 20240912;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W * 0.35, H);
  g.addColorStop(0, 'rgb(219,219,220)');
  g.addColorStop(0.55, 'rgb(207,207,209)');
  g.addColorStop(1, 'rgb(197,197,199)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const surf = ctx.getImageData(0, 0, W, H);
  const sd = surf.data;
  for (let i = 0; i < sd.length; i += 4) {
    const n = (rnd() - 0.5) * 9;
    sd[i] += n;
    sd[i + 1] += n;
    sd[i + 2] += n;
  }
  ctx.putImageData(surf, 0, 0);

  const blob = await new Promise(res => out.toBlob(res, 'image/jpeg', 0.94));
  return await new Promise(res => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result.split(',')[1]);
    fr.readAsDataURL(blob);
  });
}, W, H);

writeFileSync(`${OUT_DIR}/record-handling-desk-${W}x${H}.jpg`, Buffer.from(b64, 'base64'));
console.log(`wrote ${OUT_DIR}/record-handling-desk-${W}x${H}.jpg`);
await browser.close();
