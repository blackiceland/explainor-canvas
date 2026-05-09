// Drive the motion-canvas player by writing project/frame to localStorage
// before reload — the editor restores frame state from there.

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

const grabMain = async () => {
    return await page.evaluate(() => {
        const canvases = Array.from(document.querySelectorAll('canvas'));
        const main = canvases.find(c => c.width === 1920 && c.height === 1080);
        return main ? main.toDataURL('image/png') : null;
    });
};

const FPS = 60;
const TIMES_S = [0.6, 1.4, 2.5, 4.0, 6.0, 8.0, 11.0, 14.0, 17.0, 20.0, 23.0, 26.0];

await page.goto(URL, {waitUntil: 'domcontentloaded'});
await new Promise(r => setTimeout(r, 8000));

// Inspect what's stored under project/frame and project/player.
const storedKeys = await page.evaluate(() => {
    return {
        frame: localStorage.getItem('project/frame'),
        player: localStorage.getItem('project/player'),
    };
});
console.log('initial localStorage:', JSON.stringify(storedKeys));

for (const ts of TIMES_S) {
    const targetFrame = Math.round(ts * FPS);
    // Set frame in localStorage and reload.
    await page.evaluate((f) => {
        localStorage.setItem('project/frame', String(f));
    }, targetFrame);
    await page.reload({waitUntil: 'domcontentloaded'});
    await new Promise(r => setTimeout(r, 6000));

    const dataUrl = await grabMain();
    if (!dataUrl) {
        console.log(`t=${ts}s f=${targetFrame} NO CANVAS`);
        continue;
    }
    const png = Buffer.from(dataUrl.split(',')[1], 'base64');
    const file = path.join(OUT, `t${ts.toFixed(1).replace('.', '_')}s_f${String(targetFrame).padStart(4, '0')}.png`);
    await fs.writeFile(file, png);
    console.log(`t=${ts}s f=${targetFrame} -> ${path.basename(file)} (${png.length}b)`);
}

await browser.close();
