import puppeteer from 'puppeteer'; import fs from 'fs'; import path from 'path';
// Find centroids of DOMAIN-blue (#8AC7EF ~ rgb 138,199,239) text, split into upper/lower clusters.
const files = process.argv.slice(2);
const b = await puppeteer.launch({headless:true,args:['--no-sandbox']}); const p = await b.newPage();
for (const file of files) {
  const url='data:image/png;base64,'+fs.readFileSync(path.resolve(file)).toString('base64');
  const r = await p.evaluate(async (u)=>{
    const img=new Image();img.src=u;await img.decode();
    const c=document.createElement('canvas');c.width=img.width;c.height=img.height;
    const x=c.getContext('2d');x.drawImage(img,0,0);const d=x.getImageData(0,0,img.width,img.height).data;const W=img.width,H=img.height;
    const pts=[];
    for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++){const i=(y*W+xx)*4;const R=d[i],G=d[i+1],B=d[i+2];
      if(Math.abs(R-138)<45&&Math.abs(G-199)<45&&Math.abs(B-239)<45){pts.push([xx,y]);}}
    if(!pts.length)return null;
    // split by y gap into clusters
    const ys=pts.map(q=>q[1]).sort((a,b)=>a-b);
    let splitY=H; for(let k=1;k<ys.length;k++){if(ys[k]-ys[k-1]>60){splitY=(ys[k]+ys[k-1])/2;break;}}
    const up=pts.filter(q=>q[1]<splitY),lo=pts.filter(q=>q[1]>=splitY);
    const cen=g=>g.length?[Math.round(g.reduce((s,q)=>s+q[0],0)/g.length),Math.round(g.reduce((s,q)=>s+q[1],0)/g.length),Math.min(...g.map(q=>q[0]))]:null;
    return {up:cen(up),lo:cen(lo)};
  }, url);
  const nm = path.basename(file);
  console.log(`${nm}  upper(cx,cy,left)=${r?.up}  lower(cx,cy,left)=${r?.lo}`);
}
await b.close();
