import puppeteer from 'puppeteer';
const SCENE = 'paletteLabSceneRu';
const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox']});
const page = await browser.newPage();
page.on('console', m => console.log('[console.' + m.type() + ']', m.text()));
page.on('pageerror', e => console.log('[pageerror]', e.message, '\n', e.stack));
page.on('requestfailed', r => console.log('[reqfail]', r.url(), r.failure()?.errorText));
page.on('response', r => { if (r.status() >= 400) console.log('[http ' + r.status() + ']', r.url()); });
const url = `http://127.0.0.1:5173/still.html?scene=${SCENE}&frame=40&fps=30&timeoutMs=60000&grid=off`;
await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 60000});
try {
  await page.waitForFunction(
    () => window.__MC_STILL_DONE === true || typeof window.__MC_STILL_ERROR === 'string',
    {timeout: 30000, polling: 200},
  );
} catch (e) { console.log('[wait-timeout]', String(e).split('\n')[0]); }
const err = await page.evaluate(() => window.__MC_STILL_ERROR ?? null);
const done = await page.evaluate(() => window.__MC_STILL_DONE ?? null);
console.log('__MC_STILL_ERROR:', err);
console.log('__MC_STILL_DONE:', done);
await browser.close();
