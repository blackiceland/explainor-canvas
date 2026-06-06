import puppeteer from 'puppeteer';

// Diagnose: does the overlay render with alpha, or a baked background?
// Sample corner + edge pixels (away from text). alpha 0 = transparent (good),
// alpha 255 = opaque background baked in (bad).
const URL = 'http://localhost:5173/src/subtitleOverlayProject';

(async () => {
    const browser = await puppeteer.launch({headless: 'new', defaultViewport: {width: 1400, height: 2200}});
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('[PAGEERROR]', e.message));

    await page.goto(URL, {waitUntil: 'domcontentloaded', timeout: 30000});
    await new Promise(r => setTimeout(r, 7000));
    await page.waitForSelector('canvas', {timeout: 20000});
    await page.evaluate(async () => { try { await document.fonts.ready; } catch {} });

    await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('button')).find(b => /Play \[Space\]/i.test(b.title || ''));
        if (b) b.click();
    });
    await new Promise(r => setTimeout(r, 2000)); // let a card show

    const res = await page.evaluate(() => {
        const list = Array.from(document.querySelectorAll('canvas'));
        const c = list.find(c => c.width === 1080 && c.height === 1920) || list.sort((a, b) => b.width * b.height - a.width * a.height)[0];
        if (!c) return {error: 'no canvas'};
        const off = document.createElement('canvas');
        off.width = c.width; off.height = c.height;
        const ctx = off.getContext('2d');
        ctx.drawImage(c, 0, 0);
        const sample = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
        return {
            canvas: `${c.width}x${c.height}`,
            topLeft: sample(8, 8),
            center: sample(540, 400),
            bottomRight: sample(1072, 1912),
        };
    });
    console.log(JSON.stringify(res, null, 2));
    await browser.close();
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
