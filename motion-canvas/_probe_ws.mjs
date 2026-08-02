// Диагностика HMR-канала НАСТОЯЩИМ клиентом vite (с токеном из /@vite/client):
//   1) CDP-наблюдение за вебсокетом страницы редактора: 101? закрылся? кадры?
//   2) запись .meta через createHotContext (тот же путь, что у MetaFile).
// Реальные .meta проекта не трогает — пишет в скретч-файл.
import puppeteer from 'puppeteer';
import {readFileSync, existsSync, rmSync} from 'node:fs';

const ROOT = 'C:/Users/black/IdeaProjects/explainor-canvas/motion-canvas';
const SCRATCH =
  'C:/Users/black/AppData/Local/Temp/claude/C--Users-black-IdeaProjects-explainor-canvas/10025f88-07bd-46e3-8a70-a87e46f4daa2/scratchpad/_probe_ws.meta';
const URL = process.argv[2] ?? 'http://127.0.0.1:5173/src/project';

rmSync(SCRATCH, {force: true});
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox'],
  userDataDir: `${ROOT}/.probe-editor-profile`,
});
const page = await browser.newPage();
const cdp = await page.createCDPSession();
await cdp.send('Network.enable');

const sockets = {};
cdp.on('Network.webSocketCreated', e => {
  sockets[e.requestId] = {url: e.url.replace(/token=[^&]+/, 'token=***'), sent: 0, recv: 0};
});
cdp.on('Network.webSocketHandshakeResponseReceived', e => {
  if (sockets[e.requestId]) sockets[e.requestId].status = e.response.status;
});
cdp.on('Network.webSocketFrameSent', e => { if (sockets[e.requestId]) sockets[e.requestId].sent++; });
cdp.on('Network.webSocketFrameReceived', e => {
  const s = sockets[e.requestId];
  if (!s) return;
  s.recv++;
  if (!s.first) s.first = String(e.response.payloadData).slice(0, 60);
});
cdp.on('Network.webSocketClosed', e => { if (sockets[e.requestId]) sockets[e.requestId].closed = true; });

const t0 = Date.now();
await page.goto(URL, {waitUntil: 'domcontentloaded', timeout: 30000});
await new Promise(r => setTimeout(r, 3500));

// запись .meta настоящим клиентом (тот же код-путь, что MetaFile.saveData)
const rt = await page.evaluate(
  src =>
    (async () => {
      const t0 = performance.now();
      const mod = await import('/@vite/client');
      const hot = mod.createHotContext('/___probe.js');
      return await new Promise(resolve => {
        const timer = setTimeout(
          () => resolve({ok: false, why: 'timeout-4s', ms: Math.round(performance.now() - t0)}),
          4000,
        );
        hot.on('motion-canvas:meta-ack', d => {
          if (d?.source === src) {
            clearTimeout(timer);
            resolve({ok: true, ms: Math.round(performance.now() - t0)});
          }
        });
        hot.send('motion-canvas:meta', {source: src, data: {probe: 'real-client'}});
      });
    })(),
  SCRATCH,
);

const written = existsSync(SCRATCH);
console.log(`page load          ${Date.now() - t0} ms total (с паузой 3.5s)`);
console.log(`ws-соединения:     ${JSON.stringify(Object.values(sockets), null, 2)}`);
console.log(`meta через клиент: ${JSON.stringify(rt)}  file-written: ${written}`);
if (written) console.log(`содержимое: ${readFileSync(SCRATCH, 'utf8').replace(/\s+/g, ' ')}`);
rmSync(SCRATCH, {force: true});
await browser.close();
