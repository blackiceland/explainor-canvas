import {
  CanvasTexture,
  Color,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RectAreaLight,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {buildKeyboard, KEY_U, keyboardXForGH, KeyboardStyle, keyCenter, KeyLayout, keyboardSize} from './keyboard';

// ── Рабочее место: стол, монитор или ноутбук, клавиатура, мышь, экран ───────
// Для половинки «стол сбоку» у каждого из шести своё место (автор: «делай столы
// для остальных»). Человек сидит глазами в (0, 1.2, 0), смотрит в +Z; граница G/H
// клавиатуры — прямо перед ним. Монитор стоит там же, где в кабинете (на его
// месте камера лица — кадр лица у всех один); у ноутбука экран ниже и ближе.

export interface DeskSpec {
  /** Столешница: материал, высота, границы. */
  top: {kind: 'white' | 'oak' | 'black' | 'linoleum'; y: number; x0: number; x1: number; z0: number; z1: number; legs?: string};
  device: 'monitor' | 'laptop';
  /** Корпус монитора или ноутбука. */
  shell: string;
  shellMetal?: number;
  /** Отдельная клавиатура (у монитора). */
  keyboard?: KeyboardStyle;
  /** Цвет мыши (у монитора). */
  mouse?: string;
  /** Яркость экрана (множитель белого) и сила его света на человека. */
  screenGain: number;
  screenLight: number;
  lightColor?: string;
}

export interface Desk {
  /** Нарисовать на экране. */
  drawScreen: (draw: (g: CanvasRenderingContext2D, W: number, H: number) => void) => void;
  layout: KeyLayout;
  /** Клавиша в мире (центр). */
  keyAt: (label: string) => {x: number; z: number};
  keyTop: number;
  /** Кончики на домашнем ряду: глубина, середины по ширине для рук, разведение. */
  homeZ: number;
  homeX: [number, number];
  spread: number;
  screen: {center: Vector3; w: number; h: number; normal: Vector3};
  /** Габариты клавиатуры (для кадра). */
  keyboardBox: {x0: number; x1: number; z0: number; z1: number; y: number};
  mouseAt?: Vector3;
  trackpadAt?: Vector3;
}

const MON = {w: 0.597, h: 0.336, y: 1.13, z: 0.64};

// Контактная тень: мягкое пятно под предметом. Теней от света в сцене нет, и
// белая клавиатура на белом столе висела в воздухе (опенспейс).
let shadowTex: CanvasTexture | null = null;
function contactShadow(scene: Scene, x: number, z: number, w: number, d: number, y: number, k: number) {
  if (!shadowTex) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d')!;
    g.filter = 'blur(22px)';
    g.fillStyle = '#000';
    g.fillRect(48, 48, 160, 160);
    shadowTex = new CanvasTexture(c);
  }
  // пятно шире предмета: края размыты на ~40 % от середины
  const m = new Mesh(new PlaneGeometry(w * 1.6, d * 1.6), new MeshBasicMaterial({
    color: '#000', alphaMap: shadowTex, transparent: true, opacity: k, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
  }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y + 0.0005, z);
  m.renderOrder = 1;
  scene.add(m);
}

/** Сила контактной тени по столешнице: на белой нужна сильнее, на чёрной не видна. */
const SHADOW_K: Record<DeskSpec['top']['kind'], number> = {white: 0.42, oak: 0.5, black: 0.6, linoleum: 0.5};

function topMaterial(kind: DeskSpec['top']['kind']): Material {
  if (kind === 'white') return new MeshPhysicalMaterial({color: '#e9e7e2', roughness: 0.55, clearcoat: 0.15});
  if (kind === 'linoleum') {
    // мебельный линолеум: тёплый серый, матовый, с едва заметной крапиной
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d')!;
    const img = g.createImageData(256, 256);
    let a = 7;
    for (let i = 0; i < 256 * 256; i++) {
      a = (a * 1664525 + 1013904223) >>> 0;
      const n = ((a >>> 24) - 128) * 0.06;
      img.data[i * 4] = 150 + n; img.data[i * 4 + 1] = 147 + n; img.data[i * 4 + 2] = 141 + n; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
    return new MeshStandardMaterial({map: t, roughness: 0.82});
  }
  if (kind === 'black') return new MeshPhysicalMaterial({color: '#1b1c1e', roughness: 0.45, clearcoat: 0.25, clearcoatRoughness: 0.4});
  // дуб: тёплый, матовый
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d')!;
  const img = g.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const s = 0.5 + 0.5 * Math.sin((y / 512) * 70 + Math.sin(x / 60) * 1.6 + Math.sin(x / 17) * 0.25);
    const i = (y * 512 + x) * 4;
    img.data[i] = 186 - s * 26; img.data[i + 1] = 150 - s * 22; img.data[i + 2] = 108 - s * 18; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 8;
  return new MeshStandardMaterial({map: t, roughness: 0.62});
}

export function buildDesk(scene: Scene, spec: DeskSpec): Desk {
  const T = spec.top;
  const top = new Mesh(new RoundedBoxGeometry(T.x1 - T.x0, 0.03, T.z1 - T.z0, 3, 0.004), topMaterial(T.kind));
  top.position.set((T.x0 + T.x1) / 2, T.y - 0.015, (T.z0 + T.z1) / 2);
  scene.add(top);
  if (T.legs) {
    const legMat = new MeshStandardMaterial({color: T.legs, roughness: 0.35, metalness: 0.7});
    for (const x of [T.x0 + 0.05, T.x1 - 0.05]) for (const z of [T.z0 + 0.05, T.z1 - 0.05]) {
      const leg = new Mesh(new RoundedBoxGeometry(0.04, T.y - 0.03, 0.04, 2, 0.006), legMat);
      leg.position.set(x, (T.y - 0.03) / 2, z);
      scene.add(leg);
    }
  }
  const shell = new MeshStandardMaterial({color: spec.shell, roughness: 0.38, metalness: spec.shellMetal ?? 0.6});
  const laptop = spec.device === 'laptop';
  const layout: KeyLayout = laptop ? 'laptop' : 'tkl';

  // ── экран ──
  let screenCenter: Vector3, SW: number, SH: number, normal: Vector3, cw: number, ch: number;
  const screenMesh = (w: number, h: number) => new Mesh(new PlaneGeometry(w, h));
  let screen: Mesh;
  if (!laptop) {
    SW = MON.w; SH = MON.h; cw = 2048; ch = 1152;
    const body = new Mesh(new RoundedBoxGeometry(SW + 0.018, SH + 0.018, 0.022, 3, 0.006), shell);
    body.position.set(0, MON.y, MON.z + 0.012);
    const back = new Mesh(new RoundedBoxGeometry(0.34, 0.2, 0.04, 3, 0.012), shell);
    back.position.set(0, MON.y - 0.02, MON.z + 0.04);
    const neck = new Mesh(new RoundedBoxGeometry(0.06, 0.34, 0.02, 3, 0.006), shell);
    neck.position.set(0, T.y + 0.17, MON.z + 0.085);
    neck.rotation.x = -0.12;
    const foot = new Mesh(new RoundedBoxGeometry(0.24, 0.012, 0.18, 3, 0.005), shell);
    foot.position.set(0, T.y + 0.006, MON.z + 0.07);
    scene.add(body, back, neck, foot);
    contactShadow(scene, 0, MON.z + 0.07, 0.24, 0.18, T.y, SHADOW_K[T.kind]);
    screen = screenMesh(SW, SH);
    screen.position.set(0, MON.y, MON.z);
    screen.rotation.y = Math.PI;
    screenCenter = new Vector3(0, MON.y, MON.z);
    normal = new Vector3(0, 0, -1);
  } else {
    // ноутбук: корпус 30×21 см, крышка открыта на 105°
    const BW = 0.304, BD = 0.212, BH = 0.0155;
    const bx = 0, bz = T.z0 + 0.05 + BD / 2;
    const base = new Mesh(new RoundedBoxGeometry(BW, BH, BD, 3, 0.005), shell);
    base.position.set(bx, T.y + BH / 2, bz);
    scene.add(base);
    contactShadow(scene, bx, bz, BW, BD, T.y, SHADOW_K[T.kind] * 1.1);
    const hinge = new Vector3(bx, T.y + BH, bz + BD / 2 - 0.004);
    const tilt = 15 * Math.PI / 180;                  // назад от вертикали
    const up = new Vector3(0, Math.cos(tilt), Math.sin(tilt));
    const LH = 0.205;
    const lid = new Mesh(new RoundedBoxGeometry(BW, LH, 0.006, 3, 0.003), shell);
    lid.position.copy(hinge).addScaledVector(up, LH / 2).add(new Vector3(0, 0, 0.003));
    lid.rotation.x = tilt;                            // верх крышки — назад, от человека
    scene.add(lid);
    // рамка экрана и сам экран 16:10
    SW = 0.284; SH = 0.1775; cw = 1920; ch = 1200;
    const bezel = new Mesh(new PlaneGeometry(BW - 0.006, LH - 0.006), new MeshStandardMaterial({color: '#0c0c0d', roughness: 0.3}));
    bezel.position.copy(hinge).addScaledVector(up, LH / 2).add(new Vector3(0, 0, -0.0005));
    bezel.rotation.set(-tilt, Math.PI, 0, 'YXZ');
    scene.add(bezel);
    screenCenter = hinge.clone().addScaledVector(up, 0.016 + SH / 2).add(new Vector3(0, 0, -0.001));
    screen = screenMesh(SW, SH);
    screen.position.copy(screenCenter);
    screen.rotation.set(-tilt, Math.PI, 0, 'YXZ');
    normal = new Vector3(0, -Math.sin(tilt), -Math.cos(tilt)).normalize();
    // тачпад
    const pad = new Mesh(new RoundedBoxGeometry(0.12, 0.0008, 0.075, 2, 0.0004),
      new MeshStandardMaterial({color: '#5a5c62', roughness: 0.35, metalness: 0.6}));
    pad.position.set(bx, T.y + BH + 0.0002, bz - BD / 2 + 0.045);
    scene.add(pad);
  }
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d')!;
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  screen.material = new MeshBasicMaterial({map: tex, color: new Color(spec.screenGain, spec.screenGain, spec.screenGain)});
  scene.add(screen);
  // свет экрана — на человека
  const light = new RectAreaLight(new Color(spec.lightColor ?? '#c9d7ff'), spec.screenLight, SW, SH);
  light.position.copy(screenCenter).addScaledVector(normal, 0.01);
  light.lookAt(screenCenter.clone().addScaledVector(normal, 1));
  scene.add(light);

  // ── клавиатура ──
  let kx: number, kz: number, keyTop: number;
  if (!laptop) {
    kx = keyboardXForGH(0, 'tkl'); kz = 0.389; keyTop = T.y + 0.024;
    scene.add(buildKeyboard(kx, kz, keyTop, spec.keyboard!, 'tkl').group);
    const ks = keyboardSize('tkl');
    contactShadow(scene, kx, kz, ks.w + 0.016, ks.d + 0.016, T.y, SHADOW_K[T.kind]);
  } else {
    kx = keyboardXForGH(0, 'laptop');
    const BD = 0.212, bz = T.z0 + 0.05 + BD / 2;
    kz = bz + 0.028; keyTop = T.y + 0.0155 + 0.0026;
    scene.add(buildKeyboard(kx, kz, keyTop, spec.keyboard ?? {cap: '#141416', legend: 'rgba(225,226,230,0.78)', base: spec.shell}, 'laptop').group);
  }
  const keyAt = (label: string) => keyCenter(label, kx, kz, layout);
  const size = keyboardSize(layout);
  let mouseAt: Vector3 | undefined, trackpadAt: Vector3 | undefined;
  if (!laptop && spec.mouse) {
    const mouse = new Mesh(new SphereGeometry(0.03, 24, 16), new MeshStandardMaterial({color: spec.mouse, roughness: 0.4}));
    mouse.scale.set(1, 0.42, 1.75);
    mouseAt = new Vector3(-0.3, T.y + 0.008, 0.4);
    mouse.position.copy(mouseAt);
    scene.add(mouse);
    contactShadow(scene, mouseAt.x, mouseAt.z, 0.06, 0.1, T.y, SHADOW_K[T.kind] * 0.9);
  }
  if (laptop) {
    const BD = 0.212, bz = T.z0 + 0.05 + BD / 2;
    trackpadAt = new Vector3(0, T.y + 0.0157, bz - BD / 2 + 0.045);
  }
  const drawScreen = (draw: (g: CanvasRenderingContext2D, W: number, H: number) => void) => {
    draw(g, cw, ch);
    tex.needsUpdate = true;
  };
  const avg = (ls: string[]) => ls.reduce((a, l) => a + keyAt(l).x, 0) / ls.length;
  return {
    drawScreen, layout, keyAt, keyTop,
    homeZ: keyAt('F').z - 0.003,
    homeX: [avg(['A', 'S', 'D', 'F']), avg(['J', 'K', 'L', ';'])],
    spread: 3 * KEY_U,
    screen: {center: screenCenter, w: SW, h: SH, normal},
    keyboardBox: {x0: kx - size.w / 2 - 0.008, x1: kx + size.w / 2 + 0.008, z0: kz - size.d / 2 - 0.008, z1: kz + size.d / 2 + 0.008, y: keyTop},
    mouseAt, trackpadAt,
  };
}
