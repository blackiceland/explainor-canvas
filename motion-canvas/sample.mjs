import puppeteer from 'puppeteer'; import fs from 'fs'; import path from 'path';
const file = process.argv[2]; const pts = process.argv.slice(3).map(s=>s.split(',').map(Number));
const url='data:image/png;base64,'+fs.readFileSync(path.resolve(file)).toString('base64');
const b=await puppeteer.launch({headless:true,args:['--no-sandbox']});const p=await b.newPage();
const out=await p.evaluate(async(u,pts)=>{const img=new Image();img.src=u;await img.decode();
const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);
return pts.map(([px,py])=>{const d=x.getImageData(px,py,1,1).data;return `(${px},${py}) rgb(${d[0]},${d[1]},${d[2]})`;});},url,pts);
await b.close();console.log(out.join('\n'));
