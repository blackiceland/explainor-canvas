import {PNG} from 'pngjs';
import {readFileSync, writeFileSync} from 'node:fs';
const [,, src, x0, y0, w, h, out, boost] = process.argv;
const p = PNG.sync.read(readFileSync(src));
const X=+x0, Y=+y0, W=+w, H=+h, B=+(boost||1);
const o = new PNG({width: W, height: H});
for (let y=0;y<H;y++) for (let x=0;x<W;x++){
  const i=((Y+y)*p.width+(X+x))*4, j=(y*W+x)*4;
  for(let c=0;c<3;c++) o.data[j+c]=Math.min(255, p.data[i+c]*B);
  o.data[j+3]=255;
}
writeFileSync(out, PNG.sync.write(o));
console.log('ok', out);
