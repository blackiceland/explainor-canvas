import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  FogExp2,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  RepeatWrapping,
  Scene,
  SphereGeometry,
  SpotLight,
  Vector3,
} from 'three';

// ── Ночное окружение депо ──────────────────────────────────────────────────
// Двор акта 3 висел в пустоте: свет есть, а места нет. Здесь появляется место:
// улица за двором, склады с фактурой и настоящими окнами, деревья, фонари,
// туман и дождь.
//
// ⚠️ ВСЁ СТОИТ ПО СЕТКЕ ДВОРА. Первая раскладка считала окружение в базисе
// «от камеры», а склады разворачивала по сетке депо — между ними выходило 45°,
// и углы коробок залезали на дорогу («дома частично на дороге»). Теперь
// окружение живёт в узле `grid`, повторяющем поворот и позицию депо: ряды
// фургонов, остров стоек, дорога, тротуар и фасады складов параллельны.
// Координаты — (t, y, s): t вдоль улицы, s «вглубь» от камеры.
//
// ⚠️ Не силуэты и не коробки (автор: «дома выглядят как дешёвые коробки… это не
// наш путь»). У склада есть фактура профнастила, пилястры, парапет, ворота,
// блоки на крыше, рамы окон и лампа над воротами. Ночью это читается как
// склад, утром — тем более.
//
// ⚠️ Свет привязан к источникам: фонари двора и улицы, лампы над воротами,
// свет из окон — и у каждого есть тело, которое видно. Пятен «ниоткуда» нет.
// Дождь виден там, где свет: яркость капли посчитана по расстоянию до фонарей.

export interface DepotNight {
  group: Group;
  /** Все прожекторы (двор + улица): нужны сцене только для чтения. */
  lamps: SpotLight[];
  /** 0..1 — проявление окружения. */
  setReveal: (v: number) => void;
  /** 0..1 — плотность тумана; цвет — второй аргумент. */
  setFog: (v: number, color: Color) => void;
  /** 0..1 — фонари и лампы над воротами. */
  setLamps: (v: number) => void;
  /** 0..1 — окна складов: свет в проёмах, ореолы, источники у фасадов. */
  setWindows: (v: number) => void;
  /** t — время сцены (с), strength 0..1. */
  setRain: (t: number, strength: number) => void;
}

// Детерминированный шум: кадры стилл-харнесса обязаны совпадать между прогонами.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Процедурные фактуры ────────────────────────────────────────────────────
// Профнастил: вертикальные гофры, горизонтальные швы панелей, зерно.
function panelTexture(rnd: () => number): CanvasTexture {
  const px = 256;
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(px, px);
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      let v = 168;
      v += Math.sin((x / px) * Math.PI * 2 * 16) * 14;          // гофра
      if (y % 64 < 2) v -= 40;                                  // шов панели
      if (y % 64 === 2) v += 10;                                // блик кромки
      v += (rnd() - 0.5) * 12;                                  // зерно
      const i = (y * px + x) * 4;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v + 4; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  return tex;
}
// Ворота: горизонтальные ламели.
function shutterTexture(): CanvasTexture {
  const px = 128;
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#5a5f68';
  ctx.fillRect(0, 0, px, px);
  for (let y = 0; y < px; y += 10) {
    ctx.fillStyle = '#3d424a'; ctx.fillRect(0, y, px, 3);
    ctx.fillStyle = '#6a7079'; ctx.fillRect(0, y + 3, px, 1);
  }
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  return tex;
}
// Ореол света: радиальное затухание с дизерингом.
function haloTexture(rnd: () => number): CanvasTexture {
  const px = 128;
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(px, px);
  for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
    const dx = (x + 0.5) / px * 2 - 1, dy = (y + 0.5) / px * 2 - 1;
    const t = Math.min(1, Math.hypot(dx, dy));
    const a = Math.pow(1 - t, 2.2) * 255 + (rnd() - 0.5) * 2;
    const i = (y * px + x) * 4;
    img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255;
    img.data[i + 3] = Math.max(0, Math.min(255, a));
  }
  ctx.putImageData(img, 0, 0);
  return new CanvasTexture(c);
}

export function mountDepotNight(
  scene: Scene,
  depot: Object3D,
  opts: {
    /** Направление от двора к камере в плоскости XZ. */
    toCamera: Vector3;
    seed?: number;
  },
): DepotNight {
  const rnd = mulberry32(opts.seed ?? 7);

  const group = new Group();
  group.visible = false;
  scene.add(group);

  // Сетка двора: всё окружение — её дети.
  const grid = new Object3D();
  grid.position.copy(depot.position);
  grid.rotation.y = depot.rotation.y;
  group.add(grid);
  grid.updateMatrixWorld(true);

  // Куда смотрит камера в координатах сетки: локальная ось z «к камере» или «от».
  const zWorld = new Vector3(0, 0, 1).applyAxisAngle(new Vector3(0, 1, 0), depot.rotation.y);
  const cam = opts.toCamera.clone().setY(0).normalize();
  const backSign = zWorld.dot(cam) > 0 ? -1 : 1;        // локальный z, уходящий ОТ камеры
  const L = (t: number, y: number, s: number) => new Vector3(t, y, backSign * s);
  const toWorld = (v: Vector3) => grid.localToWorld(v.clone());
  // Плоскости (окна, ворота) по умолчанию смотрят в +z; если камера с −z — разворот.
  const faceRotY = backSign > 0 ? Math.PI : 0;

  // Материалы, которые проявляются вместе.
  const fading: {opacity: number; transparent: boolean}[] = [];
  const std = (color: number, roughness: number, extra: Partial<{metalness: number; map: CanvasTexture}> = {}) => {
    const m = new MeshStandardMaterial({color, roughness, transparent: true, opacity: 0, ...extra});
    fading.push(m);
    return m;
  };
  const basic = (color: number) => {
    const m = new MeshBasicMaterial({color, transparent: true, opacity: 0});
    fading.push(m);
    return m;
  };

  // ── Асфальт (матовый) ────────────────────────────────────────────────────
  // ⚠️ Лежит на 25 мм выше приёмника тени из chargingStage — иначе z-fighting
  // на 21 м («дёргаются тени»). Сам принимает тени: утром на него ложатся
  // тени деревьев и складов от низкого солнца.
  const ground = new Mesh(new PlaneGeometry(520, 520), std(0x0e1015, 0.92));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(depot.position.x, 0.025, depot.position.z);
  ground.receiveShadow = true;
  group.add(ground);

  // ── Улица за двором ──────────────────────────────────────────────────────
  // Проезжая часть, бордюры, тротуар со стороны складов, прерывистая осевая.
  // Улица длиннее видимого мира: в тумане она обязана уходить за кадр, а не
  // обрываться (автор: «дорогу до конца нарисуй, она обрывается»).
  const ROAD_S = 20.5, ROAD_W = 7, ROAD_L = 440;
  const road = new Mesh(new PlaneGeometry(ROAD_L, ROAD_W), std(0x1b1f26, 0.9));
  road.rotation.x = -Math.PI / 2;
  road.position.copy(L(0, 0.032, ROAD_S));
  road.receiveShadow = true;
  grid.add(road);
  const curbMat = std(0x2a2e35, 0.85);
  for (const edge of [-1, 1]) {
    const curb = new Mesh(new BoxGeometry(ROAD_L, 0.14, 0.26), curbMat);
    curb.position.copy(L(0, 0.09, ROAD_S + edge * (ROAD_W / 2 + 0.13)));
    curb.castShadow = true;
    curb.receiveShadow = true;
    grid.add(curb);
  }
  const walk = new Mesh(new PlaneGeometry(ROAD_L, 2.4), std(0x20242b, 0.9));
  walk.rotation.x = -Math.PI / 2;
  walk.position.copy(L(0, 0.04, ROAD_S + ROAD_W / 2 + 0.26 + 1.2));
  walk.receiveShadow = true;
  grid.add(walk);
  const dashMat = std(0xb4b9c2, 0.8);
  for (let t = -ROAD_L / 2 + 3; t < ROAD_L / 2; t += 7) {
    const dash = new Mesh(new PlaneGeometry(2.6, 0.16), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.copy(L(t, 0.04, ROAD_S));
    grid.add(dash);
  }

  // ── Склады ───────────────────────────────────────────────────────────────
  const panelTex = panelTexture(rnd);
  const shutterTex = shutterTexture();
  const haloTex = haloTexture(rnd);
  const trimMat = std(0x33383f, 0.8, {metalness: 0.1});
  const winWarm = basic(0xffd9a6);
  const winCool = basic(0xc9d8ff);
  const haloWarm = new MeshBasicMaterial({map: haloTex, color: 0xffb870, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false});
  const haloCool = new MeshBasicMaterial({map: haloTex, color: 0x9fb4e8, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false});
  const halos = [haloWarm, haloCool];
  const glareMat = basic(0xf2f6ff);
  const winLights: {light: PointLight; peak: number}[] = [];
  const doorLights: PointLight[] = [];

  // Фронты всех складов ≥ 28 м от двора: улица (17..24) и тротуар (до 26.5)
  // свободны, ряд деревьев на 27.5.
  const BUILDINGS = [
    {s: 34, t: -22, w: 22, h: 9, d: 12},
    {s: 40, t: 0, w: 28, h: 12, d: 14},
    {s: 36, t: 24, w: 18, h: 7, d: 10},
    {s: 36, t: 46, w: 20, h: 10, d: 12},
    {s: 36, t: -46, w: 24, h: 8, d: 12},
    {s: 54, t: -14, w: 30, h: 15, d: 16},
    {s: 52, t: 30, w: 26, h: 13, d: 14},
  ];
  for (const b of BUILDINGS) {
    const tex = panelTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(b.w / 4, b.h / 4);
    const wall = new Mesh(new BoxGeometry(b.w, b.h, b.d), std(0x8a9099, 0.88, {map: tex}));
    wall.position.copy(L(b.t, b.h / 2, b.s));
    wall.castShadow = true;
    wall.receiveShadow = true;
    grid.add(wall);
    const faceZ = (off: number) => -backSign * (b.d / 2 + off);   // сторона камеры

    // Пилястры по фасаду и парапет по периметру крыши.
    const nPil = Math.floor(b.w / 6.4) + 1;
    for (let i = 0; i < nPil; i++) {
      const px = -b.w / 2 + 0.3 + i * ((b.w - 0.6) / Math.max(1, nPil - 1));
      const pil = new Mesh(new BoxGeometry(0.45, b.h, 0.4), trimMat);
      pil.position.set(px, 0, faceZ(0.1));
      wall.add(pil);
    }
    const parapet = new Mesh(new BoxGeometry(b.w + 0.5, 0.45, b.d + 0.5), trimMat);
    parapet.position.set(0, b.h / 2 + 0.1, 0);
    wall.add(parapet);
    // Блоки на крыше.
    const nUnits = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < nUnits; i++) {
      const u = new Mesh(new BoxGeometry(2.2, 1.3, 1.6), trimMat);
      u.position.set((rnd() - 0.5) * (b.w - 4), b.h / 2 + 0.65, (rnd() - 0.5) * (b.d - 4));
      wall.add(u);
    }
    // Ворота с ламелями и лампа над ними.
    const doorX = -b.w / 2 + 3.2 + rnd() * (b.w - 6.4);
    const door = new Mesh(new PlaneGeometry(4.2, 4.4), std(0xffffff, 0.7, {map: shutterTex, metalness: 0.2}));
    door.position.set(doorX, -b.h / 2 + 2.2, faceZ(0.03));
    door.rotation.y = faceRotY;
    wall.add(door);
    const lampGlare = new Mesh(new SphereGeometry(0.12, 8, 6), glareMat);
    lampGlare.position.set(doorX, -b.h / 2 + 4.9, faceZ(0.35));
    wall.add(lampGlare);
    const dl = new PointLight(0xffd2a0, 0, 12, 2);
    dl.position.set(doorX, -b.h / 2 + 4.8, faceZ(0.6));
    wall.add(dl);
    doorLights.push(dl);

    // Окна по верхним рядам фасада, горит примерно треть; у каждого — ореол.
    const cols = Math.floor(b.w / 3.2), rows = Math.floor((b.h - 2) / 3.2);
    let lit = 0;
    for (let c = 0; c < cols; c++) {
      for (let r = 1; r < rows; r++) {
        const lx = (c - (cols - 1) / 2) * 3.2;
        if (Math.abs(lx - doorX) < 2.6 && r < 2) continue;      // не над воротами
        const frame = new Mesh(new BoxGeometry(1.1, 1.45, 0.12), trimMat);
        const ly = 2.2 + r * 3.2 - b.h / 2;
        frame.position.set(lx, ly, faceZ(0.05));
        wall.add(frame);
        if (rnd() > 0.34) continue;
        const warm = rnd() < 0.7;
        const win = new Mesh(new PlaneGeometry(0.9, 1.25), warm ? winWarm : winCool);
        win.position.set(lx, ly, faceZ(0.12));
        win.rotation.y = faceRotY;
        wall.add(win);
        const halo = new Mesh(new PlaneGeometry(3.4, 3.4), warm ? haloWarm : haloCool);
        halo.position.set(lx, ly, faceZ(0.14));
        halo.rotation.y = faceRotY;
        wall.add(halo);
        lit++;
      }
    }
    if (lit > 0) {
      const wl = new PointLight(0xffc48a, 0, 32, 2);
      wl.position.set(0, 0.1, faceZ(1.0));
      wall.add(wl);
      winLights.push({light: wl, peak: Math.min(110, 12 * lit)});
    }
  }

  // ── Деревья ──────────────────────────────────────────────────────────────
  // Два ряда — со стороны двора и вдоль тротуара; ни одно не на проезжей части.
  const crownMat = std(0x141c16, 1.0);
  const trunkMat = std(0x1a1512, 0.95);
  const TREES = [
    {s: 14, t: -22, h: 7.0}, {s: 14, t: -8, h: 6.0}, {s: 14, t: 9, h: 7.5},
    {s: 14, t: 24, h: 6.5}, {s: 14, t: 38, h: 7.0}, {s: 14, t: -38, h: 8.0},
    {s: 27.5, t: -30, h: 7.0}, {s: 27.5, t: -2, h: 6.5},
    {s: 27.5, t: 16, h: 7.5}, {s: 27.5, t: 42, h: 6.5},
    {s: -4, t: -25, h: 7.0}, {s: -2, t: 27, h: 6.5},
  ];
  for (const tr of TREES) {
    const p = L(tr.t, 0, tr.s);
    const trunk = new Mesh(new CylinderGeometry(0.16, 0.24, tr.h * 0.45, 7), trunkMat);
    trunk.position.set(p.x, tr.h * 0.225, p.z);
    trunk.castShadow = true;
    grid.add(trunk);
    const r = tr.h * 0.27;
    for (let i = 0; i < 6; i++) {
      const k = i === 0 ? 1 : 0.55 + rnd() * 0.3;
      const crown = new Mesh(new SphereGeometry(r * k, 8, 6), crownMat);
      crown.position.set(
        p.x + (i ? (rnd() - 0.5) * r * 1.6 : 0),
        tr.h * 0.45 + r * 0.8 + (i ? (rnd() - 0.3) * r : 0),
        p.z + (i ? (rnd() - 0.5) * r * 1.6 : 0),
      );
      crown.scale.set(1, 0.8 + rnd() * 0.3, 1);
      crown.castShadow = true;
      grid.add(crown);
    }
  }

  // ── Фонари ───────────────────────────────────────────────────────────────
  // Тёплые натриевые: холодный белый сверху делал фургоны «белёсыми» (автор).
  const poleMat = std(0x262a30, 0.7, {metalness: 0.2});
  const lamps: SpotLight[] = [];
  const LAMP_I = 300;
  const lampAt = (t: number, s: number, H: number, aimLocal: Vector3, color: number, range: number) => {
    const p = L(t, 0, s);
    const pole = new Mesh(new CylinderGeometry(0.07, 0.11, H, 8), poleMat);
    pole.position.set(p.x, H / 2, p.z);
    pole.castShadow = true;
    grid.add(pole);
    const dir = aimLocal.clone().sub(p).setY(0).normalize();
    const head = new Mesh(new BoxGeometry(1.0, 0.22, 0.45), poleMat);
    head.position.set(p.x + dir.x * 0.5, H + 0.1, p.z + dir.z * 0.5);
    head.rotation.y = Math.atan2(dir.x, dir.z);
    grid.add(head);
    const glare = new Mesh(new SphereGeometry(0.16, 8, 6), glareMat);
    glare.position.set(p.x + dir.x * 0.5, H - 0.05, p.z + dir.z * 0.5);
    grid.add(glare);
    const spot = new SpotLight(color, 0, range, 0.95, 0.9, 2);
    spot.position.set(p.x + dir.x * 0.5, H, p.z + dir.z * 0.5);
    spot.target.position.copy(aimLocal).setY(0);
    grid.add(spot);
    grid.add(spot.target);
    lamps.push(spot);
    return toWorld(spot.position);
  };
  const lampWorld: Vector3[] = [];
  for (const [t, s] of [[-13, 11], [13, 11], [-14, -11], [14, -11]]) {
    lampWorld.push(lampAt(t, s, 7, new Vector3(0, 0, 0), 0xffcf94, 40));
  }
  for (const t of [-44, -14, 16, 46]) {
    lampWorld.push(lampAt(t, ROAD_S + ROAD_W / 2 + 2.0, 8, L(t, 0, ROAD_S), 0xffe2b0, 30));
  }

  // ── Дождь ────────────────────────────────────────────────────────────────
  const RAIN_N = 3600;
  const RAIN_H = 16, RAIN_LEN = 0.38;
  const RAIN_W = 56, RAIN_D = 50;
  const rainCenter = toWorld(L(0, 0, 8));
  const x0 = new Float32Array(RAIN_N), z0 = new Float32Array(RAIN_N);
  const y0 = new Float32Array(RAIN_N), spd = new Float32Array(RAIN_N);
  const pos = new Float32Array(RAIN_N * 6);
  const col = new Float32Array(RAIN_N * 6);
  for (let i = 0; i < RAIN_N; i++) {
    x0[i] = rainCenter.x + (rnd() - 0.5) * RAIN_W;
    z0[i] = rainCenter.z + (rnd() - 0.5) * RAIN_D;
    y0[i] = rnd() * RAIN_H;
    spd[i] = 8.5 + rnd() * 3.5;
    let b = 0.035;
    for (const l of lampWorld) {
      const d = Math.hypot(x0[i] - l.x, z0[i] - l.z);
      b += 1.0 * Math.max(0, 1 - d / 13) ** 1.6;
    }
    b = Math.min(1, b);
    for (const k of [0, 1]) {
      const o = (i * 2 + k) * 3;
      col[o] = 0.78 * b; col[o + 1] = 0.80 * b; col[o + 2] = 0.9 * b;
      pos[o] = x0[i]; pos[o + 2] = z0[i]; pos[o + 1] = y0[i] + k * RAIN_LEN;
    }
  }
  const rainGeo = new BufferGeometry();
  const posAttr = new BufferAttribute(pos, 3);
  rainGeo.setAttribute('position', posAttr);
  rainGeo.setAttribute('color', new BufferAttribute(col, 3));
  const rainMat = new LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0,
    blending: AdditiveBlending, depthWrite: false,
  });
  const rain = new LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  group.add(rain);

  scene.fog = new FogExp2(0x0b0d13, 0);

  // Три ручки: проявление, окна, фонари — и одна apply().
  let reveal = 0, windows = 1, lampLevel = 0;
  const winMats = [winWarm, winCool];
  const apply = () => {
    group.visible = reveal > 0.005;
    for (const m of fading) m.opacity = reveal;
    for (const m of winMats) { m.opacity = reveal * windows; m.transparent = true; }
    for (const h of halos) h.opacity = 0.42 * reveal * windows;
    for (const w of winLights) w.light.intensity = w.peak * reveal * windows;
    for (const l of lamps) l.intensity = LAMP_I * lampLevel;
    for (const d of doorLights) d.intensity = 26 * lampLevel * reveal;
    glareMat.opacity = reveal * (lampLevel > 0.02 ? 1 : 0);
  };

  return {
    group,
    lamps,
    setReveal: (v: number) => { reveal = v; apply(); },
    setWindows: (v: number) => { windows = v; apply(); },
    setLamps: (v: number) => { lampLevel = v; apply(); },
    setFog: (v: number, color: Color) => {
      const f = scene.fog as FogExp2;
      f.density = 0.019 * v;     // при 0.028 склады с окнами тонули в тумане
      f.color.copy(color);
    },
    setRain: (t: number, strength: number) => {
      rainMat.opacity = 0.42 * strength;
      rain.visible = strength > 0.005;
      if (!rain.visible) return;
      for (let i = 0; i < RAIN_N; i++) {
        const y = (((y0[i] - spd[i] * t) % RAIN_H) + RAIN_H) % RAIN_H;
        pos[i * 6 + 1] = y;
        pos[i * 6 + 4] = y + RAIN_LEN;
      }
      posAttr.needsUpdate = true;
    },
  };
}
