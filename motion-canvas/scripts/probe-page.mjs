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
page.on('requestfailed', req => logs.push(`[reqfail] ${req.url()} -> ${req.failure()?.errorText}`));

await page.goto(URL, {waitUntil: 'domcontentloaded', timeout: 30000});

// Wait 8s for the bundle to load and render
await new Promise(r => setTimeout(r, 15000));

await page.screenshot({path: path.join(OUT, 'probe.png'), fullPage: false});

const html = await page.evaluate(() => document.body.innerHTML.slice(0, 4000));
const canvases = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('canvas'));
    return all.map(c => ({
        id: c.id,
        cls: c.className,
        w: c.width,
        h: c.height,
        cssW: c.getBoundingClientRect().width,
        cssH: c.getBoundingClientRect().height,
    }));
});

await fs.writeFile(path.join(OUT, 'page-html.html'), html);
await fs.writeFile(path.join(OUT, 'canvases.json'), JSON.stringify(canvases, null, 2));
await fs.writeFile(path.join(OUT, 'console.log'), logs.join('\n'));

console.log('canvases:', JSON.stringify(canvases));
console.log('console lines:', logs.length);
console.log(logs.slice(0, 30).join('\n'));

await browser.close();
