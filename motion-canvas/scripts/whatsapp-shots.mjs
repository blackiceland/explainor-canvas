import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import path from 'node:path';

const URL = 'http://localhost:5174/src/project';
const OUT = path.resolve('whatsapp-shots');
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

const grabMain = async () => {
    return await page.evaluate(() => {
        const canvases = Array.from(document.querySelectorAll('canvas'));
        const main = canvases.find(c => c.width === 1920 && c.height === 1080);
        return main ? main.toDataURL('image/png') : null;
    });
};

const FPS = 60;
// Scene total ≈ 6.5s setup + 2.6s hold ≈ 9s; sample across reveal beats.
const TIMES_S = [0.4, 1.0, 1.6, 2.4, 3.0, 3.8, 4.6, 5.6, 7.5];

await page.goto(URL, {waitUntil: 'domcontentloaded'});
await new Promise(r => setTimeout(r, 8000));

for (const ts of TIMES_S) {
    const targetFrame = Math.round(ts * FPS);
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

await fs.writeFile(path.join(OUT, 'console.log'), logs.join('\n'));
await browser.close();
