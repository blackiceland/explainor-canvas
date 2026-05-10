import puppeteer from 'puppeteer';
import {writeFileSync} from 'fs';

const URL = process.env.MC_URL || 'http://localhost:5173/src/verticalProject';
const OUT = process.env.OUT_DIR || './scripts/preview-out';

const SCENE_OFFSET = 14.0;
const beatTimes = [
    ['01-cart-resolve',  SCENE_OFFSET +  0.4],
    ['02-cart-done',     SCENE_OFFSET +  1.2],
    ['03-both-static',   SCENE_OFFSET +  2.5],
    ['04-render',        SCENE_OFFSET +  4.5],
    ['05-send',          SCENE_OFFSET +  5.6],
    ['06-record',        SCENE_OFFSET +  6.8],
    ['07-return',        SCENE_OFFSET +  8.0],
    ['08-bars-init',     SCENE_OFFSET +  9.5],
    ['09-figures',       SCENE_OFFSET + 12.0],
    ['10-labels',        SCENE_OFFSET + 14.5],
    ['11-rev-expand',    SCENE_OFFSET + 18.5],
    ['12-merged-text',   SCENE_OFFSET + 20.5],
    ['13-mantra',        SCENE_OFFSET + 25.0],
];

async function ensureDir() {
    const {mkdirSync} = await import('fs');
    try { mkdirSync(OUT, {recursive: true}); } catch {}
}

(async () => {
    await ensureDir();
    const browser = await puppeteer.launch({
        headless: 'new',
        defaultViewport: {width: 3600, height: 1800},
    });
    const page = await browser.newPage();
    page.on('console', msg => {
        console.log(`[browser:${msg.type()}]`, msg.text());
    });
    page.on('pageerror', err => console.log('[pageerror]', err.message));
    page.on('requestfailed', req =>
        console.log('[reqfailed]', req.url(), req.failure()?.errorText));
    page.on('response', resp => {
        if (resp.status() >= 400) {
            console.log('[resp', resp.status() + ']', resp.url());
        }
    });

    console.log('Navigating to', URL);
    await page.goto(URL, {waitUntil: 'domcontentloaded', timeout: 30000});
    await new Promise(r => setTimeout(r, 8000));

    // Wait for Motion Canvas editor canvas to be ready.
    await page.waitForSelector('canvas', {timeout: 15000});

    // Force-load the code font before any screenshot so monospace metrics
    // line up with what Manticore expects (otherwise tokens collide).
    const fontStatus = await page.evaluate(async () => {
        try {
            // Load the actual size used by paperCodeSceneEn so canvas2d's
            // measureText returns true monospace metrics, not the fallback.
            await document.fonts.load('400 38px "JetBrains Mono"');
            await document.fonts.load('700 38px "JetBrains Mono"');
            await document.fonts.load('400 32px "JetBrains Mono"');
            await document.fonts.load('700 32px "JetBrains Mono"');
            await document.fonts.load('400 120px "Newsreader"');
            await document.fonts.load('italic 400 120px "Newsreader"');
            await document.fonts.load('500 22px "Newsreader"');
            await document.fonts.load('400 32px "Newsreader"');
        } catch (e) { return {err: String(e)}; }
        await document.fonts.ready;
        return {
            check400: document.fonts.check('400 32px "JetBrains Mono"'),
            check700: document.fonts.check('700 32px "JetBrains Mono"'),
            faces: Array.from(document.fonts).map(f => `${f.family}/${f.weight}/${f.status}`),
        };
    });
    console.log('[fonts]', JSON.stringify(fontStatus));

    // Pre-decode the linen texture so the first scene frame already
    // has the BG image in browser memory.
    await page.evaluate(async () => {
        const img = new Image();
        img.src = '/linen.jpg';
        try { await img.decode(); } catch {}
    });

    // Reload so Motion Canvas / Manticore initialise AFTER the font
    // and texture are warm in the browser cache. Without this, the
    // first scene mount measures token widths against the proportional
    // fallback and tokens overlap.
    await page.reload({waitUntil: 'domcontentloaded'});
    await new Promise(r => setTimeout(r, 8000));
    await page.waitForSelector('canvas', {timeout: 15000});
    await page.evaluate(async () => {
        await document.fonts.ready;
    });
    await new Promise(r => setTimeout(r, 1500));

    // Click the editor's Play button (DOM action, no keyboard focus
    // race) so the playhead actually advances past code.appear().
    const playClicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const play = btns.find(b => /Play \[Space\]/i.test(b.title || ''));
        if (!play) return false;
        play.click();
        return true;
    });
    console.log(`[play-button-click] ${playClicked}`);

    const captureCanvas = () => page.evaluate(() => {
        const list = Array.from(document.querySelectorAll('canvas'));
        const exact = list.find(c => c.width === 1080 && c.height === 1920);
        if (exact) return exact.toDataURL('image/png');
        let best = null, bestArea = 0;
        for (const c of list) {
            if (c.width === 0 || c.height === 0) continue;
            const ratio = c.width / c.height;
            if (ratio < 0.5 || ratio > 0.65) continue;
            const area = c.width * c.height;
            if (area > bestArea) { bestArea = area; best = c; }
        }
        return best ? best.toDataURL('image/png') : null;
    });

    const playStart = Date.now();
    for (const [label, t] of beatTimes) {
        const targetMs = playStart + t * 1000;
        const wait = Math.max(0, targetMs - Date.now());
        if (wait > 0) await new Promise(r => setTimeout(r, wait));

        const dataUri = await captureCanvas();
        if (dataUri) {
            const b64 = dataUri.replace(/^data:image\/png;base64,/, '');
            writeFileSync(`${OUT}/${label}.png`, Buffer.from(b64, 'base64'));
            console.log(`[${label}] t≈${((Date.now()-playStart)/1000).toFixed(2)}s saved`);
        } else {
            console.log(`[${label}] NO CANVAS`);
        }
    }

    // (Disabled the previous seek-via-API loop below.)
    if (false) for (const [label, t] of beatTimes) {
        // Set the player time via the global player API exposed by MC editor.
        const result = await page.evaluate(async time => {
            // Motion Canvas editor exposes its player on window. Different
            // versions expose differently; probe a few names.
            const w = window;
            const player =
                w.player ||
                w.MotionCanvas?.player ||
                w.__MC__?.player ||
                null;
            if (player && typeof player.requestSeek === 'function') {
                player.requestSeek(Math.round(time * 60));
                return 'seek-via-player';
            }
            // Fallback — find the time slider/scrubber and set its value.
            const inputs = Array.from(document.querySelectorAll('input[type=range]'));
            const scrubber = inputs.find(i =>
                (i.getAttribute('aria-label') || '').toLowerCase().includes('time') ||
                (i.parentElement?.textContent || '').match(/\d+:\d+/),
            );
            if (scrubber) {
                scrubber.value = String(time);
                scrubber.dispatchEvent(new Event('input', {bubbles: true}));
                scrubber.dispatchEvent(new Event('change', {bubbles: true}));
                return 'seek-via-slider';
            }
            return 'no-seek-api';
        }, t);
        console.log(`[${label}] t=${t}s seek=${result}`);
        await new Promise(r => setTimeout(r, 800));

        const canvas = await page.$('canvas');
        if (canvas) {
            const buf = await canvas.screenshot({type: 'png'});
            writeFileSync(`${OUT}/${label}.png`, buf);
            console.log(`  saved ${OUT}/${label}.png`);
        }
    }

    await browser.close();
})().catch(err => {
    console.error('Preview failed:', err);
    process.exit(1);
});
