import {makeScene2D, Rect} from '@motion-canvas/2d';
import {all, chain, createSignal, easeInOutSine, easeOutCubic, linear, waitFor} from '@motion-canvas/core';
import {NoToneMapping, PerspectiveCamera, Scene, Vector2, Vector3} from 'three';
import {createThreeView} from '../core/three/ThreeCanvas';
import {
  DollyRig,
  EndSparks,
  PointField,
  Ribbons,
  arc,
  evalLink,
  ridged,
  rng,
  sampleHeightfield,
  scheduleFlashes,
  vnoise,
} from '../core/three/hydra';
import {Screen} from '../core/theme';

// ═══════════════════════════════════════════════════════════════════════════
// ПОЛЕ ПЛОТНОСТИ — замена городу из коробок в акте 7 «Don't Fight Duplication».
//
// Почему поле, а не город. У коробок точки лежат на плоских гранях с равным
// шагом: равномерная плотность формы не несёт, и город читается силуэтами и
// чёрными окклюдерами, а поле точек оказывается шумом поверх геометрии. Здесь
// наоборот: точек нет ни одной «декоративной», вся картинка — ТОЛЬКО они.
//
// Механика поля (накопление вместо освещения, ни bloom, ни окклюзии, монохром,
// экспозиция по дистанции) живёт в Hydra — см. core/three/hydra/PointField.ts.
// Здесь только то, что принадлежит ЭТОЙ сцене: рельеф, кадр, такты.
//
// Всё состояние — чистая функция сигналов MC, пересчёт в onRender: сцена
// обязана скраббиться. Ни одного таймера по реальному времени.
// ═══════════════════════════════════════════════════════════════════════════

const D2R = Math.PI / 180;
const QUALITY = 1.5;
const RW = Screen.width * QUALITY;
const RH = Screen.height * QUALITY;

const BG = '#050506';                      // почти чёрный: чистый ноль давит энкодер

// Поле. Шире кадра сознательно — равнина обязана уходить за обе кромки.
const FW = 3600, FD = 1500;
const NX = 1100, NZ = 820;                 // ~1 млн точек, один вызов отрисовки
const HMAX = 1450;

// Геройский узел — та самая точка, из которой мы приехали.
const HERO_X = -240, HERO_Z = 180;

// Камера: одно движение. Не облёт — отход назад с сужением угла, поэтому
// перспектива к финалу почти вырождается в параллельную проекцию.
const AZ = 5 * D2R;
// Угол СИЛЬНО малый: равнина при нём сжимается в тонкую полосу, а массив
// возвышается над ней — та же пропорция, что в референсе.
const EL0 = 5.2 * D2R, EL1 = 6.5 * D2R;
// Финал снимается ДЛИННЫМ объективом с большого выноса. Короткий даёт
// перспективный разбег ближних рядов: передняя равнина расползается по низу
// кадра вторым призрачным хребтом.
const LEN0 = 95, LEN1 = 9500;
const FOV0 = 42, FOV1 = 8.0;
const TGT1 = new Vector3(0, 560, 0);

// Связи
const LINKS = 90;
const SEGS = 16;
const ARC = 0.10;
const NET_LEN = 22;
const EVENTS = 40;
const HERO_FLASH = [2.0, 7.4, 13.4];
const FLASH_DUR = 1.25;

function fieldH(x: number, z: number): number {
  // Огибающая массива. Радиус искажён шумом — иначе получается конус, а конус
  // читается как объект, а не как местность.
  const rx = x / 1120, rz = z / 780;
  let r = Math.hypot(rx, rz);
  r *= 0.70 + 0.66 * vnoise(x / 640, z / 640, 31);
  const env = Math.pow(Math.max(0, 1 - Math.min(1, r)), 1.5);

  // 6 октав, не больше: самая мелкая должна иметь период около 24 юнитов —
  // это ~8 точек решётки. Мельче — и складка перестаёт разрешаться.
  const body = ridged(x / 900, z / 900, 6, 7);
  // Равнина обязана быть СПОКОЙНОЙ: при большой амплитуде она сама
  // становится вторым хребтом и забивает низ кадра.
  const plain = (ridged(x / 300, z / 300, 4, 91) - 0.34) * 0.062;

  return HMAX * (body * env + plain * (0.28 + 0.72 * (1 - env)));
}

// Высота геройского узла берётся из самого поля — и цель камеры в первом
// кадре тоже. Иначе камера смотрит в точку под рельефом и первые секунды
// снимает пустоту.
const HERO_Y = fieldH(HERO_X, HERO_Z);
const TGT0 = new Vector3(HERO_X, HERO_Y, HERO_Z);

export default makeScene2D(function* (view) {
  // Плоский чёрный фон вместо графитового градиента проекта: в этом стиле
  // подложка обязана быть нулём, любой градиент сразу читается как «фон сцены».
  view.add(new Rect({width: Screen.width, height: Screen.height, fill: BG}));

  const rnd = rng(20260904);

  // ── Поле ─────────────────────────────────────────────────────────────────
  const buf = sampleHeightfield({
    width: FW, depth: FD, nx: NX, nz: NZ,
    height: fieldH,
    jitter: 0.6,
    hero: {x: HERO_X, z: HERO_Z},
    rnd,
  });
  const field = new PointField(buf, {px: 2.2, heroPx: 30, alpha: 0.16});
  field.points.renderOrder = 0;

  // ── Связи ────────────────────────────────────────────────────────────────
  // Якоря — вершины рельефа: сеть должна цепляться за сгущения, а не висеть
  // в произвольных местах. Минимальная дистанция между якорями обязательна,
  // иначе они кучкуются на одном гребне.
  const anchors: Vector3[] = [new Vector3(HERO_X, HERO_Y + 12, HERO_Z)];
  for (let guard = 0; guard < 60000 && anchors.length < 70; guard++) {
    const x = (rnd() - 0.5) * FW * 0.92;
    const z = (rnd() - 0.5) * FD * 0.86;
    const y = fieldH(x, z);
    if (y < HMAX * 0.24) continue;
    let ok = true;
    for (const a of anchors) if (Math.hypot(a.x - x, a.z - z) < 210) {ok = false; break;}
    if (!ok) continue;
    anchors.push(new Vector3(x, y + 10, z));
  }

  // Геройская связь: второй конец — самый дальний по X якорь, чтобы дуга шла
  // поперёк кадра во всю ширину, а не в глубину.
  let hi = 1, hb = -1;
  for (let i = 1; i < anchors.length; i++) {
    const d = anchors[i].x - HERO_X;
    if (d > hb) {hb = d; hi = i;}
  }
  const pairs: [Vector3, Vector3][] = [[anchors[0], anchors[hi]]];

  const used = new Map<number, number>([[0, 1], [hi, 1]]);
  for (let guard = 0; guard < 20000 && pairs.length < LINKS; guard++) {
    const ai = 1 + ((rnd() * (anchors.length - 1)) | 0);
    const bi = 1 + ((rnd() * (anchors.length - 1)) | 0);
    if (ai === bi) continue;
    if ((used.get(ai) ?? 0) >= 2 || (used.get(bi) ?? 0) >= 2) continue;
    const dx = anchors[bi].x - anchors[ai].x, dz = anchors[bi].z - anchors[ai].z;
    const dist = Math.hypot(dx, dz);
    if (dist < 620 || dist > 1900) continue;
    // Нить, направленная в камеру, проецируется вертикальной чертой и читается
    // как чужеродный чертёжный элемент. Азимут постоянный — отсекаем один раз.
    if (Math.abs((dx * Math.sin(AZ) + dz * Math.cos(AZ)) / dist) > 0.62) continue;
    used.set(ai, (used.get(ai) ?? 0) + 1);
    used.set(bi, (used.get(bi) ?? 0) + 1);
    pairs.push([anchors[ai], anchors[bi]]);
  }

  const flashes = scheduleFlashes(rnd, pairs.length, {events: EVENTS, length: NET_LEN});
  flashes[0] = HERO_FLASH.slice();

  const polylines = pairs.map(([a, b]) => arc(a, b, SEGS, ARC));
  // Постоянная нить чуть шире мерцающей: в монохроме разница «мигает / горит»
  // держится на стойкости и весе, других носителей нет.
  const threads = new Ribbons(polylines, {res: new Vector2(RW, RH), halfWidth: 1.6, holdWidth: 0.9});
  threads.mesh.renderOrder = 2;
  const sparks = new EndSparks(polylines, {px: 5.5});
  sparks.points.renderOrder = 1;

  const scene3 = new Scene();
  scene3.add(field.points, sparks.points, threads.mesh);

  const camera = new PerspectiveCamera(FOV0, Screen.width / Screen.height, 1, 30000);
  const rig = new DollyRig({az: AZ, el0: EL0, el1: EL1, len0: LEN0, len1: LEN1, fov0: FOV0, fov1: FOV1, tgt0: TGT0, tgt1: TGT1}, camera);

  // ── Сигналы ──────────────────────────────────────────────────────────────
  const camP = createSignal(0);          // 0 → 1 — весь отход назад
  const reveal = createSignal(0);        // фронт раскрытия поля
  const netT = createSignal(0);          // сетевое время, сек
  const flickerD = createSignal(0);      // сила мерцающих связей
  const heroHold = createSignal(0);      // геройская нить осталась гореть
  const persistRatio = createSignal(0);  // доля остальных, что залипнут (такт 4)

  const threeView = createThreeView({
    width: Screen.width,
    height: Screen.height,
    quality: QUALITY,
    scene: scene3,
    camera,
    background: BG,
    onRender: (renderer, s, c) => {
      // ⚠️ Ни композера, ни bloom. Всё, что рисует кадр, — сами точки.
      renderer.toneMapping = NoToneMapping;
      renderer.toneMappingExposure = 1.0;

      const p = camP();
      const {len} = rig.apply(p);

      field.setGain(PointField.exposure(LEN1, len));
      // Геройская точка ужимается по мере отхода: сперва это узел во весь
      // экран, в финале — одна из миллиона.
      field.setHeroPx(30 - 24 * p);
      // Фронт раскрытия привязан к дистанции камеры — он всегда чуть шире
      // кадра, поэтому поле ПРОСТУПАЕТ по мере отхода, а не включается за
      // пределами видимости. Сдвиг назад держит первый кадр пустым.
      const rr = reveal() * (len * 1.1 + 90) - 55;
      field.setReveal(rr, 60 + Math.max(0, rr) * 0.4);

      const state = {
        t: netT(), flicker: flickerD(), heroHold: heroHold(), persistRatio: persistRatio(),
        flashDur: FLASH_DUR,
        flickerLevel: 0.62,                // мерцающие заметно тусклее постоянных
      };
      for (let i = 0; i < pairs.length; i++) {
        const {alpha, hold} = evalLink(i, 0, flashes[i], i, pairs.length, state);
        threads.set(i, alpha, hold);
        sparks.set(i, alpha * 0.9);
      }
      threads.commit();
      sparks.commit();

      renderer.render(s, c);
    },
  });

  view.add(threeView.node);

  // ── Такты ────────────────────────────────────────────────────────────────
  // 0.0  одна точка в темноте
  // 1.4  отход: вокруг точки проступает рельеф, потом всё поле
  // 16.2 сеть: фоновые нити мигают, геройская вспыхивает на 18.2 и 23.6
  // 29.6 третья вспышка геройской — и она НЕ гаснет
  yield* waitFor(1.4);

  yield* all(
    camP(0.46, 8, easeInOutSine),
    reveal(1, 7.4, easeOutCubic),
  );

  yield* all(
    camP(0.82, 6.8, easeInOutSine),
    chain(waitFor(3.2), flickerD(1, 3.4, easeOutCubic)),
  );

  yield* all(
    camP(1.0, 12, easeInOutSine),
    netT(NET_LEN, NET_LEN, linear),
    chain(waitFor(HERO_FLASH[2] + 0.28), heroHold(1, 0.55, easeOutCubic)),
  );
});
