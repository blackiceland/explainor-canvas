import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox'], protocolTimeout: 300000});
const page = await browser.newPage();
const seen = [];
page.on('console', m => seen.push('[' + m.type() + '] ' + m.text()));
page.on('pageerror', e => seen.push('[pageerror] ' + (e.stack || e.message).split('\n').slice(0, 6).join(' | ')));
page.on('requestfailed', r => seen.push('[reqfail] ' + r.url().slice(-90) + ' ' + (r.failure()?.errorText ?? '')));
try {
  await page.goto('http://127.0.0.1:5173/herostill.html?scene=duplicationWorldSceneEn&frame=345&fps=30&timeoutMs=780000&grid=off',
    {waitUntil: 'domcontentloaded', timeout: 120000});
  await page.waitForFunction(
    () => window.__MC_STILL_DONE === true || typeof window.__MC_STILL_ERROR === 'string',
    {timeout: 780000, polling: 1000},
  ).catch(() => seen.push('[probe] флаг готовности так и не выставлен'));
  const err = await page.evaluate(() => window.__MC_STILL_ERROR ?? null);
  if (err) seen.push('[MC_STILL_ERROR] ' + String(err).split('\n').slice(0, 8).join(' | '));
} catch (e) {
  seen.push('[driver] ' + String(e).split('\n')[0]);
}
console.log(seen.slice(-40).join('\n'));
await browser.close();
