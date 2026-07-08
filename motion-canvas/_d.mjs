import puppeteer from 'puppeteer';
const b = await puppeteer.launch({headless:'new',args:['--no-sandbox']});
const p = await b.newPage();
p.on('pageerror', e => console.log('[pageerror]', e.message));
p.on('console', m => { const t=m.text(); if(/error|fail|exception|is not|cannot|undefined/i.test(t)) console.log('[con]', t.slice(0,300)); });
await p.goto('http://127.0.0.1:5173/still.html?scene=fiveFacesSafetySceneRuV2&frame=300&fps=30&timeoutMs=90000&grid=off',{waitUntil:'domcontentloaded',timeout:90000});
try{ await p.waitForFunction(()=>window.__MC_STILL_DONE===true||typeof window.__MC_STILL_ERROR==='string',{timeout:90000,polling:200}); }catch(e){console.log('[wait]',String(e).split('\n')[0]);}
console.log('ERR:', await p.evaluate(()=>window.__MC_STILL_ERROR??null));
await b.close();
