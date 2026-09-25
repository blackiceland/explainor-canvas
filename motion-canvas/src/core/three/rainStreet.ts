import {
  AddEquation,
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  CanvasTexture,
  Color,
  CustomBlending,
  CylinderGeometry,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  OneFactor,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  SpotLight,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  ZeroFactor,
} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Reflector} from 'three/examples/jsm/objects/Reflector.js';
import {dressPostFace} from './postFace';

// ── Улица ночью под дождём: мир POV-кадра ─────────────────────────────────
// Та же стойка и та же Honda e, что в актах 1–3, но теперь мы стоим рядом:
// глаз на 1.62 м. Впереди слева стойка, за ней справа Honda e стоит на месте
// МОРДОЙ К НАМ (люк зарядки у неё на капоте, поэтому она и паркуется носом к
// стойке). Улица уходит от камеры (−Z) в туман.
//
// Мир разложен на слои для расфокуса (povCompositor): `mid` — всё, что ближе
// ~9 м (земля с плавным растворением, стойка, машина, ближний фонарь, дождь
// 1.8–6 м), `far` — дальние фонари, фасады с витринами, вся земля, дальний
// дождь, небо; `near` — только дождь у лица. Светящиеся точки дополнительно
// получают диски боке.
//
// ⚠️ Свет только от источников с телом: у каждого фонаря есть столб, консоль и
// светящаяся панель; окна и витрины светятся в проёмах фасадов.
// ⚠️ Мокрый асфальт — не зеркало. Отражение настоящее (Reflector), но шейдер
// тянет его вертикальной полосой там, где асфальт шершавый, и оставляет резким
// в лужах; в лужах от капель расходятся круги.

export const POST_URL = '/charging_station.glb';
export const CAR_URL = '/honda_e.glb';
const D2R = Math.PI / 180;

/** Глаз героя. */
export const EYE = new Vector3(0, 1.62, 0);
/** Стойка: слева впереди, у левого переднего угла машины. */
export const POST_POS = new Vector3(-0.55, 0, -3.9);
/** Средний слой (и его земля) растворяется между этими дистанциями, м. */
const MID_FADE = [8.5, 10.5];

// Свет, который ДОБАВЛЯЕТСЯ (отражение, дождь), в прозрачном слое не должен
// делать слой непрозрачным: обычное аддитивное смешение копит альфу, и земля
// среднего слоя за границей растворения закрывала дальний план чёрным.
// Цвет — сумма, альфа — как задана (для отражения — не трогается вовсе).
function lightBlend(m: ShaderMaterial, keepAlpha: boolean): void {
  m.blending = CustomBlending;
  m.blendEquation = AddEquation;
  m.blendSrc = OneFactor;
  m.blendDst = OneFactor;
  m.blendSrcAlpha = keepAlpha ? ZeroFactor : OneFactor;
  m.blendDstAlpha = OneFactor;
}

// Детерминированный шум: кадры обязаны совпадать между прогонами.
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

/** Точка света для дисков боке: мировая позиция, цвет, яркость, слой. */
export interface BokehSource {
  pos: Vector3;
  color: Color;
  power: number;
  layer: 'far' | 'mid';
}

export interface RainStreet {
  far: Scene;
  mid: Scene;
  /** Только дождь у самого лица (0.45–1.8 м). */
  near: Scene;
  post: Object3D;
  postMats: MeshStandardMaterial[];
  car: Object3D;
  bokeh: BokehSource[];
  /** Дождь и круги в лужах: t — время сцены, с. */
  update: (t: number, camera: PerspectiveCamera) => void;
  /** Окружение для отражений: один раз, когда есть рендерер. */
  prepare: (renderer: WebGLRenderer) => void;
}

// ── Процедурные фактуры асфальта ──────────────────────────────────────────
function asphaltTextures(rnd: () => number) {
  const N = 1024;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; };
  // высота: мелкое зерно + щебень; из неё альбедо, шероховатость и нормали
  const h = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) h[i] = rnd() * 0.35;
  for (let k = 0; k < 14000; k++) {
    const x = (rnd() * N) | 0, y = (rnd() * N) | 0, r = 1 + ((rnd() * 2.2) | 0), v = 0.4 + rnd() * 0.6;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const p = ((y + dy + N) % N) * N + ((x + dx + N) % N);
      h[p] = Math.max(h[p], v);
    }
  }
  // лужи: мягкие пятна низкочастотного шума (бесшовно по тору)
  const puddle = new Float32Array(N * N);
  const blobs = Array.from({length: 26}, () => ({x: rnd() * N, y: rnd() * N, r: 40 + rnd() * 150, a: 0.5 + rnd() * 0.5}));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0;
    for (const b of blobs) {
      let dx = Math.abs(x - b.x); dx = Math.min(dx, N - dx);
      let dy = Math.abs(y - b.y); dy = Math.min(dy, N - dy);
      v += b.a * Math.exp(-(dx * dx + dy * dy) / (b.r * b.r));
    }
    puddle[y * N + x] = Math.min(1, Math.max(0, (v - 0.55) * 3));
  }
  const albedo = mk(), rough = mk(), normal = mk();
  const ga = albedo.getContext('2d')!, gr = rough.getContext('2d')!, gn = normal.getContext('2d')!;
  const ia = ga.createImageData(N, N), ir = gr.createImageData(N, N), inn = gn.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const p = y * N + x, q = p * 4;
    const hv = h[p], pv = puddle[p];
    // мокрый асфальт тёмный и ровный по тону: щебень лишь чуть светлее связующего
    // (контрастный щебень на экране читался как россыпь звёзд)
    const base = 30 + hv * 18 - pv * 8;
    ia.data[q] = base; ia.data[q + 1] = base + 1; ia.data[q + 2] = base + 3; ia.data[q + 3] = 255;
    const r = (0.42 - hv * 0.12) * (1 - pv) + 0.04 * pv;
    ir.data[q] = ir.data[q + 1] = ir.data[q + 2] = Math.round(r * 255); ir.data[q + 3] = 255;
    const hx = h[y * N + (x + 1) % N] - h[y * N + (x - 1 + N) % N];
    const hy = h[((y + 1) % N) * N + x] - h[((y - 1 + N) % N) * N + x];
    const s = 1.6 * (1 - pv);          // в луже зерно тонет — вода гладкая
    const nx = -hx * s, ny = -hy * s, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    inn.data[q] = Math.round((nx / l * 0.5 + 0.5) * 255);
    inn.data[q + 1] = Math.round((ny / l * 0.5 + 0.5) * 255);
    inn.data[q + 2] = Math.round((nz / l * 0.5 + 0.5) * 255);
    inn.data[q + 3] = 255;
  }
  ga.putImageData(ia, 0, 0); gr.putImageData(ir, 0, 0); gn.putImageData(inn, 0, 0);
  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new CanvasTexture(c);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = SRGBColorSpace;
    return t;
  };
  return {map: tex(albedo, true), roughnessMap: tex(rough, false), normalMap: tex(normal, false)};
}

// Стёртая разметка: белая краска с проплешинами (альфа из шума).
function wornPaintTexture(rnd: () => number): CanvasTexture {
  const W = 64, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, H);
  // износ — длинные мягкие потёртости вдоль линии (колёса ездят вдоль), без дыр
  const streaks = Array.from({length: 14}, () => ({y: rnd() * H, x: rnd() * W, len: 60 + rnd() * 220, w: 4 + rnd() * 10, k: 0.25 + rnd() * 0.35}));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let wear = 0;
    for (const s of streaks) {
      const dy = Math.abs(y - s.y) / s.len, dx = Math.abs(x - s.x) / s.w;
      wear = Math.max(wear, s.k * Math.max(0, 1 - dx * dx - dy * dy));
    }
    const a = Math.max(0, Math.min(1, 0.78 - wear + (rnd() - 0.5) * 0.18));
    const q = (y * W + x) * 4;
    img.data[q] = img.data[q + 1] = img.data[q + 2] = 255;
    img.data[q + 3] = Math.round(a * 255);
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

// Копия материала, которая растворяется с расстоянием от глаза (a → 0 между
// near и far метрами). Нужна земле среднего слоя.
function fadeWithDistance<T extends MeshStandardMaterial>(src: T, nearM: number, farM: number): T {
  const m = src.clone() as T;
  m.transparent = true;
  m.depthWrite = true;
  m.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
      gl_FragColor.a *= 1.0 - smoothstep(${nearM.toFixed(2)}, ${farM.toFixed(2)}, length(vViewPosition));`,
    );
  };
  m.customProgramCacheKey = () => 'fade' + nearM + '_' + farM;
  return m;
}

// Мягкое радиальное пятно: ореол фонаря в мокром воздухе.
function glowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.12, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.4, 'rgba(255,255,255,0.12)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  return new CanvasTexture(c);
}

// Фасад: штукатурка, межэтажные тяги, окна — часть горит тёплым, часть
// холодным. Первый этаж — витрины: широкие проёмы, некоторые светятся.
function facadeTexture(rnd: () => number, cols: number, rows: number) {
  const W = cols * 64, FLOOR = 96, SHOP = 128;
  const H = rows * FLOOR + SHOP;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const e = document.createElement('canvas'); e.width = W; e.height = H;
  const g = c.getContext('2d')!, ge = e.getContext('2d')!;
  g.fillStyle = '#22252a'; g.fillRect(0, 0, W, H);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  for (let i = 0; i < W * H / 60; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.03})`; g.fillRect(rnd() * W, rnd() * H, 2, 2); }
  const lit: {u: number; v: number; warm: boolean; power: number}[] = [];
  const warmCol = () => `rgb(${230 + rnd() * 25},${150 + rnd() * 40},${80 + rnd() * 40})`;
  const coolCol = () => `rgb(${150 + rnd() * 30},${175 + rnd() * 30},${210 + rnd() * 30})`;
  for (let r = 0; r < rows; r++) {
    g.fillStyle = '#1a1d21'; g.fillRect(0, r * FLOOR + 88, W, 8);
    for (let k = 0; k < cols; k++) {
      const x = k * 64 + 14, y = r * FLOOR + 22, w = 36, hh = 52;
      g.fillStyle = '#0c0e11'; g.fillRect(x, y, w, hh);
      if (rnd() < 0.28) {
        const warm = rnd() < 0.78;
        const col = warm ? warmCol() : coolCol();
        const a = 0.35 + rnd() * 0.65;
        ge.globalAlpha = a;
        ge.fillStyle = col; ge.fillRect(x, y, w, hh);
        // штора или глубина комнаты: низ окна темнее
        const gr = ge.createLinearGradient(0, y + hh * 0.5, 0, y + hh);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.7)');
        ge.globalAlpha = 1; ge.fillStyle = gr; ge.fillRect(x, y + hh * 0.5, w, hh * 0.5);
        lit.push({u: (x + w / 2) / W, v: (y + hh / 2) / H, warm, power: 0.3 * a});
      }
      ge.fillStyle = '#000'; ge.fillRect(x + w / 2 - 1.5, y, 3, hh);
      g.fillStyle = '#2a2e34'; g.fillRect(x - 2, y + hh, w + 4, 4);
    }
  }
  // первый этаж: витрины по две ячейки, между ними простенки
  const y0 = rows * FLOOR;
  g.fillStyle = '#16181c'; g.fillRect(0, y0, W, SHOP);
  g.fillStyle = '#2a2d32'; g.fillRect(0, y0, W, 10);           // карниз над витринами
  for (let k = 0; k + 1 < cols; k += 2) {
    const x = k * 64 + 10, w = 128 - 20, y = y0 + 22, hh = SHOP - 30;
    g.fillStyle = '#0a0b0d'; g.fillRect(x, y, w, hh);
    if (rnd() < 0.55) {
      const warm = rnd() < 0.7;
      const col = warm ? warmCol() : coolCol();
      const gr = ge.createLinearGradient(0, y, 0, y + hh);
      gr.addColorStop(0, col); gr.addColorStop(0.7, col); gr.addColorStop(1, 'rgba(0,0,0,1)');
      ge.globalAlpha = 0.55 + rnd() * 0.4;
      ge.fillStyle = gr; ge.fillRect(x, y, w, hh);
      ge.globalAlpha = 1;
      // переплёт витрины
      ge.fillStyle = '#000'; ge.fillRect(x + w / 2 - 2, y, 4, hh); ge.fillRect(x, y + hh * 0.18, w, 3);
      lit.push({u: (x + w / 2) / W, v: (y + hh * 0.45) / H, warm, power: 0.75});
    }
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 8;
  const te = new CanvasTexture(e); te.colorSpace = SRGBColorSpace; te.anisotropy = 8;
  return {map: t, emissiveMap: te, lit, H, SHOP, FLOOR};
}

// ── Мокрое отражение ───────────────────────────────────────────────────────
// Настоящее зеркальное отражение (Reflector), которое шейдер портит так, как
// его портит мокрый асфальт: на шершавом — тянет вертикальной полосой (свет
// фонаря превращается в дорожку), в луже — оставляет почти резким и качает
// кругами от капель. Френель: у ног отражение слабое, к горизонту сильное.
const WET_VS = /* glsl */ `
  uniform mat4 textureMatrix;
  uniform vec2 uRepeat;
  varying vec4 vProj;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vDist;
  #include <fog_pars_vertex>
  void main() {
    vProj = textureMatrix * vec4(position, 1.0);
    vUv = uv * uRepeat;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    vDist = length(mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const WET_FS = /* glsl */ `
  uniform vec3 color;
  uniform sampler2D tDiffuse;
  uniform sampler2D uRough;
  uniform sampler2D uNormal;
  uniform float uTime;
  uniform float uGain;
  uniform vec2 uFade;
  varying vec4 vProj;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vDist;
  #include <fog_pars_fragment>
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // круги от капель: в каждой клетке 0.45 м — своя капля со своей фазой
  vec2 ripples(vec2 p, float t) {
    vec2 acc = vec2(0.0);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 cell = floor(p / 0.45) + vec2(float(i), float(j));
      float h = hash(cell);
      vec2 c = (cell + vec2(hash(cell + 3.1), hash(cell + 7.7))) * 0.45;
      float ph = fract(t * 0.9 + h);
      vec2 d = p - c;
      float r = length(d);
      float ring = ph * 0.28;
      float w = exp(-pow((r - ring) * 60.0, 2.0)) * (1.0 - ph) * (1.0 - ph);
      acc += (r > 1e-4 ? d / r : vec2(0.0)) * sin((r - ring) * 180.0) * w;
    }
    return acc;
  }
  void main() {
    float rough = texture2D(uRough, vUv).r;
    float puddle = smoothstep(0.22, 0.07, rough);
    vec2 n = texture2D(uNormal, vUv).xy * 2.0 - 1.0;
    vec2 rip = ripples(vWorld.xz, uTime) * puddle;
    vec2 uv = vProj.xy / vProj.w + n * mix(0.010, 0.0015, puddle) + rip * 0.006;
    // вертикальная полоса: выборки вдоль экранной вертикали, шире на шершавом
    float spread = mix(0.085, 0.006, puddle) * clamp(8.0 / vDist, 0.35, 1.0);
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    for (int i = 0; i < 12; i++) {
      float k = float(i) / 11.0 - 0.35;
      float w = exp(-k * k * 5.0);
      acc += texture2D(tDiffuse, uv + vec2(0.0, k * spread)).rgb * w;
      wsum += w;
    }
    vec3 refl = acc / wsum;
    vec3 V = normalize(cameraPosition - vWorld);
    float cosT = clamp(V.y, 0.0, 1.0);
    float F = 0.05 + 0.95 * pow(1.0 - cosT, 5.0);
    float wet = mix(0.55, 1.0, puddle);
    float fade = uFade.y > 0.0 ? 1.0 - smoothstep(uFade.x, uFade.y, vDist) : 1.0;
    gl_FragColor = vec4(refl * color * F * wet * uGain * fade, 0.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #ifdef USE_FOG
      float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      gl_FragColor.rgb *= 1.0 - fogFactor;
    #endif
  }
`;

function makeWetReflector(size: Vector2, rough: Texture, normal: Texture, repeat: Vector2, fade: number[], resW: number, resH: number): Reflector {
  const refl = new Reflector(new PlaneGeometry(size.x, size.y), {
    textureWidth: resW, textureHeight: resH, clipBias: 0.003, color: 0xffffff,
    shader: {
      name: 'WetReflector',
      uniforms: {
        color: {value: null},
        tDiffuse: {value: null},
        textureMatrix: {value: null},
        uRough: {value: null},
        uNormal: {value: null},
        uRepeat: {value: new Vector2()},
        uTime: {value: 0},
        uGain: {value: 1},
        uFade: {value: new Vector2()},
        fogDensity: {value: 0},
        fogColor: {value: new Color()},
      },
      vertexShader: WET_VS,
      fragmentShader: WET_FS,
    },
  });
  const m = refl.material as ShaderMaterial;
  m.uniforms.uRough.value = rough;
  m.uniforms.uNormal.value = normal;
  m.uniforms.uRepeat.value.copy(repeat);
  m.uniforms.uFade.value.set(fade[0] ?? 0, fade[1] ?? 0);
  m.transparent = true;
  m.depthWrite = false;
  lightBlend(m, true);
  m.fog = true;
  refl.rotation.x = -Math.PI / 2;
  refl.position.y = 0.002;
  refl.renderOrder = 1;
  return refl;
}

// ── Дождь: тонкие квадраты вдоль падения, яркость — от фонарей ─────────────
const RAIN_VS = /* glsl */ `
  attribute vec3 seed;          // x, z, фаза
  uniform float uTime;
  uniform vec3 uBoxMin;
  uniform vec3 uBoxSize;
  uniform vec3 uCam;
  uniform vec3 uLamps[6];
  uniform float uLampPow[6];
  uniform float uSpeed;
  uniform float uLen;
  uniform float uWidth;
  varying float vA;
  varying float vU;
  varying float vV;
  void main() {
    // падение по кругу внутри коробки; ветер чуть сносит вправо
    float y = uBoxMin.y + uBoxSize.y * (1.0 - fract(seed.z + uTime * uSpeed / uBoxSize.y));
    vec3 head = vec3(uBoxMin.x + seed.x * uBoxSize.x + (uBoxMin.y + uBoxSize.y - y) * 0.06,
                     y, uBoxMin.z + seed.y * uBoxSize.z);
    vec3 dir = normalize(vec3(0.06, -1.0, 0.0));
    vec3 toCam = normalize(uCam - head);
    vec3 side = normalize(cross(dir, toCam));
    // position.x: −1..1 поперёк, position.y: 0 (голова) .. 1 (хвост вверх)
    vec3 p = head - dir * (position.y * uLen) + side * (position.x * uWidth * 0.5);
    // освещённость: фонари, рассеяние вперёд — капля между глазом и фонарём ярче
    float L = 0.0;
    for (int i = 0; i < 6; i++) {
      vec3 d = uLamps[i] - head;
      float r2 = dot(d, d);
      float fwd = max(0.0, dot(normalize(d), -toCam));
      L += uLampPow[i] / (1.0 + r2) * (0.25 + 1.6 * fwd * fwd);
    }
    vA = clamp(L, 0.0, 1.4);
    vU = position.x;
    vV = position.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;
const RAIN_FS = /* glsl */ `
  uniform vec3 uColor;
  uniform float uGain;
  varying float vA;
  varying float vU;
  varying float vV;
  void main() {
    float across = 1.0 - vU * vU;
    float along = (1.0 - vV) * smoothstep(0.0, 0.08, vV + 0.02);
    float a = vA * across * along * uGain;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

function makeRain(count: number, boxMin: Vector3, boxSize: Vector3, rnd: () => number, width: number) {
  const g = new InstancedBufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { seeds[i * 3] = rnd(); seeds[i * 3 + 1] = rnd(); seeds[i * 3 + 2] = rnd(); }
  g.setAttribute('seed', new InstancedBufferAttribute(seeds, 3));
  g.instanceCount = count;
  const mat = new ShaderMaterial({
    vertexShader: RAIN_VS,
    fragmentShader: RAIN_FS,
    uniforms: {
      uTime: {value: 0},
      uBoxMin: {value: boxMin.clone()},
      uBoxSize: {value: boxSize.clone()},
      uCam: {value: new Vector3()},
      uLamps: {value: Array.from({length: 6}, () => new Vector3(0, -100, 0))},
      uLampPow: {value: new Array(6).fill(0)},
      uSpeed: {value: 7.5},
      uLen: {value: 0.34},
      uWidth: {value: width},
      uColor: {value: new Color('#dfe6f0')},
      uGain: {value: 1.6},
    },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  lightBlend(mat, false);
  const mesh = new Mesh(g, mat);
  mesh.frustumCulled = false;
  return mesh;
}

// ── Фонарь: столб, консоль, светящаяся панель, свет вниз, ореол ────────────
interface Lamp { head: Vector3; power: number; color: Color; light: SpotLight }
function makeLamp(scene: Scene, x: number, z: number, glow: CanvasTexture, color: Color, shadow: boolean, dir: 1 | -1 = 1): Lamp {
  const g = new Group();
  const metal = new MeshStandardMaterial({color: '#3a3e44', roughness: 0.45, metalness: 0.6});
  const H = 6.3;
  const pole = new Mesh(new CylinderGeometry(0.055, 0.085, H, 16), metal);
  pole.position.set(x, H / 2, z);
  g.add(pole);
  const armLen = 1.1;
  const arm = new Mesh(new BoxGeometry(armLen, 0.06, 0.08), metal);
  arm.position.set(x + dir * armLen / 2, H - 0.05, z);
  g.add(arm);
  const headBody = new Mesh(new BoxGeometry(0.62, 0.09, 0.26), metal);
  const hx = x + dir * (armLen + 0.2), hy = H - 0.1;
  headBody.position.set(hx, hy, z);
  g.add(headBody);
  // светящаяся панель снизу головы — тело источника; туман её не глушит
  const panel = new Mesh(new PlaneGeometry(0.56, 0.2), new MeshBasicMaterial({color: color.clone().multiplyScalar(3.2), fog: false}));
  panel.rotation.x = Math.PI / 2;
  panel.position.set(hx, hy - 0.047, z);
  g.add(panel);
  // ореол в мокром воздухе
  const halo = new Mesh(new PlaneGeometry(2.4, 2.4), new MeshBasicMaterial({
    map: glow, color: color.clone().multiplyScalar(0.5), transparent: true, depthWrite: false,
    blending: AdditiveBlending, fog: false,
  }));
  halo.position.set(hx, hy - 0.12, z);
  halo.userData.billboard = true;
  g.add(halo);
  const light = new SpotLight(color, 60, 26, 62 * D2R, 0.65, 1.6);
  light.position.set(hx, hy - 0.06, z);
  light.target.position.set(hx - dir * 0.3, 0, z);
  if (shadow) {
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.bias = -0.0002;
    light.shadow.normalBias = 0.02;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 14;
  }
  g.add(light);
  g.add(light.target);
  scene.add(g);
  return {head: new Vector3(hx, hy - 0.06, z), power: 1, color, light};
}

// Тот же свет без тела — во второй слой: пятно фонаря лежит на земле обоих слоёв.
function lightOnly(scene: Scene, l: Lamp): void {
  const s = l.light.clone();
  s.castShadow = false;
  scene.add(s);
  const t = new Object3D();
  t.position.copy(l.light.target.position);
  scene.add(t);
  s.target = t;
}

export function* buildRainStreet(): Generator<any, RainStreet> {
  const rnd = mulberry32(11);
  const far = new Scene();
  const mid = new Scene();
  const near = new Scene();
  far.background = new Color('#0a0d13');
  const fogColor = new Color('#131824');
  far.fog = new FogExp2(fogColor, 0.058);
  mid.fog = new FogExp2(fogColor, 0.058);

  // Холодная подсветка неба и тёплый отскок от асфальта — едва-едва
  for (const s of [far, mid]) s.add(new HemisphereLight(0x33405a, 0x120f0c, 0.35));

  const glow = glowTexture();
  const lampColor = new Color('#FFC98A');
  const lamps: Lamp[] = [];
  // ближний фонарь — в среднем слое: его свет лежит на стойке и машине
  lamps.push(makeLamp(mid, -1.55, -2.4, glow, lampColor, true));
  for (const z of [-15, -27.5, -40, -52.5]) lamps.push(makeLamp(far, -1.55, z, glow, lampColor, false));
  // другая сторона улицы — холоднее
  const coolLamp = new Color('#D6E4FF');
  for (const z of [-11, -24, -37]) {
    const l = makeLamp(far, 11.2, z, glow, coolLamp, false, -1);
    l.power = 0.7;
    lamps.push(l);
  }
  lightOnly(far, lamps[0]);

  // ── земля ──
  // Полная земля — в дальнем слое. В среднем — её копия, которая растворяется
  // к MID_FADE: ближний асфальт размыт как стойка, дальний — как фонари, а шва
  // нет. (Одна земля в среднем слое закрыла бы низ фасадов и столбов: луч ниже
  // горизонта в среднем слое всегда упирается в асфальт.)
  const tx = asphaltTextures(rnd);
  const REP = new Vector2(10, 29);
  const road = new MeshStandardMaterial({
    map: tx.map, roughnessMap: tx.roughnessMap, normalMap: tx.normalMap,
    roughness: 1, metalness: 0, envMapIntensity: 0.6,
  });
  road.normalScale.set(0.6, 0.6);
  for (const t of [tx.map, tx.roughnessMap, tx.normalMap]) t.repeat.copy(REP);
  const GROUND = new Vector2(36, 104);
  const groundFar = new Mesh(new PlaneGeometry(GROUND.x, GROUND.y), road);
  groundFar.rotation.x = -Math.PI / 2;
  groundFar.position.set(2.5, 0, -44);
  groundFar.receiveShadow = true;
  far.add(groundFar);
  const groundMid = new Mesh(groundFar.geometry, fadeWithDistance(road, MID_FADE[0], MID_FADE[1]));
  groundMid.rotation.copy(groundFar.rotation);
  groundMid.position.copy(groundFar.position);
  groundMid.receiveShadow = true;
  groundMid.renderOrder = -1;
  mid.add(groundMid);

  // отражения: в среднем слое растворяются вместе с землёй
  const reflMid = makeWetReflector(GROUND, tx.roughnessMap, tx.normalMap, REP, MID_FADE, 1280, 720);
  (reflMid.material as ShaderMaterial).uniforms.uGain.value = 2.6;
  reflMid.position.set(2.5, 0.002, -44);
  mid.add(reflMid);
  const reflFar = makeWetReflector(GROUND, tx.roughnessMap, tx.normalMap, REP, [], 1280, 720);
  (reflFar.material as ShaderMaterial).uniforms.uGain.value = 1.8;
  reflFar.position.set(2.5, 0.002, -44);
  far.add(reflFar);
  const reflectors = [reflMid, reflFar];

  // разметка места: стёртая мокрая краска
  const paint = new MeshStandardMaterial({
    color: '#9a9ea2', roughness: 0.25, map: wornPaintTexture(rnd), transparent: true, depthWrite: false,
  });
  const line = (x: number, z: number, w: number, l: number) => {
    const m = new Mesh(new PlaneGeometry(w, l), paint);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.003, z);
    m.receiveShadow = true;
    mid.add(m);
  };
  line(0.35, -6.45, 0.1, 5.4);                 // левая граница места — у стойки
  line(2.95, -6.45, 0.1, 5.4);                 // правая
  const cap = new Mesh(new PlaneGeometry(0.1, 2.7), paint);   // передняя — поперёк
  cap.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  cap.position.set(1.65, 0.003, -3.8);
  mid.add(cap);

  // ── фасады с витринами ──
  const facades: {x: number; z0: number; z1: number; floors: number; face: 1 | -1}[] = [
    {x: -11, z0: 4, z1: -16, floors: 4, face: 1},
    {x: -11.6, z0: -16.5, z1: -35, floors: 5, face: 1},
    {x: -11, z0: -35.5, z1: -60, floors: 3, face: 1},
    {x: 16, z0: 2, z1: -20, floors: 4, face: -1},
    {x: 16, z0: -20.5, z1: -44, floors: 6, face: -1},
    {x: 16, z0: -44.5, z1: -70, floors: 3, face: -1},
    {x: 2.5, z0: -74, z1: -74, floors: 6, face: 1},
  ];
  const bokeh: BokehSource[] = [];
  for (const f of facades) {
    const len = Math.abs(f.z1 - f.z0) || 30;
    const cols = Math.max(4, Math.round(len / 3.2));
    const ft = facadeTexture(rnd, cols, f.floors);
    const hM = f.floors * 3.3 + 4.4;                // этажи по 3.3 м, витрины 4.4 м
    const mat = new MeshStandardMaterial({
      map: ft.map, emissiveMap: ft.emissiveMap, emissive: new Color('#ffffff'), emissiveIntensity: 1.6,
      roughness: 0.85, metalness: 0,
    });
    const plane = new Mesh(new PlaneGeometry(len, hM), mat);
    if (f.z0 === f.z1) {
      plane.position.set(f.x, hM / 2, f.z0);
    } else {
      plane.rotation.y = f.face * Math.PI / 2;
      plane.position.set(f.x, hM / 2, (f.z0 + f.z1) / 2);
    }
    far.add(plane);
    plane.updateMatrixWorld(true);
    // горящие окна и витрины — источники боке
    for (const w of ft.lit) {
      const p = new Vector3((w.u - 0.5) * len, (0.5 - w.v) * hM, 0.02).applyMatrix4(plane.matrixWorld);
      bokeh.push({pos: p, color: new Color(w.warm ? '#FFB877' : '#A9C4F2'), power: w.power, layer: 'far'});
    }
  }
  lamps.forEach((l, i) => bokeh.push({pos: l.head.clone(), color: l.color.clone(), power: l.power, layer: i === 0 ? 'mid' : 'far'}));

  // ── модели ──
  const loader = new GLTFLoader();
  const load = (u: string) => new Promise<any>((res, rej) => loader.load(u, res, undefined, rej));
  const postG = yield load(POST_URL);
  const carG = yield load(CAR_URL);

  const post = postG.scene as Object3D;
  post.position.copy(POST_POS);
  // лицо стойки (+X модели) — к глазу, чуть в сторону машины
  const toEye = EYE.clone().sub(POST_POS).setY(0).normalize();
  post.rotation.y = Math.atan2(-toEye.z, toEye.x) + 8 * D2R;
  const postMats: MeshStandardMaterial[] = [];
  // ⚠️ Диоды стойки нарисованы зелёным прямо в альбедо: при погашенной эмиссии
  // они всё равно читаются как «горит зелёный». Мёртвой стойке лишний зелёный
  // снимаем в самой текстуре и темним пропорционально — погасший диод остаётся
  // тёмной точкой, а не кляксой (жёсткая замена оставляла ореолы JPEG).
  const deadMap = (src: Texture | null): Texture | null => {
    const img = src?.image as (HTMLImageElement | ImageBitmap | undefined);
    if (!img) return src;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img as any, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) {
      const r = d.data[i], gg = d.data[i + 1], b = d.data[i + 2];
      const e = gg - Math.max(r, b);
      if (e > 2) {
        const k = 1 - Math.min(1, e / 36) * 0.62;
        d.data[i] = r * k; d.data[i + 1] = (gg - e) * k; d.data[i + 2] = b * k;
      }
    }
    g.putImageData(d, 0, 0);
    const t = new CanvasTexture(c);
    t.flipY = src!.flipY;
    t.colorSpace = SRGBColorSpace;
    t.wrapS = src!.wrapS; t.wrapT = src!.wrapT;
    t.anisotropy = 8;
    return t;
  };
  let deadTex: Texture | null = null;
  post.traverse((n: any) => {
    if (!n.isMesh) return;
    if (n.material.map) deadTex = deadTex ?? deadMap(n.material.map);
    n.castShadow = true;
    n.receiveShadow = true;
    n.material = n.material.clone();
    // мокрый пластик: блестит, но не зеркало
    n.material.roughness = Math.min(n.material.roughness ?? 1, 0.32);
    n.material.emissiveIntensity = 0;       // стойка мертва: ни одного диода
    n.material.envMapIntensity = 1.0;
    if (deadTex) n.material.map = deadTex;
    postMats.push(n.material);
  });
  // лицо стойки крупным планом — своё, чёткое (текстура модели 512×512 мылит)
  dressPostFace(post);
  mid.add(post);

  const car = carG.scene as Object3D;
  car.traverse((n: any) => {
    if (!n.isMesh) return;
    n.castShadow = true;
    n.receiveShadow = true;
    const m = n.material as MeshPhysicalMaterial;
    if (/CarPaint/i.test(m.name || '')) {
      m.roughness = Math.max(m.roughness ?? 0, 0.22);
      (m as any).clearcoat = 1;
      (m as any).clearcoatRoughness = 0.06;       // вода на лаке
      if (m.color && m.color.r > 0.95 && m.color.g > 0.95 && m.color.b > 0.95) m.color.setRGB(0.845, 0.833, 0.808);
    }
    if (/Emissive|Led|Lamp/i.test(m.name || '')) (m as any).emissiveIntensity = 0;
  });
  // машина на месте мордой к нам (+Z модели — перёд), нос в полуметре за стойкой
  car.rotation.y = 0;
  car.position.set(1.65, 0, -4.45 - 1.946);
  mid.add(car);

  // ── дождь ──
  // Три объёма по глубине — по слою на каждый: у самого ближнего дождя (у лица)
  // своё размытие, иначе капли в полуметре были бы резкими вместе со стойкой.
  const rainNear = makeRain(420, new Vector3(-1.1, 0.2, -1.8), new Vector3(2.4, 3.2, 1.35), rnd, 0.003);
  const rainMid = makeRain(2600, new Vector3(-2.6, 0, -8.5), new Vector3(6.4, 5.0, 6.7), rnd, 0.0038);
  const rainFar = makeRain(9000, new Vector3(-9, 0, -45), new Vector3(24, 9, 36.5), rnd, 0.008);
  (rainFar.material as ShaderMaterial).uniforms.uLen.value = 0.45;
  // дождь виден там, где его подсвечивает фонарь; ближние капли — тише, иначе
  // сплошная штриховка поверх кадра читается как наложенный фильтр
  (rainNear.material as ShaderMaterial).uniforms.uGain.value = 0.9;
  (rainMid.material as ShaderMaterial).uniforms.uGain.value = 1.0;
  near.add(rainNear);
  mid.add(rainMid);
  far.add(rainFar);
  const rains = [rainNear, rainMid, rainFar];
  for (const r of rains) {
    const u = (r.material as ShaderMaterial).uniforms;
    lamps.slice(0, 6).forEach((l, i) => { u.uLamps.value[i].copy(l.head); u.uLampPow.value[i] = 6.0 * l.power; });
  }

  let envReady = false;
  const prepare = (renderer: WebGLRenderer) => {
    if (envReady) return;
    envReady = true;
    const pm = new PMREMGenerator(renderer);
    // окружение для бликов на лаке и пластике: снимок дальнего слоя от машины
    rainFar.visible = false;
    for (const r of reflectors) r.visible = false;
    const env = pm.fromScene(far, 0.02, 0.1, 200, {position: new Vector3(1.4, 1.2, -1.5)}).texture as Texture;
    rainFar.visible = true;
    for (const r of reflectors) r.visible = true;
    mid.environment = env;
    (mid as any).environmentIntensity = 0.85;
    pm.dispose();
  };

  const update = (t: number, camera: PerspectiveCamera) => {
    for (const r of rains) {
      const u = (r.material as ShaderMaterial).uniforms;
      u.uTime.value = t;
      u.uCam.value.copy(camera.position);
    }
    for (const r of reflectors) (r.material as ShaderMaterial).uniforms.uTime.value = t;
    // ореолы — к камере
    for (const s of [far, mid]) s.traverse(o => { if (o.userData.billboard) o.quaternion.copy(camera.quaternion); });
  };

  return {far, mid, near, post, postMats, car, bokeh, update, prepare};
}
