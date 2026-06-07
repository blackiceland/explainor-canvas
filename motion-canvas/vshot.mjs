import puppeteer from 'puppeteer';

const scene = process.argv[2] ?? 'velvetBooleanFlagCodeFirstSceneEn';
const frames = (process.argv[3] ?? '0').split(',').map(s => s.trim()).filter(Boolean);
const overlay = process.argv[4] === 'overlay' ? '&overlay=1' : '';
const fps = 60;

const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox']});
try {
  for (const f of frames) {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    page.on('console', m => { const t = m.text(); if (/error|Error|throw/.test(t)) errs.push(t); });
    const url = `http://127.0.0.1:5173/vstill.html?scene=${scene}&frame=${f}&fps=${fps}${overlay}`;
    await page.goto(url, {waitUntil: 'load', timeout: 90000});
    try {
      await page.waitForFunction(() => window.__MC_STILL_DONE || window.__MC_STILL_ERROR, {timeout: 80000});
    } catch (e) {
      console.log(`frame ${f}: WAIT TIMEOUT ${e.message}`);
    }
    const err = await page.evaluate(() => window.__MC_STILL_ERROR);
    const out = await page.evaluate(() => window.__MC_STILL?.output);
    if (err) console.log(`frame ${f}: ERROR ${err}`);
    else console.log(`frame ${f}: ${out}`);
    if (errs.length) console.log(`  console: ${errs.slice(0, 3).join(' | ')}`);
    await page.close();
  }
} finally {
  await browser.close();
}
