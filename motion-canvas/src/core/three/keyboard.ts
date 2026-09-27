import {
  CanvasTexture,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// ── Клавиатура крупным планом: полноразмерная без цифрового блока (TKL) ─────
// В кадре с руками клавиатура на переднем плане: пустые кубики там читались
// заглушкой, компактная 65 % рядом с руками — игрушкой (правка автора). Здесь —
// ряд F1–F12, основной блок, стрелки и блок Ins/Home/PgUp; подписи на колпачках.
// Человек смотрит в +Z: ближний к нему ряд — с пробелом, его левая рука — +X.

export const KEY_U = 0.019;                  // шаг клавиш
const CAP_GAP = 0.0024;                      // зазор между колпачками
const CAP_H = 0.0075;                        // высота колпачка над основанием

type Key = [string, number];                 // подпись ('_' — промежуток), ширина в U
/** Ряд: y — середина в U от дальнего края, h — высота клавиш в U (по умолчанию 1). */
type Row = {y: number; h?: number; keys: Key[]};
/** Ряды от дальнего к ближнему. */
const TKL: Row[] = [
  {y: 0.5, keys: [['esc', 1], ['_', 1], ['F1', 1], ['F2', 1], ['F3', 1], ['F4', 1], ['_', 0.5], ['F5', 1], ['F6', 1], ['F7', 1], ['F8', 1],
    ['_', 0.5], ['F9', 1], ['F10', 1], ['F11', 1], ['F12', 1], ['_', 0.25], ['prt', 1], ['scr', 1], ['pse', 1]]},
  {y: 2, keys: [['`', 1], ['1', 1], ['2', 1], ['3', 1], ['4', 1], ['5', 1], ['6', 1], ['7', 1], ['8', 1], ['9', 1], ['0', 1], ['-', 1], ['=', 1],
    ['⌫', 2], ['_', 0.25], ['ins', 1], ['home', 1], ['pgup', 1]]},
  {y: 3, keys: [['tab', 1.5], ['Q', 1], ['W', 1], ['E', 1], ['R', 1], ['T', 1], ['Y', 1], ['U', 1], ['I', 1], ['O', 1], ['P', 1], ['[', 1], [']', 1],
    ['\\', 1.5], ['_', 0.25], ['del', 1], ['end', 1], ['pgdn', 1]]},
  {y: 4, keys: [['caps', 1.75], ['A', 1], ['S', 1], ['D', 1], ['F', 1], ['G', 1], ['H', 1], ['J', 1], ['K', 1], ['L', 1], [';', 1], ["'", 1], ['enter', 2.25]]},
  {y: 5, keys: [['shift', 2.25], ['Z', 1], ['X', 1], ['C', 1], ['V', 1], ['B', 1], ['N', 1], ['M', 1], [',', 1], ['.', 1], ['/', 1], ['shift', 2.75],
    ['_', 1.25], ['↑', 1]]},
  {y: 6, keys: [['ctrl', 1.25], ['win', 1.25], ['alt', 1.25], ['', 6.25], ['alt', 1.25], ['fn', 1.25], ['menu', 1.25], ['ctrl', 1.25],
    ['_', 0.25], ['←', 1], ['↓', 1], ['→', 1]]},
];
// Ноутбук: основной блок, короткий F-ряд, стрелки в ряду пробела; клавиши плоские.
const LAPTOP: Row[] = [
  {y: 0.3, h: 0.6, keys: [['esc', 1.5], ['F1', 1], ['F2', 1], ['F3', 1], ['F4', 1], ['F5', 1], ['F6', 1], ['F7', 1], ['F8', 1], ['F9', 1],
    ['F10', 1], ['F11', 1], ['F12', 1], ['⏻', 1.5]]},
  {y: 1.1, keys: [['`', 1], ['1', 1], ['2', 1], ['3', 1], ['4', 1], ['5', 1], ['6', 1], ['7', 1], ['8', 1], ['9', 1], ['0', 1], ['-', 1], ['=', 1], ['⌫', 2]]},
  {y: 2.1, keys: [['tab', 1.5], ['Q', 1], ['W', 1], ['E', 1], ['R', 1], ['T', 1], ['Y', 1], ['U', 1], ['I', 1], ['O', 1], ['P', 1], ['[', 1], [']', 1], ['\\', 1.5]]},
  {y: 3.1, keys: [['caps', 1.75], ['A', 1], ['S', 1], ['D', 1], ['F', 1], ['G', 1], ['H', 1], ['J', 1], ['K', 1], ['L', 1], [';', 1], ["'", 1], ['return', 2.25]]},
  {y: 4.1, keys: [['shift', 2.25], ['Z', 1], ['X', 1], ['C', 1], ['V', 1], ['B', 1], ['N', 1], ['M', 1], [',', 1], ['.', 1], ['/', 1], ['shift', 2.75]]},
  {y: 5.1, keys: [['fn', 1], ['ctrl', 1], ['opt', 1], ['cmd', 1.25], ['', 5.5], ['cmd', 1.25], ['opt', 1], ['←', 1], ['↓', 1], ['→', 1]]},
];
export type KeyLayout = 'tkl' | 'laptop';
const LAYOUTS: Record<KeyLayout, {rows: Row[]; cols: number; depth: number}> = {
  tkl: {rows: TKL, cols: 18.25, depth: 6.5},
  laptop: {rows: LAPTOP, cols: 15, depth: 5.6},
};
/** Ширина и глубина поля клавиш полноразмерной (TKL), м. */
export const KEYBOARD_SIZE = {w: 18.25 * KEY_U, d: 6.5 * KEY_U};
export const keyboardSize = (layout: KeyLayout) => ({w: LAYOUTS[layout].cols * KEY_U, d: LAYOUTS[layout].depth * KEY_U});

/** Центр клавиши (первой с такой подписью) для клавиатуры с центром (kx, kz), мир. */
export function keyCenter(label: string, kx: number, kz: number, layout: KeyLayout = 'tkl'): {x: number; z: number} {
  const L = LAYOUTS[layout];
  const W = L.cols * KEY_U, D = L.depth * KEY_U;
  for (const row of L.rows) {
    let col = 0;
    for (const [l, w] of row.keys) {
      if (l === label) return {x: kx + W / 2 - (col + w / 2) * KEY_U, z: kz + D / 2 - row.y * KEY_U};
      col += w;
    }
  }
  throw new Error(`клавиатура: нет клавиши ${label}`);
}

/** Центр клавиатуры по x, при котором граница G/H встаёт в x = gh (перед человеком). */
export function keyboardXForGH(gh: number, layout: KeyLayout = 'tkl'): number {
  return gh - (keyCenter('G', 0, 0, layout).x + keyCenter('H', 0, 0, layout).x) / 2;
}

export interface KeyboardStyle {
  cap: string;
  legend: string;
  base: string;
  /** Металл корпуса 0..1. */
  metal?: number;
}

export const KEYBOARDS: Record<string, KeyboardStyle> = {
  graphite: {cap: '#2a2b2f', legend: 'rgba(236,233,226,0.8)', base: '#b9bcc2', metal: 0.85},
  ivory: {cap: '#e4dfd4', legend: 'rgba(40,40,44,0.72)', base: '#d6d2c9', metal: 0},
  navy: {cap: '#26324a', legend: 'rgba(214,224,240,0.8)', base: '#1d2230', metal: 0.3},
  black: {cap: '#18191b', legend: 'rgba(230,230,232,0.7)', base: '#101113', metal: 0.2},
  // ноутбук: чёрные плоские клавиши на корпусе цвета «серый космос»
  laptop: {cap: '#141416', legend: 'rgba(225,226,230,0.78)', base: '#4a4c52', metal: 0.8},
};

/** Клавиатура с центром (x, z), верх колпачков на высоте top. У ноутбука корпуса
 *  нет (его рисует ноутбук), клавиши плоские. */
export function buildKeyboard(x: number, z: number, top: number, style: KeyboardStyle, layout: KeyLayout = 'tkl'): {group: Group; width: number; depth: number} {
  const g = new Group();
  const L = LAYOUTS[layout];
  const ROWS = L.rows, COLS = L.cols, DEPTH = L.depth;
  const W = COLS * KEY_U, D = DEPTH * KEY_U;
  const baseW = W + 0.016, baseD = D + 0.016;
  const flat = layout === 'laptop';
  const capH = flat ? 0.0025 : CAP_H;
  if (!flat) {
    const baseTop = top - CAP_H + 0.0015;
    const base = new Mesh(new RoundedBoxGeometry(baseW, 0.016, baseD, 3, 0.005),
      new MeshStandardMaterial({color: style.base, roughness: 0.4, metalness: style.metal ?? 0}));
    base.position.set(x, baseTop - 0.008, z);
    g.add(base);
  }

  // колпачки: один меш на все, ширина и высота ряда — масштабом
  const capGeo = new RoundedBoxGeometry(1, capH, 1, 2, flat ? 0.001 : 0.0022);
  const capMat = new MeshStandardMaterial({color: style.cap, roughness: 0.62});
  const count = ROWS.reduce((n, r) => n + r.keys.filter(k => k[0] !== '_').length, 0);
  const caps = new InstancedMesh(capGeo, capMat, count);
  const m = new Matrix4();
  // подписи рисуются на холсте в той же раскладке и лежат плоскостью на колпачках
  const PX = 64;                                   // пикселей на U
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(COLS * PX); cv.height = Math.ceil(DEPTH * PX);
  const c = cv.getContext('2d')!;
  c.fillStyle = style.legend;
  c.textBaseline = 'middle';
  let i = 0;
  for (const row of ROWS) {
    const rz = z + D / 2 - row.y * KEY_U;
    let col = 0;
    for (const [label, w] of row.keys) {
      if (label !== '_') {
        const cx = col + w / 2;                    // центр клавиши в U от левого края (его левая рука, +X)
        m.compose(new Vector3(x + W / 2 - cx * KEY_U, top - capH / 2, rz), new Quaternion(), new Vector3(w * KEY_U - CAP_GAP, 1, (row.h ?? 1) * KEY_U - CAP_GAP));
        caps.setMatrixAt(i++, m);
        if (label) {
          const long = label.length > 1;
          const rh = row.h ?? 1;
          c.font = `${long ? 500 : 600} ${long || rh < 1 ? 13 : 19}px "Inter", "Helvetica Neue", Arial, sans-serif`;
          c.textAlign = long ? 'left' : 'center';
          const top0 = (row.y - rh / 2) * PX;
          c.fillText(label, long ? (col + 0.16) * PX : cx * PX, top0 + (rh < 1 ? 0.5 : long ? 0.72 : 0.34) * rh * PX);
        }
      }
      col += w;
    }
  }
  g.add(caps);
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  const legends = new Mesh(new PlaneGeometry(W, D), new MeshStandardMaterial({
    map: tex, transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2,
  }));
  // холст: левый край — его левая рука (+X), верх — дальний ряд (+Z)
  legends.quaternion.setFromEuler(new Euler(-Math.PI / 2, Math.PI, 0, 'YXZ'));
  legends.position.set(x, top + 0.0002, z);
  g.add(legends);
  return {group: g, width: baseW, depth: baseD};
}
