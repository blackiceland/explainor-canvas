const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({width: 1920, height: 1080});

  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    if (text.startsWith('[')) console.log(text);
  });

  page.on('pageerror', err => console.error('[PAGE ERROR]', err.message));

  console.log('Opening Motion Canvas...');
  await page.goto('http://localhost:5173', {waitUntil: 'domcontentloaded', timeout: 60000});

  // Wait for scene to load and calibrate
  await new Promise(r => setTimeout(r, 6000));

  const outDir = path.resolve(__dirname, 'debug-screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  await page.screenshot({path: path.join(outDir, '00-loaded.png'), fullPage: false});
  console.log('Screenshot: 00-loaded.png');

  // Press Space to start playback
  console.log('Pressing Space to play...');
  await page.keyboard.press('Space');

  // Take screenshots during animation phases
  const shots = [
    [1500, '01-belt-start'],
    [2000, '02-belt-arrived'],
    [2000, '03-reaching'],
    [1500, '04-at-cube'],
    [1000, '05-grabbing'],
    [2500, '06-lifting'],
    [2500, '07-holding'],
  ];

  for (const [delay, name] of shots) {
    await new Promise(r => setTimeout(r, delay));
    await page.screenshot({path: path.join(outDir, `${name}.png`), fullPage: false});
    console.log(`Screenshot: ${name}.png`);
  }

  console.log('\n=== RELEVANT LOGS ===');
  for (const line of logs) {
    if (line.startsWith('[PROBE]') || line.startsWith('[GRIP]') || line.startsWith('[IK]') || line.startsWith('[BELT]') || line.startsWith('[FINGER]') || line.startsWith('[SPEC]')) {
      console.log(line);
    }
  }

  await browser.close();
  console.log('\nDone.');
})();
