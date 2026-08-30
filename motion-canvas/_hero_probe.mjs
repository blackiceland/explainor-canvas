import puppeteer from 'puppeteer';
const F = process.argv[2] || '8';
const b = await puppeteer.launch({headless: 'new', args: ['--no-sandbox'], protocolTimeout: 600000});
const p = await b.newPage();
p.setDefaultTimeout(600000);
const t0 = Date.now();
const T = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
p.on('console', m => console.log(' ', T(), m.type(), m.text().slice(0, 400)));
p.on('pageerror', e => console.log(' ', T(), 'PAGEERROR', String(e).slice(0, 900)));
p.on('requestfailed', r => console.log(' ', T(), 'REQFAIL', r.url().slice(-70), r.failure()?.errorText));
p.on('response', r => { if (r.status() >= 400) console.log(' ', T(), 'HTTP', r.status(), r.url().slice(-70)); });
await p.goto(`http://127.0.0.1:5173/herostill.html?scene=chargingHeroDemoScene&frame=${F}&fps=30&timeoutMs=540000&grid=off`,
  {waitUntil: 'domcontentloaded', timeout: 300000});
console.log(' ', T(), 'DOM готов');
try {
  await p.waitForFunction(() => window.__MC_STILL_DONE === true || typeof window.__MC_STILL_ERROR === 'string',
    {timeout: 540000, polling: 500});
  console.log(' ', T(), 'ДОЖДАЛИСЬ', JSON.stringify(await p.evaluate(() => ({d: window.__MC_STILL_DONE, e: window.__MC_STILL_ERROR, i: window.__MC_STILL}))));
} catch (e) {
  console.log(' ', T(), 'НЕ ДОЖДАЛИСЬ:', String(e).split('\n')[0]);
  console.log('  статус на странице:', await p.evaluate(() => document.getElementById('status')?.textContent + ' | ' + document.getElementById('error')?.textContent));
}
await b.close();
