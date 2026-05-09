// Captures the actual canvas of the motion-canvas player at multiple time
// points by manipulating the seek slider and reading the WebGL canvas via
// toDataURL.

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

await page.goto(URL, {waitUntil: 'domcontentloaded'});
await new Promise(r => setTimeout(r, 14000));

const seekTo = async (frame) => {
    return await page.evaluate(async (f) => {
        const range = document.querySelector('input[type="range"]');
        if (!range) return 'no-range';
        // Set first then dispatch input + change to mimic user drag.
        range.value = String(f);
        range.dispatchEvent(new Event('input',  {bubbles: true}));
        range.dispatchEvent(new Event('change', {bubbles: true}));
        // Allow the player to render the seeked frame.
        await new Promise(r => setTimeout(r, 600));
        return `seeked to ${f} (max=${range.max})`;
    }, frame);
};

const grab = async () => {
    return await page.evaluate(() => {
        // The first canvas is the scene renderer (1920x1080). Skip the
        // overlay (CSS class _overlay_) and audio track canvases.
        const canvases = Array.from(document.querySelectorAll('canvas'));
        const main = canvases.find(c => c.width === 1920 && c.height === 1080);
        if (!main) return null;
        return main.toDataURL('image/png');
    });
};

// Use 60 FPS as default. Sample 12 evenly-spaced frames across roughly the
// first 25 seconds of the scene.
const FRAMES = [30, 90, 180, 300, 480, 660, 840, 1020, 1200, 1320, 1440, 1500];

for (const f of FRAMES) {
    const seekRes = await seekTo(f);
    const dataUrl = await grab();
    if (!dataUrl) {
        console.log(`f=${f} no canvas`);
        continue;
    }
    const png = Buffer.from(dataUrl.split(',')[1], 'base64');
    const file = path.join(OUT, `frame_${String(f).padStart(4, '0')}.png`);
    await fs.writeFile(file, png);
    console.log(`f=${f} ${seekRes} -> ${path.basename(file)} (${png.length}b)`);
}

await fs.writeFile(path.join(OUT, 'console.log'), logs.join('\n'));
console.log('---logs---');
console.log(logs.join('\n'));

await browser.close();
