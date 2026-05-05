import puppeteer from 'puppeteer';
import {writeFileSync} from 'fs';

const URL = process.env.MC_URL || 'http://localhost:5173/src/verticalProject';
const OUT = process.env.OUT_DIR || './scripts/preview-out';

const beatTimes = [
    ['before',  3.5],
    ['after',  10.0],
    ['thesis', 17.0],
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
    await new Promise(r => setTimeout(r, 1500));

    // Seek the playhead to the start of the dontFight scene by clicking
    // its LEFT EDGE on the timeline track.
    {
        const handle = await page.evaluateHandle(() => {
            const track = document.querySelector('[class*=sceneTrack]');
            if (!track) return null;
            return Array.from(track.children).find(el =>
                (el.textContent || '').includes('dontFight')) || null;
        });
        const el = handle.asElement();
        if (el) {
            await el.scrollIntoView();
            await new Promise(r => setTimeout(r, 300));
            const box = await el.boundingBox();
            if (box) {
                // Click ~3px in from the left edge to land at frame 0 of my scene.
                await page.mouse.click(box.x + 3, box.y + box.height / 2);
                console.log(`[seek-to-scene-start] ${Math.round(box.x + 3)},${Math.round(box.y + box.height / 2)} w=${Math.round(box.width)}`);
            }
        }
    }
    await new Promise(r => setTimeout(r, 800));

    // Find the visible preview canvas (largest by area among visible).
    const previewSelector = 'canvas';
    const canvas = await page.$(previewSelector);
    if (!canvas) {
        console.log('No canvas');
        await browser.close();
        return;
    }

    // Strategy: press Space to start playback, capture screenshots at each
    // beat time (relative to play start). Track elapsed wall-clock.
    await page.keyboard.press('Space');  // play
    const playStart = Date.now();

    for (const [label, t] of beatTimes) {
        const targetMs = playStart + t * 1000;
        const wait = Math.max(0, targetMs - Date.now());
        if (wait > 0) await new Promise(r => setTimeout(r, wait));

        // Pause briefly to capture stable frame.
        await page.keyboard.press('Space');
        await new Promise(r => setTimeout(r, 250));

        const buf = await canvas.screenshot({type: 'png'});
        writeFileSync(`${OUT}/${label}.png`, buf);
        console.log(`[${label}] t≈${((Date.now()-playStart)/1000).toFixed(2)}s saved`);

        await page.keyboard.press('Space');  // resume
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
