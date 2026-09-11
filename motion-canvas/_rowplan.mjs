// Разовый план ряда домов: та же камера, что в duplicationWorldSceneEn, в конце
// отъезда. Проецирует фасады на кадр 715 и считает долю точек сетки при обрезке.
import * as T from 'three';
import fs from 'node:fs';

const D2R = Math.PI / 180;
const FOV = 34, CAM_AZ = 34 * D2R, CAM_EL = 11 * D2R, CAM_EL2 = 12 * D2R, FILL = 0.52;
const TGT_DY = -0.16, TGT_BACK = 2.4, TGT_UP = 0.9, CAM_PULL = 3.3, CAM_BREATH = 0.982;
const W = 1920, H = 1080;

const plan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

function readGlb(file) {
  const b = fs.readFileSync(file);
  let off = 12, json = null;
  while (off < b.length) {
    const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4);
    if (type === 0x4E4F534A) json = JSON.parse(b.slice(off + 8, off + 8 + len).toString('utf8'));
    off += 8 + len + ((4 - (len % 4)) % 4);
  }
  return json;
}

function bboxOfGlb(file) {
  const json = readGlb(file);
  const box = new T.Box3();
  const walk = (ni, parent) => {
    const n = json.nodes[ni];
    const m = new T.Matrix4();
    if (n.matrix) m.fromArray(n.matrix);
    else m.compose(new T.Vector3(...(n.translation ?? [0, 0, 0])),
      new T.Quaternion(...(n.rotation ?? [0, 0, 0, 1])), new T.Vector3(...(n.scale ?? [1, 1, 1])));
    const wm = parent.clone().multiply(m);
    if (n.mesh !== undefined) for (const p of json.meshes[n.mesh].primitives) {
      const a = json.accessors[p.attributes.POSITION];
      box.union(new T.Box3(new T.Vector3(...a.min), new T.Vector3(...a.max)).applyMatrix4(wm));
    }
    for (const c of n.children ?? []) walk(c, wm);
  };
  for (const r of json.scenes[json.scene ?? 0].nodes) walk(r, new T.Matrix4());
  return box;
}

const size = bboxOfGlb('public/honda_e.pts.glb').getSize(new T.Vector3());
const center = new T.Vector3(0, size.y / 2, 0);
const alongX = size.x >= size.z;
const halfLen = (alongX ? size.x : size.z) / 2, halfWid = (alongX ? size.z : size.x) / 2;
const tanX = Math.tan((FOV * D2R) / 2) * (W / H);
const DT = (halfLen * Math.sin(CAM_AZ) + halfWid * Math.cos(CAM_AZ)) / (FILL * tanX);
const dirLen = alongX ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 0, 1);
const dirWid = alongX ? new T.Vector3(0, 0, 1) : new T.Vector3(1, 0, 0);
const flat = dirLen.clone().multiplyScalar(Math.cos(CAM_AZ)).addScaledVector(dirWid, Math.sin(CAM_AZ)).normalize();
const camDir = new T.Vector3(flat.x * Math.cos(CAM_EL), Math.sin(CAM_EL), flat.z * Math.cos(CAM_EL)).normalize();
const target = center.clone(); target.y += TGT_DY;
const camPos = target.clone().addScaledVector(camDir, DT);
const fwd = target.clone().sub(camPos).normalize();
const right = new T.Vector3().crossVectors(fwd, new T.Vector3(0, 1, 0)).normalize();
const roadDir = right.clone().setY(0).normalize();
const roadNrm = new T.Vector3(fwd.x, 0, fwd.z).normalize();

const cam = new T.PerspectiveCamera(FOV, W / H, 0.1, 400);
{
  const el = CAM_EL2;
  const d = new T.Vector3(flat.x * Math.cos(el), Math.sin(el), flat.z * Math.cos(el)).normalize();
  const aim = target.clone().addScaledVector(flat, -TGT_BACK); aim.y += TGT_UP;
  cam.position.copy(aim).addScaledVector(d, DT * CAM_BREATH * CAM_PULL);
  cam.lookAt(aim); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
}
const P = (r, f, y) => {
  const v = new T.Vector3(center.x + roadDir.x * r + roadNrm.x * f, y, center.z + roadDir.z * r + roadNrm.z * f).project(cam);
  return [+((v.x + 1) / 2 * W).toFixed(1), +((1 - v.y) / 2 * H).toFixed(1)];
};

// Проверка по кадру 715: колонка ~(1180, 725), мачта ~(1030, 550).
console.log('size', size.toArray().map(x => x.toFixed(2)), 'DT', DT.toFixed(2), 'cam', cam.position.toArray().map(x => x.toFixed(2)));
console.log('charger', P(2.35, 0.3, 0), 'cctv', P(1.0, 8.6, 0), 'lamp-a', P(6.2, 2.6, 0), 'lamp-b', P(9.0, 6.0, 0));

// ── дома ──
const polys = [];
let x = plan.left;
const hs = plan.houses.map(h => { const o = {...h, r0: x, r1: x + h.w, hh: h.floors * plan.storey + plan.parapet}; x += h.w; return o; });
for (const [i, h] of hs.entries()) {
  const f0 = plan.rowF + h.set, f1 = f0 + plan.depth;
  polys.push({kind: 'front', pts: [P(h.r0, f0, 0), P(h.r1, f0, 0), P(h.r1, f0, h.hh), P(h.r0, f0, h.hh)]});
  // Видимая боковая стена — та, что смотрит к оси взгляда.
  const sides = [];
  if (h.r0 > 0) sides.push({r: h.r0, nb: hs[i - 1]});
  if (h.r1 < 0) sides.push({r: h.r1, nb: hs[i + 1]});
  for (const s of sides) polys.push({kind: 'side', pts: [P(s.r, f0, 0), P(s.r, f1, 0), P(s.r, f1, h.hh), P(s.r, f0, h.hh)]});
  console.log(`house ${i}: r ${h.r0}..${h.r1} h ${h.hh.toFixed(1)} top-y ${P((h.r0 + h.r1) / 2, f0, h.hh)[1]} base-y ${P((h.r0 + h.r1) / 2, f0, 0)[1]}`);
}

// ── доля точек сетки ──
function gridAcc(F1) {
  const GRID_CELL = 3, GRID_F0 = -4, GRID_W0 = 12, GRID_WK = 0.62, GRID_R0 = 10;
  const halfW = f => GRID_W0 + GRID_WK * Math.max(0, f - GRID_F0);
  const pc = [];
  for (let f = Math.ceil(GRID_F0 / GRID_CELL) * GRID_CELL; f <= F1 + 1e-6; f += GRID_CELL) {
    const hw = halfW(f);
    for (let sd = -hw; sd < hw; sd += 1) pc.push(sd, f, Math.min(sd + 1, hw), f);
  }
  const hwMax = halfW(F1);
  for (let sd = -Math.floor(hwMax / GRID_CELL) * GRID_CELL; sd <= hwMax + 1e-6; sd += GRID_CELL) {
    const fStart = Math.max(GRID_F0, GRID_F0 + (Math.abs(sd) - GRID_W0) / GRID_WK);
    for (let f = fStart; f < F1; f += 1) pc.push(sd, f, sd, Math.min(f + 1, F1));
  }
  let acc = 0;
  for (let k = 0; k < pc.length; k += 4) {
    const len = Math.hypot(pc[k + 2] - pc[k], pc[k + 3] - pc[k + 1]);
    const r = Math.hypot((pc[k] + pc[k + 2]) / 2, (pc[k + 1] + pc[k + 3]) / 2);
    acc += len / (1 + r / GRID_R0);
  }
  return {acc, rMax: Math.hypot(hwMax, F1)};
}
const g0 = gridAcc(150), g1 = gridAcc(plan.rowF);
console.log('grid share', (g1.acc / g0.acc).toFixed(4), 'points', Math.round(180000 * g1.acc / g0.acc), 'old rMax', g0.rMax.toFixed(2));

const svg = polys.map(p => `<polygon points="${p.pts.map(q => q.join(',')).join(' ')}" fill="${p.kind === 'front' ? 'rgba(120,200,255,0.18)' : 'rgba(255,160,80,0.22)'}" stroke="${p.kind === 'front' ? '#5cf' : '#fa5'}" stroke-width="2"/>`).join('');
fs.writeFileSync(plan.out, `<html><body style="margin:0"><div style="position:relative;width:${W}px;height:${H}px">
<img src="file:///C:/Users/black/IdeaProjects/explainor-canvas/motion-canvas/output/still/heroProject/000715.png" style="position:absolute;left:0;top:0">
<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0">${svg}</svg></div></body></html>`);
