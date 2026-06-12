import puppeteer from 'puppeteer';

const scene = process.argv[2] ?? 'velvetBooleanFlagCodeFirstSceneEn';
const frames = (process.argv[3] ?? '0').split(',').map(s => s.trim()).filter(Boolean);
const overlay = process.argv[4] ?? '1';
const BASE = 'http://127.0.0.1:5173/vstill.html';

const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
try {
  for (const f of frames) {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', m => logs.push('[console] ' + m.text()));
    page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
    const url = `${BASE}?scene=${encodeURIComponent(scene)}&frame=${f}&fps=60&overlay=${overlay}`;
    try {
      await page.goto(url, {waitUntil: 'load', timeout: 60000});
      await page.waitForFunction(
        () => window.__MC_STILL_DONE || window.__MC_STILL_ERROR,
        {timeout: 120000},
      );
    } catch (e) {
      console.log(`frame ${f}: TIMEOUT/NAV ${e.message}`);
      console.log(logs.slice(-8).join('\n'));
      await page.close();
      continue;
    }
    const result = await page.evaluate(() => ({
      err: window.__MC_STILL_ERROR || null,
      still: window.__MC_STILL || null,
    }));
    if (result.err) {
      console.log(`frame ${f}: ERROR ${result.err}`);
      console.log(logs.slice(-8).join('\n'));
    } else {
      console.log(`frame ${f}: OK -> ${result.still?.output} (global ${result.still?.globalFrame})`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
