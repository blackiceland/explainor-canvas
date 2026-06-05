import puppeteer from 'puppeteer';
import {writeFileSync, mkdirSync} from 'fs';

// Single-load diagnostic + capture for verticalProject scene 1 (boolean-flag),
// to confirm the in-scene `//` captions are hidden. Logs page errors so a
// runtime break (vs. a slow load) is distinguishable.
const URL = 'http://localhost:5173/src/verticalProject';
const OUT = './scripts/preview-out';
const SHOT_TIMES = [5, 9, 14, 20, 26];

try { mkdirSync(OUT, {recursive: true}); } catch {}

(async () => {
    const browser = await puppeteer.launch({headless: 'new', defaultViewport: {width: 1400, height: 2200}});
    const page = await browser.newPage();
    page.on('console', m => { if (m.type() === 'error') console.log('[browser:error]', m.text()); });
    page.on('pageerror', e => console.log('[PAGEERROR]', e.message));

    await page.goto(URL, {waitUntil: 'domcontentloaded', timeout: 30000});
    await new Promise(r => setTimeout(r, 14000));

    const canvases = await page.evaluate(() => Array.from(document.querySelectorAll('canvas')).map(c => `${c.width}x${c.height}`));
    console.log('[canvases]', JSON.stringify(canvases));
    if (canvases.length === 0) { console.log('NO CANVAS — see errors above'); await browser.close(); return; }

    await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('button')).find(b => /Play \[Space\]/i.test(b.title || ''));
        if (b) b.click();
    });

    const capture = () => page.evaluate(() => {
        const list = Array.from(document.querySelectorAll('canvas'));
        const c = list.find(c => c.width === 1080 && c.height === 1920) || list.sort((a, b) => b.width * b.height - a.width * a.height)[0];
        return c ? c.toDataURL('image/png') : null;
    });

    const t0 = Date.now();
    for (const t of SHOT_TIMES) {
        const wait = Math.max(0, t0 + t * 1000 - Date.now());
        if (wait) await new Promise(r => setTimeout(r, wait));
        const uri = await capture();
        if (uri) { writeFileSync(`${OUT}/boolcap-${String(t).padStart(2, '0')}s.png`, Buffer.from(uri.replace(/^data:image\/png;base64,/, ''), 'base64')); console.log(`[shot] ${t}s saved`); }
    }
    await browser.close();
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
