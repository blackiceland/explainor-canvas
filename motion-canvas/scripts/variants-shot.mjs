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
await page.goto(URL, {waitUntil: 'domcontentloaded'});
await new Promise(r => setTimeout(r, 8000));

const grab = async () => page.evaluate(() => {
    const c = Array.from(document.querySelectorAll('canvas'))
        .find(x => x.width === 1920 && x.height === 1080);
    return c ? c.toDataURL('image/png') : null;
});

await page.evaluate(() => localStorage.setItem('project/frame', '240'));
await page.reload({waitUntil: 'domcontentloaded'});
await new Promise(r => setTimeout(r, 6000));

const dataUrl = await grab();
if (dataUrl) {
    const png = Buffer.from(dataUrl.split(',')[1], 'base64');
    await fs.writeFile(path.join(OUT, 'variantB.png'), png);
    console.log('saved variantB.png', png.length, 'bytes');
}

await browser.close();
