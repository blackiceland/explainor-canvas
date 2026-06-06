// Crop a region of a PNG and upscale it (nearest-neighbour) so small glyphs
// like a single `&` are legible. Usage:
//   node scripts/zoom.mjs <file> <x> <y> <w> <h> [scale]
import {PNG} from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

const [file, xs, ys, ws, hs, ss] = process.argv.slice(2);
const x = +xs, y = +ys, w = +ws, h = +hs, scale = +(ss ?? 5);

const src = PNG.sync.read(fs.readFileSync(file));
const out = new PNG({width: w * scale, height: h * scale});

for (let oy = 0; oy < h * scale; oy++) {
  for (let ox = 0; ox < w * scale; ox++) {
    const sx = Math.min(src.width - 1, x + Math.floor(ox / scale));
    const sy = Math.min(src.height - 1, y + Math.floor(oy / scale));
    const si = (sy * src.width + sx) * 4;
    const di = (oy * out.width + ox) * 4;
    out.data[di] = src.data[si];
    out.data[di + 1] = src.data[si + 1];
    out.data[di + 2] = src.data[si + 2];
    out.data[di + 3] = src.data[si + 3];
  }
}

const dir = path.dirname(file);
const base = path.basename(file, '.png');
const dst = path.join(dir, `${base}_z.png`);
fs.writeFileSync(dst, PNG.sync.write(out));
console.log(`-> ${dst} (${w * scale}x${h * scale} from ${x},${y} ${w}x${h})`);
