// One-shot: extract a clean paper-area patch from the reference photo,
// resize to the page width, and stack it vertically with mirror flips
// so the diagonal weave fills PAGE_W × PAGE_H without visible seams.
import sharp from 'sharp';
import {mkdirSync} from 'fs';

const PHOTO = 'C:/Users/black/Downloads/photo_2026-05-08_12-21-06.jpg';
const OUT_DIR = 'public';
const OUT = `${OUT_DIR}/paper-weave.png`;

const PAGE_W = 980;
const PAGE_H = 1570;

// Photo: 720×1280. Page is bordered by ~30-50px of outer cream BG, plus
// a soft inner shadow ~30-40px in. Stay well inside both so only the
// pure woven interior makes it into the tile (no edge halos).
const TILE_X = 110;
const TILE_Y = 110;
const TILE_W = 500;
const TILE_H = 240;

// Centered boost around the paper midtone (~235): pixel = a*p + b with
// a=2.2, b=-282 keeps midtone roughly stable but widens the dark/light
// spread, so the woven nap actually reads.
const CONTRAST_A = 2.2;
const CONTRAST_B = -282;

mkdirSync(OUT_DIR, {recursive: true});

// Single-band stretch: resize the clean tile to the full page in one
// shot. The weave skews slightly more vertical (the source band gets
// stretched ~3× on Y) but the result has no tiling seams and the
// diagonal direction still reads.
await sharp(PHOTO)
    .extract({left: TILE_X, top: TILE_Y, width: TILE_W, height: TILE_H})
    .linear(CONTRAST_A, CONTRAST_B)
    .sharpen({sigma: 1.4, m1: 0.8, m2: 2.4})
    .resize({width: PAGE_W, height: PAGE_H, fit: 'fill', kernel: 'lanczos3'})
    .png()
    .toFile(OUT);

console.log(`wrote ${OUT}  ${PAGE_W}×${PAGE_H} (single-band stretch from ${TILE_W}×${TILE_H})`);
