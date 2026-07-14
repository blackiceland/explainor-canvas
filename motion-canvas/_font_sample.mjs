import puppeteer from 'puppeteer';

const LINE = 'It lives in every project';
const fonts = [
  {n: 'EB Garamond',        css: "'EB Garamond'",        w: 500},
  {n: 'Cormorant Garamond', css: "'Cormorant Garamond'", w: 600},
  {n: 'Cinzel',             css: "'Cinzel'",             w: 500},
  {n: 'Newsreader',         css: "'Newsreader'",         w: 500},
  {n: 'IM Fell English',    css: "'IM Fell English'",    w: 400},
];

const rows = fonts.map((f, i) => `
  <div class="row">
    <span class="lab">${i + 1} · ${f.n}</span>
    <span class="t" style="font-family:${f.css};font-weight:${f.w}">${LINE}</span>
  </div>`).join('');

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500&family=Cormorant+Garamond:wght@500;600&family=EB+Garamond:wght@400;500&family=IM+Fell+English&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=block" rel="stylesheet">
<style>
  *{margin:0;box-sizing:border-box;}
  body{background:#000;width:1440px;}
  .wrap{padding:70px 0;}
  .row{position:relative;height:150px;display:flex;align-items:center;justify-content:center;}
  .lab{position:absolute;left:48px;top:50%;transform:translateY(-50%);
       color:#54545e;font-family:monospace;font-size:15px;letter-spacing:1px;}
  .t{text-transform:uppercase;color:#B7BCEA;letter-spacing:3px;font-size:46px;
     text-shadow:0 0 16px rgba(168,178,255,0.42), 0 0 5px rgba(205,210,255,0.45);}
</style></head><body><div class="wrap">${rows}</div></body></html>`;

const out = process.argv[2];
const b = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
const p = await b.newPage();
await p.setViewport({width: 1440, height: 1000, deviceScaleFactor: 2});
await p.setContent(html, {waitUntil: 'networkidle0'});
await p.evaluate(async () => { await document.fonts.ready; });
await new Promise(r => setTimeout(r, 700));
await p.screenshot({path: out, fullPage: true});
await b.close();
console.log('done', out);
