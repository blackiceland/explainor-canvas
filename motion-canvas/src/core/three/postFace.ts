import {
  CanvasTexture,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  Shape,
  SRGBColorSpace,
} from 'three';

// ── Лицо уличной стойки крупным планом ────────────────────────────────────
// У модели стойки (cedric4296) всё лицо нарисовано на одной текстуре 512×512:
// в актах 1–3 стойка мелкая, и этого не видно, а в POV-кадре лицевая панель
// растянута в четыре раза — мыльный экран, нечитаемые наклейки, пятна вместо
// диодов (автор: «панель страшная»). Корпус модели остаётся (силуэт тот же,
// что во всей главе), а лицо собирается поверх своими деталями: светлый
// корпусной лист, белая панель с фаской, ниша с чёрным стеклом экрана,
// тёмная полоса диодов, чёткие логотип и наклейки.
//
// Координаты — локальные у модели стойки: лицо смотрит в +X и лежит в
// плоскости x = FACE_X (измерено лучами: scratchpad/pov/station_ray.html),
// Y вверх, Z поперёк (+Z — левый край, если смотреть в лицо). Формы строятся
// в плоскости (u, v) = (−z, y): u растёт вправо от зрителя.
//
// ⚠️ Стойка мертва: экран — просто чёрное стекло с отражениями улицы, ни
// одного светящегося пикселя. «Мёртвая» читается отражениями, не надписью.

const FACE_X = 0.3631;
/** Ниша экрана в модели: u, v и глубина поверхностей (x) по лучам. */
const WIN = {u0: -0.2, u1: 0.19, v0: 0.88, v1: 1.54};
const DISPLAY = {v0: 1.225, x0: 0.3285, v1: 1.44, x1: 0.2552};   // наклон экрана ~19°
const TRAY_X = 0.353;

function roundedRect(p: Path, u0: number, v0: number, u1: number, v1: number, r: number) {
  p.moveTo(u0 + r, v0);
  p.lineTo(u1 - r, v0);
  p.quadraticCurveTo(u1, v0, u1, v0 + r);
  p.lineTo(u1, v1 - r);
  p.quadraticCurveTo(u1, v1, u1 - r, v1);
  p.lineTo(u0 + r, v1);
  p.quadraticCurveTo(u0, v1, u0, v1 - r);
  p.lineTo(u0, v0 + r);
  p.quadraticCurveTo(u0, v0, u0 + r, v0);
}

// Плоскость декали: холст → прозрачная наклейка чуть над поверхностью.
function decal(canvas: HTMLCanvasElement, w: number, h: number, rough = 0.45): Mesh {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  const m = new MeshStandardMaterial({
    map: t, transparent: true, roughness: rough, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const mesh = new Mesh(new PlaneGeometry(w, h), m);
  mesh.receiveShadow = true;
  return mesh;
}

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

// Логотип: знак-молния в скобке и надпись. Белая печать поверх корпуса.
function logoCanvas(): HTMLCanvasElement {
  const c = canvas(1024, 256);
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(244,244,242,0.92)';
  g.strokeStyle = 'rgba(244,244,242,0.92)';
  g.lineWidth = 14;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // знак: дуга и молния
  g.beginPath(); g.arc(118, 128, 78, Math.PI * 0.62, Math.PI * 2.38); g.stroke();
  g.beginPath();
  g.moveTo(132, 52); g.lineTo(92, 136); g.lineTo(128, 136); g.lineTo(104, 206); g.lineTo(158, 112); g.lineTo(122, 112); g.closePath();
  g.fill();
  g.font = '700 120px Manrope, Inter, sans-serif';
  g.textBaseline = 'middle';
  g.fillText('CHARGE', 236, 134);
  return c;
}

// Значок вилки с кабелем — жёлтой печатью, как у модели.
function plugCanvas(): HTMLCanvasElement {
  const c = canvas(256, 512);
  const g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(232,196,64,0.95)';
  g.fillStyle = 'rgba(232,196,64,0.95)';
  g.lineWidth = 12;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath(); g.moveTo(100, 40); g.lineTo(100, 96); g.moveTo(156, 40); g.lineTo(156, 96); g.stroke();
  g.beginPath(); g.moveTo(64, 96); g.lineTo(192, 96); g.lineTo(192, 138); g.quadraticCurveTo(192, 196, 128, 196); g.quadraticCurveTo(64, 196, 64, 138); g.closePath(); g.stroke();
  g.beginPath(); g.moveTo(128, 196); g.lineTo(128, 300); g.quadraticCurveTo(128, 350, 80, 360); g.lineTo(40, 368); g.stroke();
  return c;
}

// Наклейки на белой панели: табличка поста (как в приложении: Mill Street,
// пост 3), QR для оплаты и строки мелкого текста.
function stickerCanvas(): HTMLCanvasElement {
  const c = canvas(512, 1024);
  const g = c.getContext('2d')!;
  // табличка поста — тёмная, с номером
  g.fillStyle = '#23272d';
  g.beginPath(); g.roundRect(40, 40, 432, 170, 18); g.fill();
  g.fillStyle = '#f2f2ef';
  g.font = '700 44px Manrope, Inter, sans-serif';
  g.textBaseline = 'alphabetic';
  g.fillText('MILL ST', 72, 112);
  g.font = '700 96px Manrope, Inter, sans-serif';
  g.fillText('03', 318, 178);
  g.font = '400 30px Manrope, Inter, sans-serif';
  g.fillStyle = 'rgba(242,242,239,0.7)';
  g.fillText('DC · CCS · 50 kW', 72, 170);
  // QR: белый квадрат, три поисковых метки и модули
  const qx = 96, qy = 280, qs = 320, n = 25, cell = qs / n;
  g.fillStyle = '#fbfbf8';
  g.fillRect(qx - 24, qy - 24, qs + 48, qs + 48);
  let a = 20250925;
  const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  g.fillStyle = '#111316';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const finder = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
    if (finder) continue;
    if (rnd() < 0.47) g.fillRect(qx + x * cell, qy + y * cell, cell + 0.5, cell + 0.5);
  }
  const eye = (ex: number, ey: number) => {
    g.fillStyle = '#111316'; g.fillRect(qx + ex * cell, qy + ey * cell, 7 * cell, 7 * cell);
    g.fillStyle = '#fbfbf8'; g.fillRect(qx + (ex + 1) * cell, qy + (ey + 1) * cell, 5 * cell, 5 * cell);
    g.fillStyle = '#111316'; g.fillRect(qx + (ex + 2) * cell, qy + (ey + 2) * cell, 3 * cell, 3 * cell);
  };
  eye(0, 0); eye(n - 7, 0); eye(0, n - 7);
  g.fillStyle = '#5b6067';
  g.font = '400 26px Manrope, Inter, sans-serif';
  g.fillText('Scan to pay', 176, 668);
  // мелкий текст: инструкция и сервисный телефон
  g.fillStyle = 'rgba(70,74,80,0.85)';
  for (let i = 0; i < 7; i++) g.fillRect(56, 730 + i * 34, 380 - (i % 3) * 60, 12);
  g.fillStyle = '#c0392b';
  g.fillRect(56, 980, 140, 10);
  return c;
}

// Полоса диодов: тёмное стекло, под ним ряд погасших точек.
function ledCanvas(): HTMLCanvasElement {
  const c = canvas(2048, 128);
  const g = c.getContext('2d')!;
  g.fillStyle = '#121418';
  g.fillRect(0, 0, 2048, 128);
  for (let i = 0; i < 64; i++) {
    const x = 40 + i * 31.4;
    const gr = g.createRadialGradient(x, 64, 0, x, 64, 9);
    gr.addColorStop(0, 'rgba(70,76,84,1)');
    gr.addColorStop(1, 'rgba(18,20,24,1)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, 64, 9, 0, Math.PI * 2); g.fill();
  }
  return c;
}

/** Собирает новое лицо стойки и кладёт его дочерним узлом модели. */
export function dressPostFace(post: {add: (o: any) => void}): Group {
  const face = new Group();
  // формы строятся в (u, v) и выдавливаются по +Z; поворот делает +Z → +X
  const place = (m: Mesh, x: number) => {
    m.rotation.y = Math.PI / 2;
    m.position.x = x;
    m.castShadow = true;
    m.receiveShadow = true;
    face.add(m);
    return m;
  };

  // корпусной лист: весь фас до полосы диодов, с окном ниши экрана
  const housing = new MeshPhysicalMaterial({
    color: '#9aa0a8', roughness: 0.5, metalness: 0.05, clearcoat: 0.55, clearcoatRoughness: 0.18,
  });
  const hs = new Shape();
  roundedRect(hs, -0.432, 0.1, 0.442, 1.836, 0.012);
  const hwin = new Path();
  roundedRect(hwin, WIN.u0, WIN.v0, WIN.u1, WIN.v1, 0.012);
  hs.holes.push(hwin);
  place(new Mesh(new ExtrudeGeometry(hs, {depth: 0.002, bevelEnabled: false}), housing), FACE_X);

  // белая панель: скошенная верхняя кромка (правый край выше), скруглённый
  // нижний левый угол, окно ниши; фаска ловит блики мокрого пластика
  const white = new MeshPhysicalMaterial({
    color: '#e8e6e1', roughness: 0.42, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08,
  });
  const ps = new Shape();
  const L = -0.222, R = 0.428, B = 0.622, TL = 1.592, TR = 1.662;
  ps.moveTo(L + 0.06, B);
  ps.lineTo(R, B);
  ps.lineTo(R, TR);
  ps.bezierCurveTo(R - 0.25, TR - 0.004, L + 0.28, TL + 0.002, L + 0.03, TL);
  ps.quadraticCurveTo(L, TL, L, TL - 0.03);
  ps.lineTo(L, B + 0.06);
  ps.quadraticCurveTo(L, B, L + 0.06, B);
  const pwin = new Path();
  roundedRect(pwin, WIN.u0 - 0.004, WIN.v0 - 0.004, WIN.u1 + 0.004, WIN.v1 + 0.004, 0.014);
  ps.holes.push(pwin);
  place(new Mesh(new ExtrudeGeometry(ps, {
    depth: 0.004, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.0025, bevelSegments: 4, curveSegments: 24,
  }), white), FACE_X + 0.002);

  // ниша: дно, стенки, ступенька и козырёк — тёмный матовый пластик
  const dark = new MeshStandardMaterial({color: '#2b2e33', roughness: 0.62, metalness: 0});
  const wu = WIN.u1 - WIN.u0, cu = (WIN.u0 + WIN.u1) / 2;
  const plane = (w: number, h: number, mat: MeshStandardMaterial | MeshPhysicalMaterial) => {
    const m = new Mesh(new PlaneGeometry(w, h), mat);
    m.castShadow = false;
    m.receiveShadow = true;
    face.add(m);
    return m;
  };
  // дно нижней части (под разъёмом и считывателем)
  const tray = plane(wu, 1.2 - WIN.v0, dark);
  tray.rotation.y = Math.PI / 2;
  tray.position.set(TRAY_X + 0.0006, (WIN.v0 + 1.2) / 2, -cu);
  // ступенька от дна к экрану
  const stepH = Math.hypot(TRAY_X - DISPLAY.x0, DISPLAY.v0 - 1.2);
  const step = plane(wu, stepH, dark);
  step.position.set((TRAY_X + DISPLAY.x0) / 2 + 0.0006, (1.2 + DISPLAY.v0) / 2, -cu);
  step.rotation.set(0, Math.PI / 2, 0);
  step.rotateX(-Math.atan2(TRAY_X - DISPLAY.x0, DISPLAY.v0 - 1.2));
  // экран: чёрное стекло с наклоном; отражает улицу — ни одного пикселя света
  const glass = new MeshPhysicalMaterial({
    color: '#040506', roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02,
    envMapIntensity: 1.4, reflectivity: 0.6,
  });
  const dLen = Math.hypot(DISPLAY.x0 - DISPLAY.x1, DISPLAY.v1 - DISPLAY.v0);
  const disp = plane(wu - 0.03, dLen - 0.02, glass);
  disp.position.set((DISPLAY.x0 + DISPLAY.x1) / 2 + 0.0008, (DISPLAY.v0 + DISPLAY.v1) / 2, -cu);
  disp.rotation.set(0, Math.PI / 2, 0);
  disp.rotateX(-Math.atan2(DISPLAY.x0 - DISPLAY.x1, DISPLAY.v1 - DISPLAY.v0));
  // рамка экрана — тот же наклон, чуть шире стекла
  const bezel = plane(wu, dLen, dark);
  bezel.position.copy(disp.position).setX(disp.position.x - 0.0004);
  bezel.rotation.copy(disp.rotation);
  // козырёк над экраном: от верхней кромки экрана к лицу
  const hoodLen = Math.hypot(FACE_X - DISPLAY.x1, WIN.v1 - DISPLAY.v1);
  const hood = plane(wu, hoodLen, dark);
  hood.position.set((FACE_X + DISPLAY.x1) / 2 + 0.0006, (WIN.v1 + DISPLAY.v1) / 2, -cu);
  hood.rotation.set(0, Math.PI / 2, 0);
  hood.rotateX(Math.atan2(FACE_X - DISPLAY.x1, WIN.v1 - DISPLAY.v1));
  // боковые стенки ниши
  for (const u of [WIN.u0, WIN.u1]) {
    const wall = plane(0.12, WIN.v1 - WIN.v0, dark);
    wall.position.set(FACE_X - 0.06 + 0.001, (WIN.v0 + WIN.v1) / 2, -u);
    wall.rotation.y = u < 0 ? Math.PI : 0;
  }

  // полоса диодов: тёмное стекло, погасшие точки
  const ledT = new CanvasTexture(ledCanvas());
  ledT.colorSpace = SRGBColorSpace;
  ledT.anisotropy = 8;
  const led = new MeshPhysicalMaterial({map: ledT, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04});
  const ls = new Shape();
  roundedRect(ls, -0.432, 1.842, 0.442, 1.93, 0.008);
  const ledMesh = place(new Mesh(new ExtrudeGeometry(ls, {depth: 0.003, bevelEnabled: false}), led), FACE_X);
  // UV выдавливания — в метрах формы; растянуть текстуру на полосу
  ledT.repeat.set(1 / 0.874, 1 / 0.088);
  ledT.offset.set(0.432 / 0.874, -1.842 / 0.088);
  ledMesh.receiveShadow = true;

  // печать и наклейки
  const logo = decal(logoCanvas(), 0.36, 0.09);
  logo.rotation.y = Math.PI / 2;
  logo.position.set(FACE_X + 0.0028, 1.725, 0.245);
  face.add(logo);
  const plug = decal(plugCanvas(), 0.09, 0.18);
  plug.rotation.y = Math.PI / 2;
  plug.position.set(FACE_X + 0.0028, 0.74, 0.335);
  face.add(plug);
  const stick = decal(stickerCanvas(), 0.15, 0.3, 0.3);
  stick.rotation.y = Math.PI / 2;
  stick.position.set(FACE_X + 0.0092, 1.2, -0.325);
  face.add(stick);

  post.add(face);
  return face;
}
