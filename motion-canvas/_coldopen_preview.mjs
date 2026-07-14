import puppeteer from 'puppeteer';

// Faithful full-frame proxy of coldOpenIntroSceneEn beats (Motion Canvas renders
// text the same way: same webfont, same glow). Verifies size / centering / layout.
const INK = '#B7BCEA';
const GLOW = 'rgba(178,188,255,0.55)';
const BG = 'radial-gradient(circle at 12% 8%, rgba(246,231,212,0.05), transparent 55%), linear-gradient(180deg,#0B0C10,#12141A)';

const frames = [
  {name: 'beat1', size: 60, lines: ['IT LIVES IN EVERY PROJECT']},
  {name: 'beat3', size: 56, lines: ['WE SEE IT. WE RECOGNIZE IT.', 'AND WE PASS BY.']},
];

const b = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
for (const f of frames) {
  const p = await b.newPage();
  await p.setViewport({width: 1920, height: 1080, deviceScaleFactor: 1});
  const body = f.lines.map(l => `<div>${l}</div>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600&display=block" rel="stylesheet">
  <style>
    *{margin:0;box-sizing:border-box;}
    html,body{width:1920px;height:1080px;background:${BG};overflow:hidden;}
    .stage{width:1920px;height:1080px;display:flex;align-items:center;justify-content:center;}
    .t{text-align:center;text-transform:uppercase;color:${INK};
       font-family:'EB Garamond',serif;font-weight:500;font-size:${f.size}px;
       letter-spacing:4px;line-height:1.34;
       text-shadow:0 0 16px ${GLOW};}
  </style></head><body>
  <div class="stage"><div class="t">${body}</div></div>
  </body></html>`;
  await p.setContent(html, {waitUntil: 'networkidle0'});
  await p.evaluate(async () => { await document.fonts.ready; });
  await new Promise(r => setTimeout(r, 500));
  await p.screenshot({path: process.argv[2].replace('.png', `_${f.name}.png`)});
  await p.close();
}
await b.close();
console.log('done');
