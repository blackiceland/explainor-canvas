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

await page.goto(URL, {waitUntil: 'domcontentloaded', timeout: 30000});
await new Promise(r => setTimeout(r, 12000));

// Grab the FIRST canvas's pixel data via toDataURL — sidesteps any
// editor-chrome screenshotting and gets us the actual scene render.
const dataUrl = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return null;
    return c.toDataURL('image/png');
});

if (!dataUrl) {
    console.log('NO CANVAS');
} else {
    const png = Buffer.from(dataUrl.split(',')[1], 'base64');
    await fs.writeFile(path.join(OUT, 'first-canvas.png'), png);
    console.log('saved first-canvas.png', png.length, 'bytes');
}

// Probe player state.
const state = await page.evaluate(() => {
    return {
        canvasCount: document.querySelectorAll('canvas').length,
        bodyText: document.body.innerText.slice(0, 300),
        hasError: !!document.querySelector('[class*=error]'),
    };
});
console.log('state', JSON.stringify(state));

await fs.writeFile(path.join(OUT, 'console.log'), logs.join('\n'));
console.log('logs', logs.length);
console.log(logs.join('\n'));

await browser.close();
