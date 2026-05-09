// Captures key frames from flowStepIntroScene via Motion Canvas player.
// Drives the player by setting playback time directly through the Motion
// Canvas core API exposed on window.

import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import path from 'node:path';

const URL = 'http://localhost:5174/src/project';
const OUT = path.resolve('flow-step-shots');
await fs.mkdir(OUT, {recursive: true});

const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: {width: 1920, height: 1080},
});

const page = await browser.newPage();
const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));

await page.goto(URL, {waitUntil: 'networkidle2', timeout: 60000});

// Wait for the canvas to mount.
await page.waitForSelector('canvas', {timeout: 30000});

// Probe the player API surface.
const apiInfo = await page.evaluate(() => {
    const w = window;
    const keys = Object.keys(w).filter(k =>
        /motion|player|project|scene/i.test(k),
    );
    return {keys, hasPlayer: !!w.player};
});
console.log('API probe:', JSON.stringify(apiInfo));

// Try to seek the player. Motion Canvas exposes the player via the Vite
// glue — but the public API differs by version. Read the canvas's parent
// to find the application instance.
const seek = async (seconds) => {
    return await page.evaluate(async (sec) => {
        const root = document.querySelector('[id^="motion-canvas"]') || document;
        // Strategy: drive via the visible toolbar's seek input if present.
        // Fallback: raw frame ticking through the global Player object if
        // present in the bundle's exported state.
        const w = window;
        if (w.__player && typeof w.__player.requestSeek === 'function') {
            w.__player.requestSeek(sec * w.__player.status.framerate);
            return 'seek-via-__player';
        }
        // Fallback — DOM interaction with the time slider.
        const range = document.querySelector('input[type="range"]');
        if (range) {
            const max = Number(range.max);
            const fps = 60; // motion-canvas default
            const totalSec = max / fps;
            range.value = String(Math.min(max, sec * fps));
            range.dispatchEvent(new Event('input', {bubbles: true}));
            range.dispatchEvent(new Event('change', {bubbles: true}));
            return `seek-via-range max=${max} totalSec=${totalSec}`;
        }
        return 'no-seek-handle';
    }, seconds);
};

// Allow the renderer to stabilise before each capture.
const stabilise = () => new Promise(r => setTimeout(r, 250));

const TIMES = [0.6, 1.4, 2.4, 4.0, 6.5, 8.5, 11.0, 14.0, 17.5, 20.5, 23.5, 26.5];
const results = [];

for (const t of TIMES) {
    const seekRes = await seek(t);
    await stabilise();
    const file = path.join(OUT, `t${t.toFixed(1).replace('.', '_')}s.png`);
    await page.screenshot({path: file, fullPage: false});
    results.push({t, seekRes, file});
    console.log(`captured t=${t}s -> ${file} (${seekRes})`);
}

await fs.writeFile(path.join(OUT, 'console.log'), logs.join('\n'));
await fs.writeFile(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));

await browser.close();
console.log('done');
