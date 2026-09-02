import {PNG} from 'pngjs';
import {readFileSync} from 'node:fs';
const p = PNG.sync.read(readFileSync(process.argv[2]));
const at = (x,y)=>{const i=(y*p.width+x)*4;return [p.data[i],p.data[i+1],p.data[i+2]];};
// вертикальный срез сквозь ореол размытой строки и вниз в чистый фон
for (const x of [300, 470, 640]) {
  let runMax = 0, cur = 1, prev = null;
  const col = [];
  for (let y = 440; y < 900; y++) {
    const v = at(x,y)[2];
    col.push(v);
    if (v === prev) cur++; else { if (cur > runMax) runMax = cur; cur = 1; }
    prev = v;
  }
  const sample = [];
  for (let k = 0; k < col.length; k += 20) sample.push(col[k]);
  console.log(`x=${x}  самый длинный участок одного значения: ${runMax}px`);
  console.log(`   ${sample.join(' ')}`);
}
