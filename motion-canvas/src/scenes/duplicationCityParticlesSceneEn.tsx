import {makeScene2D} from '@motion-canvas/2d';
import {all, chain, createSignal, easeInOutSine, linear, waitFor} from '@motion-canvas/core';
import {
  AdditiveBlending,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  NoToneMapping,
  Object3D,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshSurfaceSampler} from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {createThreeView} from '../core/three/ThreeCanvas';
import {DollyRig, rng, type Rng} from '../core/three/hydra';
import {Screen} from '../core/theme';
import {applyBackground} from '../core/utils';
import {mountVignette} from '../core/components/SoftVignette';

// ═══════════════════════════════════════════════════════════════════════════
// ГОРОД ИЗ ТОЧЕК — ПРОТОТИП, такты 1→2 (10 секунд, без музыки и голоса).
//
// ⚠️ ГЛАВНОЕ ПРАВИЛО СЦЕНЫ: в кадре нет ничего, кроме частиц. Ни мешей, ни
// коробок, ни силуэтов, ни земли. Модели (стойка и машина) живут ровно один
// раз — при подготовке, где с их поверхности снимаются целевые позиции точек
// (MeshSurfaceSampler). В сцену модель не попадает: scene3 содержит один
// объект — Points. Убрать его — кадр пуст. Здания города тоже не меши: это
// пучки вертикальных колонн из точек, заданные числами.
//
// Форма существует только пока её держат точки. Разлетелись — под ней пусто.
//
// ⚠️ ПОЧЕМУ ЗДАНИЯ — КОЛОННЫ, А НЕ ТОЧКИ ПО ФАСАДАМ. Яркость поверхности из
// точек равна плотности точек НА КВАДРАТНЫЙ МЕТР и от выноса камеры не
// зависит. У станции это ~20000 точек на м², у здания при том же бюджете —
// два десятка: фасад выходит в тысячу раз тусклее станции, то есть невидим.
// Разница неустранима — станция три метра, квартал десять тысяч квадратов.
// Поэтому вещество здания собрано не в плоскость, а в ЛИНИИ: на колонне
// плотность считается на пиксель длины, а не площади, и та же горстка точек
// даёт яркий чёткий штрих. «Абстрактные вертикали» из брифа — буквально они.
//
// Всё состояние — чистая функция сигналов MC, пересчёт в onRender. Ни одного
// таймера по реальному времени: время сцены приходит сигналом sceneT, и дрейф
// точек в темноте считается от него же — сцена обязана скраббиться.
// ═══════════════════════════════════════════════════════════════════════════

const D2R = Math.PI / 180;
const QUALITY = 1.5;
const RW = Screen.width * QUALITY;
const RH = Screen.height * QUALITY;
const BG = '#0B0C10';                      // тот же графит, что у applyBackground
const INK = '#F4EEE0';                     // крем; цвета в сцене нет вовсе

const SEED = 20260905;

// ── Бюджет облака ──────────────────────────────────────────────────────────
// Одно облако, один BufferGeometry, один Points, один вызов отрисовки.
// ВСЕ точки стартуют на станции: город потом складывается из её же вещества.
// Обратно на станцию возвращается лишь малая доля — и это правда сюжета: она
// отдала материал городу. Пышность ПЕРВОГО кадра держится на всех пятистах
// тысячах; финальная плотность станции — только на N_STATION.
const N = 500_000;
const N_STATION = 90_000;
const N_RETURN = 0;                        // такт 5 (сборка в код) — не в прототипе
const N_CITY = N - N_STATION - N_RETURN;

// ── Материал точки ─────────────────────────────────────────────────────────
const PX = 2.3;                            // размер точки на опорной дистанции
const PX_REF = 10.5;                       // опорная дистанция = стартовый вынос
const PX_MIN = 1.15;                       // ниже — зажим с компенсацией альфой
const PX_MAX = 15.0;                       // потолок: точка у самого объектива
const ALPHA = 0.085;
const FLY_DIM = 0.45;                      // точка в полёте заметно тусклее
const HERO_BOOST = 1.6;                    // станция всегда ярче окружения
const ALPHA_FLOOR = 0.05;                  // дальние точки не исчезают совсем
// Материал города набирается по мере посадки: в полёте вещество однородно,
// «зажигается» оно только став зданием.
const CITY_GAIN = 5.0;
const CITY_PX = 2.1;

// ── Станция (позиции ровно как в chargingHeroDemoScene) ────────────────────
const faceTo = (dx: number, dz: number) => Math.atan2(-dz, dx);
const CAR_URL = '/honda_e.glb';
const POST_URL = '/charging_station.glb';
const CX = -0.70, CZ = 0.30;               // центр станции = центр города

// ── Город: сетка кварталов вокруг станции ──────────────────────────────────
const CELL = 11;                           // шаг сетки
const GRID = 3;                            // ячейки от -GRID до +GRID
const KEEPOUT = 9.5;                       // площадь вокруг станции: больше —
                                           // и пустырь в середине кадра съедает такт
const GAP_CHANCE = 0.16;                   // прорехи в застройке
const RINGS = 4;
const H_MIN = 5, H_MAX = 12;
const FOOT_MIN = 4.5, FOOT_MAX = 9;
const COL_JITTER = 0.13;                   // толщина колонны: без неё штрих алиасит
// ⚠️ Доля точек на ЮБКУ основания. Без неё колонны висят в темноте: земли в
// сцене нет, полом служит сам контур подошвы здания.
const SKIRT_SHARE = 0.16;
const SKIRT_H = 0.6;

// ── Волны сборки (в долях сигнала cityGrowth) ──────────────────────────────
// Квартал обязан СЛОЖИТЬСЯ до того, как стартует следующая волна: иначе всё
// перестраивается разом и ощущение продолжения теряется.
const T_STATION_SPAN = 0.10;
const RING_T0 = 0.17;
const RING_GAP = 0.19;
const RING_SPAN = 0.13;
const RING_JITTER = 0.02;

// ── Камера: одно движение — отход с подъёмом ───────────────────────────────
// ⚠️ Угол возвышения мал СОЗНАТЕЛЬНО. При взгляде сверху дальние здания
// упираются основаниями в середину кадра, а верхушки уходят за верхнюю кромку:
// квартал читается как занавесь дождя. При малом угле горизонт заходит в кадр,
// у города появляется даль, и колонны стоят на общей линии земли.
// ⚠️ Вынос финала выбран НЕ по размеру квартала, а по станции: узнаваемый
// силуэт трёхметровой стойки требует камеры в пределах тридцати метров.
// Дальние кольца при этом уходят за кромку кадра — и правильно: город растёт
// наружу, кадр его не вмещает, и это читается как продолжение.
const AZ = 14 * D2R;
const EL0 = 16 * D2R, EL1 = 19 * D2R;
const LEN0 = 10.5, LEN1 = 34;
const FOV = 34;
const TGT0 = new Vector3(-0.62, 1.00, 0.12);
const TGT1 = new Vector3(CX, 4.0, CZ);

const DUR = 10.0;

// Дизер последним пассом: ореол блума на плоском графите в 8 битах распадается
// на концентрические кольца; шум в ±1/255 их разбивает и сам не виден.
const DITHER = {
  uniforms: {tDiffuse: {value: null as any}},
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      gl_FragColor = vec4(c.rgb + n / 255.0, c.a);
    }
  `,
};

let _composer: EffectComposer | null = null;
let _renderPass: RenderPass | null = null;

// ───────────────────────────────────────────────────────────────────────────
// Подготовка: снять точки с поверхности моделей
// ───────────────────────────────────────────────────────────────────────────

/** Меши модели, годные под сэмплинг. Стёкла пропускаем: точки внутри кузова заплывают в силуэт. */
function collectMeshes(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  root.updateMatrixWorld(true);
  root.traverse((n: any) => {
    if (!n.isMesh || !n.geometry?.getAttribute?.('position')) return;
    const mats = Array.isArray(n.material) ? n.material : [n.material];
    if (mats.every((m: any) => m?.transparent && (m.opacity ?? 1) < 0.6)) return;
    out.push(n as Mesh);
  });
  return out;
}

/** Площадь меша В МИРОВЫХ единицах: доли сэмплов между мешами обязаны учитывать масштаб узлов. */
function worldArea(mesh: Mesh): number {
  const g = mesh.geometry as BufferGeometry;
  const pos = g.getAttribute('position') as any;
  const idx = g.index;
  const n = idx ? idx.count : pos.count;
  const M = mesh.matrixWorld;
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  const ab = new Vector3(), ac = new Vector3(), cr = new Vector3();
  let sum = 0;
  for (let i = 0; i + 2 < n; i += 3) {
    const i0 = idx ? idx.getX(i) : i;
    const i1 = idx ? idx.getX(i + 1) : i + 1;
    const i2 = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, i0).applyMatrix4(M);
    b.fromBufferAttribute(pos, i1).applyMatrix4(M);
    c.fromBufferAttribute(pos, i2).applyMatrix4(M);
    ab.subVectors(b, a); ac.subVectors(c, a);
    sum += cr.crossVectors(ab, ac).length() * 0.5;
  }
  return sum;
}

/** Раскидать count точек по поверхности набора моделей пропорционально площади. */
function sampleSurface(roots: Object3D[], count: number, rnd: Rng, out: Float32Array): void {
  const meshes = roots.flatMap(collectMeshes);
  const areas = meshes.map(worldArea);
  const total = areas.reduce((s, a) => s + a, 0) || 1;
  const p = new Vector3();
  let written = 0;
  for (let mi = 0; mi < meshes.length; mi++) {
    const left = count - written;
    if (left <= 0) break;
    const share = mi === meshes.length - 1
      ? left
      : Math.min(left, Math.round((count * areas[mi]) / total));
    if (share <= 0) continue;
    // ⚠️ Сид обязан дойти и до сэмплера, иначе облако будет разным на каждом
    // прогоне и стилл разойдётся с плеером. setRandomGenerator есть в рантайме
    // three 0.183, но его нет в @types — отсюда каст и проверка: молча уехать
    // на Math.random эта сцена не имеет права.
    const sampler = new MeshSurfaceSampler(meshes[mi]) as any;
    if (typeof sampler.setRandomGenerator !== 'function') {
      throw new Error('MeshSurfaceSampler без setRandomGenerator — сцена перестанет быть воспроизводимой');
    }
    sampler.setRandomGenerator(rnd);
    sampler.build();
    const M = meshes[mi].matrixWorld;
    for (let k = 0; k < share; k++) {
      sampler.sample(p);
      p.applyMatrix4(M);
      const o = (written + k) * 3;
      out[o] = p.x; out[o + 1] = p.y; out[o + 2] = p.z;
    }
    written += share;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Город: абстрактные вертикали. Не меши — числа.
// ───────────────────────────────────────────────────────────────────────────

interface Bld {
  x: number; z: number; h: number; w: number; d: number;
  cols: number[];                          // оси колонн, парами (dx, dz) от центра
  r: number; ring: number; weight: number; delay: number;
}

function makeCity(rnd: Rng): Bld[] {
  // Луч от камеры к станции держим свободным: иначе ближнее здание закрывает
  // якорь, а весь такт 2 держится на том, что станция ОСТАЛАСЬ и видна.
  const sightX = Math.sin(AZ), sightZ = Math.cos(AZ);
  const raw: Bld[] = [];
  let maxR = 0;
  for (let i = -GRID; i <= GRID; i++) {
    for (let j = -GRID; j <= GRID; j++) {
      const x = CX + i * CELL + (rnd() - 0.5) * 5.5;
      const z = CZ + j * CELL + (rnd() - 0.5) * 5.5;
      const dx = x - CX, dz = z - CZ;
      const r = Math.hypot(dx, dz);
      if (r < KEEPOUT) continue;
      if (rnd() < GAP_CHANCE) continue;
      if (r < 34 && (dx * sightX + dz * sightZ) / r > 0.93) continue;
      const w = FOOT_MIN + rnd() * (FOOT_MAX - FOOT_MIN);
      const d = FOOT_MIN + rnd() * (FOOT_MAX - FOOT_MIN);
      const h = H_MIN + rnd() * (H_MAX - H_MIN);
      // Колонны: четыре угла (они рисуют силуэт) плюс внутренние по площади.
      const cols: number[] = [
        -w / 2, -d / 2, w / 2, -d / 2, -w / 2, d / 2, w / 2, d / 2,
      ];
      const extra = Math.max(3, Math.min(10, Math.round(w * d * 0.16)));
      for (let e = 0; e < extra; e++) {
        cols.push((rnd() - 0.5) * w, (rnd() - 0.5) * d);
      }
      // Вес бюджета — длина всех колонн: плотность на метр штриха одинакова.
      raw.push({x, z, h, w, d, cols, r, ring: 0, weight: (cols.length / 2) * h, delay: 0});
      if (r > maxR) maxR = r;
    }
  }
  // Кольца по расстоянию от станции: город растёт наружу от неё, а не сразу весь.
  const step = Math.max(1e-3, (maxR - KEEPOUT) / RINGS);
  for (const b of raw) {
    b.ring = Math.max(0, Math.min(RINGS - 1, Math.floor((b.r - KEEPOUT) / step)));
    b.delay = RING_T0 + b.ring * RING_GAP + (rnd() - 0.5) * 2 * RING_JITTER;
  }
  return raw;
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  const rnd = rng(SEED);

  // ── Модели: используются РОВНО ОДИН РАЗ, в сцену не попадают ─────────────
  const loader = new GLTFLoader();
  const carGltf = yield new Promise<any>((res, rej) => loader.load(CAR_URL, res, undefined, rej));
  const postGltf = yield new Promise<any>((res, rej) => loader.load(POST_URL, res, undefined, rej));

  const ground0 = (root: Object3D) => {
    const b = new Box3().setFromObject(root);
    root.position.y -= b.min.y;
  };

  const car = carGltf.scene as Object3D;
  car.position.set(0.55, 0, -0.20);
  car.rotation.y = -31 * D2R;
  ground0(car);

  const post = postGltf.scene as Object3D;
  post.position.set(-1.95, 0, 0.85);
  post.rotation.y = faceTo(0.94, 0.34);
  ground0(post);

  // ── Буферы облака ────────────────────────────────────────────────────────
  const aStation = new Float32Array(N * 3);   // старт: ВСЕ точки на станции
  const aBurst = new Float32Array(N * 3);     // смещение распада — МЕСТНОЕ
  const aVia = new Float32Array(N * 3);       // контрольная точка дуги полёта
  const aCity = new Float32Array(N * 3);      // цель: станция или здание
  const aSeed = new Float32Array(N);
  const aGroup = new Float32Array(N);
  const aDelay = new Float32Array(N);
  const aSpan = new Float32Array(N);

  sampleSurface([post, car], N, rnd, aStation);

  // ⚠️ Группа станции — СЛУЧАЙНОЕ подмножество, а не первые индексы. Сэмплер
  // идёт мешами подряд, и «первые 90 тысяч» — это ровно один объект: в первой
  // версии на станции оставалась стойка, а вся машина улетала в город.
  const order = new Int32Array(N);
  for (let i = 0; i < N; i++) order[i] = i;
  for (let i = N - 1; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    const t = order[i]; order[i] = order[j]; order[j] = t;
  }

  // Распад: местная россыпь вокруг своего же места. Улетать сразу к будущему
  // зданию нельзя — вещество уходит за кадр и такт 1 играет в пустоту.
  for (let i = 0; i < N; i++) {
    const o = i * 3;
    const th = rnd() * Math.PI * 2;
    const ph = Math.acos(2 * rnd() - 1);
    const rad = 0.5 + 2.8 * Math.pow(rnd(), 0.7);
    const se = Math.sin(ph);
    aBurst[o] = se * Math.cos(th) * rad;
    aBurst[o + 1] = Math.abs(Math.cos(ph)) * rad * 0.8 + 0.5;
    aBurst[o + 2] = se * Math.sin(th) * rad;
    aSeed[i] = rnd();
  }

  // Станция: точки возвращаются на своё же место. Она якорь — единственная
  // форма, которая переживает распад и остаётся стоять.
  for (let k = 0; k < N_STATION; k++) {
    const i = order[k], o = i * 3;
    aCity[o] = aStation[o]; aCity[o + 1] = aStation[o + 1]; aCity[o + 2] = aStation[o + 2];
    aVia[o] = aStation[o] + aBurst[o] * 0.45;
    aVia[o + 1] = aStation[o + 1] + aBurst[o + 1] * 0.45 + 1.0;
    aVia[o + 2] = aStation[o + 2] + aBurst[o + 2] * 0.45;
    aGroup[i] = 0;
    aDelay[i] = 0;
    aSpan[i] = T_STATION_SPAN;
  }

  // Город: доли точек по суммарной длине колонн.
  const city = makeCity(rnd);
  const totalW = city.reduce((s, b) => s + b.weight, 0) || 1;
  // Радиус предыдущего кольца — над ним проходит дуга следующей волны:
  // вещество летит НАД уже построенным, а не мимо него.
  const ringR: number[] = [];
  for (let k = 0; k < RINGS; k++) {
    const inRing = city.filter(b => b.ring === k);
    ringR[k] = inRing.length ? inRing.reduce((s, b) => s + b.r, 0) / inRing.length : KEEPOUT;
  }

  let cursor = N_STATION;
  const end = N_STATION + N_CITY;
  for (let bi = 0; bi < city.length; bi++) {
    const b = city[bi];
    const left = end - cursor;
    if (left <= 0) break;
    const share = bi === city.length - 1
      ? left
      : Math.min(left, Math.round((N_CITY * b.weight) / totalW));
    const nCols = b.cols.length / 2;
    const skirt = Math.round(share * SKIRT_SHARE);
    const prevR = b.ring === 0 ? 0 : ringR[b.ring - 1];
    for (let k = 0; k < share; k++, cursor++) {
      const i = order[cursor], o = i * 3;
      if (k < skirt) {
        // Юбка: контур подошвы низкой полосой. Она рисует пол, на котором
        // здание стоит, — иначе колонны читаются как висящие штрихи.
        const t = rnd() * 2 * (b.w + b.d);
        let sx: number, sz: number;
        if (t < b.w) { sx = t - b.w / 2; sz = -b.d / 2; }
        else if (t < b.w + b.d) { sx = b.w / 2; sz = (t - b.w) - b.d / 2; }
        else if (t < 2 * b.w + b.d) { sx = (2 * b.w + b.d - t) - b.w / 2; sz = b.d / 2; }
        else { sx = -b.w / 2; sz = (2 * b.w + 2 * b.d - t) - b.d / 2; }
        aCity[o] = b.x + sx + (rnd() - 0.5) * COL_JITTER;
        aCity[o + 1] = Math.pow(rnd(), 1.7) * SKIRT_H;
        aCity[o + 2] = b.z + sz + (rnd() - 0.5) * COL_JITTER;
      } else {
        const c = (rnd() * nCols) | 0;
        aCity[o] = b.x + b.cols[c * 2] + (rnd() - 0.5) * COL_JITTER;
        aCity[o + 1] = rnd() * b.h;
        aCity[o + 2] = b.z + b.cols[c * 2 + 1] + (rnd() - 0.5) * COL_JITTER;
      }

      // Дуга полёта: контрольная точка на радиусе прошлого кольца, поднятая
      // над его крышами. Вещество нового квартала идёт ОТ построенного.
      const dx = aCity[o] - CX, dz = aCity[o + 2] - CZ;
      const rr = Math.hypot(dx, dz) || 1;
      const f = Math.min(0.9, (prevR / rr) * (0.85 + rnd() * 0.25));
      const spread = 2.5 + rr * 0.1;
      aVia[o] = CX + dx * f + (rnd() - 0.5) * spread;
      aVia[o + 1] = 5.0 + rnd() * (7.0 + prevR * 0.3);
      aVia[o + 2] = CZ + dz * f + (rnd() - 0.5) * spread;

      aGroup[i] = 1;
      aDelay[i] = b.delay + rnd() * 0.03;
      aSpan[i] = RING_SPAN;
    }
  }
  // Хвост бюджета (округления) — досыпаем на станцию, мёртвых точек быть не должно.
  for (; cursor < N; cursor++) {
    const i = order[cursor], o = i * 3;
    const src = order[cursor % N_STATION] * 3;
    aCity[o] = aStation[src]; aCity[o + 1] = aStation[src + 1]; aCity[o + 2] = aStation[src + 2];
    aVia[o] = aCity[o]; aVia[o + 1] = aCity[o + 1] + 1.5; aVia[o + 2] = aCity[o + 2];
    aGroup[i] = 0; aDelay[i] = 0; aSpan[i] = T_STATION_SPAN;
  }

  // ── Облако ───────────────────────────────────────────────────────────────
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(aStation, 3));
  geo.setAttribute('aBurst', new BufferAttribute(aBurst, 3));
  geo.setAttribute('aVia', new BufferAttribute(aVia, 3));
  geo.setAttribute('aCity', new BufferAttribute(aCity, 3));
  geo.setAttribute('aSeed', new BufferAttribute(aSeed, 1));
  geo.setAttribute('aGroup', new BufferAttribute(aGroup, 1));
  geo.setAttribute('aDelay', new BufferAttribute(aDelay, 1));
  geo.setAttribute('aSpan', new BufferAttribute(aSpan, 1));

  const mat = new ShaderMaterial({
    uniforms: {
      uDissolve: {value: 0},
      uGrow: {value: 0},
      uTime: {value: 0},
      uPx: {value: PX},
      uRef: {value: PX_REF},
      uMinPx: {value: PX_MIN},
      uMaxPx: {value: PX_MAX},
      uAlpha: {value: ALPHA},
      uFlyDim: {value: FLY_DIM},
      uHeroBoost: {value: HERO_BOOST},
      uCityGain: {value: CITY_GAIN},
      uCityPx: {value: CITY_PX},
      uFloor: {value: ALPHA_FLOOR},
      uColor: {value: new Color(INK).convertSRGBToLinear()},
    },
    vertexShader: `
      attribute vec3 aBurst;
      attribute vec3 aVia;
      attribute vec3 aCity;
      attribute float aSeed;
      attribute float aGroup;
      attribute float aDelay;
      attribute float aSpan;
      uniform float uDissolve, uGrow, uTime;
      uniform float uPx, uRef, uMinPx, uMaxPx;
      uniform float uAlpha, uFlyDim, uHeroBoost, uCityGain, uCityPx, uFloor;
      varying float vA;

      float ease(float t) { return t * t * (3.0 - 2.0 * t); }

      void main() {
        float seed = aSeed;

        // Такт 1. Распад идёт волной, а не разом: у каждой точки свой старт.
        float d = ease(clamp((uDissolve - seed * 0.42) / 0.58, 0.0, 1.0));

        // Дрейф в темноте. Только от времени сцены — сцена обязана скраббиться.
        float ph = seed * 6.28318;
        vec3 wob = vec3(sin(uTime * 0.42 + ph),
                        sin(uTime * 0.33 + ph * 1.7),
                        cos(uTime * 0.38 + ph * 2.3)) * (0.30 + 1.35 * seed);

        vec3 loose = position + aBurst * d + wob * d;

        // Такт 2. Сборка: своя задержка у каждой точки, форма нарастает волной.
        // Путь — квадратичная кривая через aVia: точка летит дугой над уже
        // построенным кольцом, а не по прямой из ниоткуда.
        float g = ease(clamp((uGrow - aDelay) / aSpan, 0.0, 1.0));
        float u = 1.0 - g;
        vec3 p = u * u * loose + 2.0 * u * g * aVia + g * g * aCity;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;

        // Перспективный размер с зажимом и компенсацией альфой: суммарная
        // яркость формы не зависит от того, как далеко отошла камера.
        // Материал города набирается по мере посадки — в полёте вещество
        // однородно, «зданием» оно становится, только встав на место.
        float settled = aGroup * g;
        float want = uPx * mix(1.0, uCityPx, settled) * uRef / max(-mv.z, 0.001);
        float size = clamp(want, uMinPx, uMaxPx);
        float k = want / size;

        float loosen = d * (1.0 - g);
        float a = uAlpha * mix(1.0, uFlyDim, loosen);
        a *= mix(uHeroBoost, 1.0, aGroup);
        a *= mix(1.0, uCityGain, settled);
        vA = a * clamp(k * k, uFloor, 1.0);
        gl_PointSize = size;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vA;
      void main() {
        if (vA < 0.0015) discard;
        vec2 q = gl_PointCoord - 0.5;
        float r = length(q) * 2.0;
        if (r > 1.0) discard;
        float core = 1.0 - smoothstep(0.45, 1.0, r);
        gl_FragColor = vec4(uColor, core * vA);
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });

  const cloud = new Points(geo, mat);
  cloud.frustumCulled = false;

  // ⚠️ В сцене РОВНО ОДИН объект. Никакой геометрии под точками нет.
  const scene3 = new Scene();
  scene3.add(cloud);

  const camera = new PerspectiveCamera(FOV, Screen.width / Screen.height, 0.1, 1200);
  const rig = new DollyRig(
    {az: AZ, el0: EL0, el1: EL1, len0: LEN0, len1: LEN1, fov0: FOV, fov1: FOV, tgt0: TGT0, tgt1: TGT1},
    camera,
  );

  // ── Сигналы ──────────────────────────────────────────────────────────────
  const dissolve = createSignal(0);      // распад станции
  const cityGrowth = createSignal(0);    // рост города от центра наружу
  const camP = createSignal(0);          // отъезд и подъём одним движением
  const returnToCode = createSignal(0);  // такт 5 — в прототипе не задействован
  const sceneT = createSignal(0);        // время сцены для дрейфа

  const threeView = createThreeView({
    width: Screen.width,
    height: Screen.height,
    quality: QUALITY,
    scene: scene3,
    camera,
    background: BG,
    onRender: (renderer, s, c) => {
      if (!_composer) {
        _renderPass = new RenderPass(s, c);
        _composer = new EffectComposer(renderer);
        _composer.setSize(RW, RH);
        _composer.addPass(_renderPass);
        _composer.addPass(new UnrealBloomPass(new Vector2(RW, RH), 0.62, 0.55, 0.16));
        _composer.addPass(new OutputPass());
        _composer.addPass(new ShaderPass(DITHER));
      }
      _renderPass!.scene = s;
      _renderPass!.camera = c;
      renderer.toneMapping = NoToneMapping;
      renderer.toneMappingExposure = 1.0;

      mat.uniforms.uDissolve.value = dissolve();
      mat.uniforms.uGrow.value = cityGrowth();
      mat.uniforms.uTime.value = sceneT();
      void returnToCode();

      rig.apply(camP());
      _composer.render();
    },
  });

  view.add(threeView.node);
  mountVignette(view, 0.5);

  // ── Такты ────────────────────────────────────────────────────────────────
  // 0.0  станция целиком — но уже из точек
  // 0.7  ТАКТ 1: распад, точки повисают в темноте и дрейфуют
  // 2.7  ТАКТ 2: камера отходит; станция собирается первой и остаётся стоять,
  //      вокруг неё кольцо за кольцом поднимается квартал
  yield* all(
    sceneT(DUR, DUR, linear),
    (function* () {
      yield* waitFor(0.7);

      // ⚠️ Камера уходит ВМЕСТЕ с распадом. С десяти метров облако шире
      // четырёх метров заливает кадр целиком, и вместо «станция рассыпалась»
      // получается серая стена пыли. К концу такта 1 вынос вдвое больше —
      // облако снова объект, у которого есть край и темнота вокруг.
      yield* all(
        dissolve(1, 2.0, easeInOutSine),
        camP(0.55, 2.4, easeInOutSine),
      );

      yield* all(
        camP(1, 6.2, easeInOutSine),
        chain(waitFor(0.2), cityGrowth(1, 6.0, linear)),
      );

      yield* waitFor(0.7);
    })(),
  );
});
