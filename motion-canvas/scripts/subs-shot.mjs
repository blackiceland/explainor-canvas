import puppeteer from 'puppeteer';
import {writeFileSync, mkdirSync} from 'fs';

const URL = 'http://localhost:5173/src/subtitleOverlayProject';
const OUT = './scripts/preview-out';
// Overlay plays from t=0. Sweep times that hit 1-line and 2-line sentences.
const SHOT_TIMES = [2.6, 5.5, 8.6, 10.6, 14.5, 17.5, 22.6, 30.5, 38.4];

try { mkdirSync(OUT, {recursive: true}); } catch {}

const errors = [];

(async () => {
    const browser = await puppeteer.launch({headless: 'new', defaultViewport: {width: 1400, height: 2200}});
    const page = await browser.newPage();
    page.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); console.log('[browser:error]', m.text()); } });
    page.on('pageerror', e => { errors.push(String(e)); console.log('[pageerror]', e.message); });

    await page.goto(URL, {waitUntil: 'domcontentloaded', timeout: 30000});
    await new Promise(r => setTimeout(r, 6000));
    await page.waitForSelector('canvas', {timeout: 15000});
    await page.evaluate(async () => {
        try {
            await document.fonts.load('500 33px "JetBrains Mono"');
            await document.fonts.load('400 33px "JetBrains Mono"');
        } catch {}
        await document.fonts.ready;
    });
    await page.reload({waitUntil: 'domcontentloaded'});
    await new Promise(r => setTimeout(r, 6000));
    await page.waitForSelector('canvas', {timeout: 15000});
    await new Promise(r => setTimeout(r, 1200));

    const playClicked = await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('button')).find(b => /Play \[Space\]/i.test(b.title || ''));
        if (b) { b.click(); return true; }
        return false;
    });
    console.log('[play]', playClicked);

    // Composite onto dark so the transparent overlay is legible in the PNG we read back.
    const capture = () => page.evaluate(() => {
        const list = Array.from(document.querySelectorAll('canvas'));
        const exact = list.find(c => c.width === 1080 && c.height === 1920);
        const c = exact || list.sort((a, b) => b.width * b.height - a.width * a.height)[0];
        if (!c) return null;
        const off = document.createElement('canvas');
        off.width = c.width; off.height = c.height;
        const ctx = off.getContext('2d');
        ctx.fillStyle = '#151A28';
        ctx.fillRect(0, 0, off.width, off.height);
        ctx.drawImage(c, 0, 0);
        return off.toDataURL('image/png');
    });

    const t0 = Date.now();
    for (const t of SHOT_TIMES) {
        const wait = Math.max(0, t0 + t * 1000 - Date.now());
        if (wait) await new Promise(r => setTimeout(r, wait));
        const uri = await capture();
        if (uri) {
            writeFileSync(`${OUT}/subs-${String(t).replace('.', '_')}s.png`, Buffer.from(uri.replace(/^data:image\/png;base64,/, ''), 'base64'));
            console.log(`[shot] ${t}s saved`);
        } else console.log(`[shot] ${t}s NO CANVAS`);
    }

    await browser.close();
    console.log(errors.length ? `\n=== ${errors.length} ERROR(S) ===` : '\n=== NO CONSOLE ERRORS ===');
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
