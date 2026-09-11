// Разовая проверка: где на кадре встанет колонка при камере проезда
// (duplicationWorldSceneEn, ракурс сзади слева, машина стоит).
import * as T from 'three';
import fs from 'node:fs';

const D2R = Math.PI / 180;
const FOV = 34, CAM_AZ = 25 * D2R, CAM_EL = 11 * D2R, FILL = Number(process.env.FILL ?? 0.52), TGT_DY = -0.16;
const W = 1920, H = 1080;

function bboxOfGlb(file) {
  const b = fs.readFileSync(file);
  let off = 12, json = null;
  while (off < b.length) {
    const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4);
    if (type === 0x4E4F534A) json = JSON.parse(b.slice(off + 8, off + 8 + len).toString('utf8'));
    off += 8 + len + ((4 - (len % 4)) % 4);
  }
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

const carBox = bboxOfGlb('public/honda_e.pts.glb');
const size = carBox.getSize(new T.Vector3());
const center = new T.Vector3(0, size.y / 2, 0);
const alongX = size.x >= size.z;
const halfLen = (alongX ? size.x : size.z) / 2, halfWid = (alongX ? size.z : size.x) / 2;
const tanX = Math.tan((FOV * D2R) / 2) * (W / H);
const DT = (halfLen * Math.sin(CAM_AZ) + halfWid * Math.cos(CAM_AZ)) / (FILL * tanX);
const dirLen = alongX ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 0, 1);
const fwdCar = dirLen.clone();
const leftCar = new T.Vector3(0, 1, 0).cross(fwdCar);
const flat = fwdCar.clone().multiplyScalar(-Math.cos(CAM_AZ)).addScaledVector(leftCar, Math.sin(CAM_AZ)).normalize();
const camDir = new T.Vector3(flat.x * Math.cos(CAM_EL), Math.sin(CAM_EL), flat.z * Math.cos(CAM_EL)).normalize();
const target = center.clone(); target.y += TGT_DY;
const cam = new T.PerspectiveCamera(FOV, W / H, 0.1, 400);
cam.position.copy(target).addScaledVector(camDir, DT);
cam.lookAt(target); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();

const P = (r, f, y) => {
  const v = new T.Vector3().copy(center).addScaledVector(leftCar, -r).addScaledVector(fwdCar, f);
  v.y = y; v.project(cam);
  return [Math.round((v.x + 1) / 2 * W), Math.round((1 - v.y) / 2 * H)];
};
console.log('DT', DT.toFixed(2), 'cam y', cam.position.y.toFixed(2));
console.log('car corners (right, fwd) → px:');
for (const [r, f] of [[-halfWid, halfLen], [halfWid, halfLen], [halfWid, -halfLen], [-halfWid, -halfLen]]) {
  console.log(`  r ${r.toFixed(2)} f ${f.toFixed(2)}: base ${P(r, f, 0)} roof ${P(r, f, size.y)}`);
}
const ch = bboxOfGlb('public/charging_station.pts.glb');
const cs = ch.getSize(new T.Vector3());
console.log('charger size', cs.toArray().map(v => v.toFixed(2)));
for (const [r, f] of JSON.parse(process.argv[2] ?? '[[2.5,-0.8]]')) {
  const hw = Math.max(cs.x, cs.z) / 2;
  console.log(`charger r ${r} f ${f}: base L ${P(r - hw, f, 0)} R ${P(r + hw, f, 0)}  top ${P(r, f, cs.y)}`);
}
