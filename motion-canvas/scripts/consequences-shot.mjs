import puppeteer from 'puppeteer';
import {writeFileSync, mkdirSync} from 'fs';

const URL = 'http://localhost:5173/src/verticalProject';
const OUT = './scripts/preview-out';
// velvet is the only active scene → plays from t=0. Consequences beat sits late,
// just before the closing quote. Sweep late timestamps to catch the tableau.
const SHOT_TIMES = [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59];

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
            await document.fonts.load('400 32px "JetBrains Mono"');
            await document.fonts.load('500 32px "JetBrains Mono"');
            await document.fonts.load('500 24px "Newsreader"');
            await document.fonts.load('italic 500 66px "Newsreader"');
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

    const capture = () => page.evaluate(() => {
        const list = Array.from(document.querySelectorAll('canvas'));
        const exact = list.find(c => c.width === 1080 && c.height === 1920);
        const c = exact || list.sort((a, b) => b.width * b.height - a.width * a.height)[0];
        return c ? c.toDataURL('image/png') : null;
    });

    const t0 = Date.now();
    for (const t of SHOT_TIMES) {
        const wait = Math.max(0, t0 + t * 1000 - Date.now());
        if (wait) await new Promise(r => setTimeout(r, wait));
        const uri = await capture();
        if (uri) {
            writeFileSync(`${OUT}/conseq-${String(t).padStart(2, '0')}s.png`, Buffer.from(uri.replace(/^data:image\/png;base64,/, ''), 'base64'));
            console.log(`[shot] ${t}s saved`);
        } else console.log(`[shot] ${t}s NO CANVAS`);
    }

    await browser.close();
    console.log(errors.length ? `\n=== ${errors.length} ERROR(S) ===` : '\n=== NO CONSOLE ERRORS ===');
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
