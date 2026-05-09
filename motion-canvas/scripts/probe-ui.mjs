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
await page.goto(URL, {waitUntil: 'domcontentloaded'});
await new Promise(r => setTimeout(r, 12000));

// Probe globals — find player handle.
const probe = await page.evaluate(() => {
    const out = {};
    for (const k of Object.keys(window)) {
        if (typeof window[k] === 'object' && window[k] !== null) {
            const v = window[k];
            const sub = Object.keys(v).slice(0, 20);
            if (sub.some(s => /seek|player|time|frame/i.test(s))) {
                out[k] = sub;
            }
        }
    }
    return out;
});
console.log('window probes:', JSON.stringify(probe, null, 2));

// Probe React tree: check for a global Player exposed by motion-canvas/ui.
const uiInfo = await page.evaluate(() => {
    const all = [];
    // Inspect any property starting with __ or with player/scene names.
    for (const k of Object.getOwnPropertyNames(window)) {
        if (k.length > 2 && k.length < 40) all.push(k);
    }
    return all.slice(0, 100);
});
console.log('window keys (first 100):', uiInfo.join(', '));

// DOM: find clickable things.
const buttons = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('button, a'));
    return all.map(b => ({tag: b.tagName, cls: b.className, txt: b.innerText?.slice(0, 60), title: b.title || ''}));
});
console.log('buttons:', JSON.stringify(buttons.slice(0, 30), null, 2));

await browser.close();
