import {makeScene2D} from '@motion-canvas/2d';
import {all, chain, createSignal, easeInOutSine, linear, waitFor} from '@motion-canvas/core';
import {
  AdditiveBlending,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  Matrix4,
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
import {rng, type Rng} from '../core/three/hydra';
import {Screen, Fonts} from '../core/theme';
import {Canon} from '../core/code/model/paletteCanon';
import {applyBackground} from '../core/utils';
import {mountVignette} from '../core/components/SoftVignette';

// ═══════════════════════════════════════════════════════════════════════════
// АКТ 7 «МИР» — ПРОТОТИП, такты 1→2 (8 секунд, без музыки и голоса).
//
//   такт 1 (0–3.5 с)   код теряет резкость: буквы сливаются в светящиеся полосы
//   такт 2 (2.9–7.2 с) вещество стекается и собирается в машину
//   такт 3, шаг 1      машина отдаёт часть вещества, рядом встаёт колонка
//
// Приёмка одна: понятно ли БЕЗ ОБЪЯСНЕНИЙ, что машина сделана из кода.
//
// ⚠️ ГЛАВНОЕ ПРАВИЛО СЦЕНЫ: в кадре нет ничего, кроме частиц. Код в начале —
// НЕ текстовая нода: это те же самые точки, стоящие на своих пикселях. Машина
// в конце — не меш: модель живёт ровно один раз, при подготовке, где с её
// поверхности снимаются целевые позиции. scene3 содержит один объект — Points.
// Убрать его — кадр пуст, включая первый кадр с текстом.
//
// ⚠️ ЧТО РЕШАЕТ ПРИЁМКУ — НЕ КАЧЕСТВО ЧАСТИЦ, А СООТВЕТСТВИЕ. Если пиксель
// текста летит к случайной точке кузова, зритель видит рой: что-то рассыпалось,
// что-то собралось, связи между ними нет. Поэтому пары строятся по ЭКРАННОМУ
// положению: оба набора сортируются по коду Мортона (2D-локальность сохраняется
// при линейном обходе), пары берутся по рангу. Материал с верха текста уходит в
// крышу, с низа — в колёса, слева — налево. Читается складывание, а не подмена.
//
// ⚠️ ПОЧЕМУ У ТЕКСТА НЕТ СТАДИИ «СЧЁТНОГО ЗЕРНА». Ink кода занимает около
// 38 тысяч пикселей буфера. При миллионе точек это два с половиной десятка
// точек НА ПИКСЕЛЬ; чтобы они стали различимы поодиночке, их пришлось бы
// размазать на весь кадр — и буквы исчезли бы вместе с ними. Отдельными
// точками вещество становится видно ТОЛЬКО на отрыве, когда оно разлетается
// по дугам и плотность падает на порядок. Поэтому такт 1 доводит буквы до
// светящихся полос («свечение той же формы»), а частицами материал
// объявляет себя в начале полёта — это физика, а не выбор.
//
// ⚠️ ОТКУДА БЕРЁТСЯ ВЕЩЕСТВО МИРА. Облако закрытое: после такта 2 все точки
// лежат на машине, добавить в него нечего. Поэтому каждый следующий объект
// собирается ИЗ МАШИНЫ — она отдаёт материал. Это не экономия, это правило,
// по которому дальше вырастет весь город, и оно проговаривает реплику
// «someone's work becomes the ground for someone else's». Подмножество берётся
// РАВНОМЕРНО по всей поверхности (перемешанный порядок индексов): вырви точки
// одним куском — и машина будет читаться как повреждённая, а не отдавшая.
//
// Всё состояние — чистая функция сигналов MC, пересчёт в onRender. Ни одного
// таймера по реальному времени: сцена обязана скраббиться.
// ═══════════════════════════════════════════════════════════════════════════

const D2R = Math.PI / 180;
const QUALITY = 1.5;
const RW = Screen.width * QUALITY;
const RH = Screen.height * QUALITY;
const BG = '#0B0C10';
const INK = '#F4EEE0';                      // крем: единственный цвет материала

const SEED = 20260906;

// ── Бюджет облака ──────────────────────────────────────────────────────────
// Один BufferGeometry, один Points, один вызов отрисовки.
// ⚠️ Миллион, а не сто тысяч. Сто тысяч — фолк-число веб-туториалов; здесь
// упирается только заливка на такте 5 (точки у самого объектива), а память
// на 1M — 60 МБ. Количество покупает не свет, а ЗЕРНО: суммарная яркость есть
// N × alpha, и при росте N альфу приходится опускать. Выбирать N надо по
// самому грубому объекту в кадре: на машине миллион даёт различимые точки,
// на тексте — сплошной штрих. Обратный порядок дал бы редкую машину.
// ⚠️ Два с лишним миллиона, а не миллион. Мир добавил ~117 м² приведённой
// поверхности к 39 м² машины; при миллионе машине осталось бы 227 тысяч точек,
// то есть втрое реже нынешнего — вместо сплошной формы редкое созвездие.
// Зерно имеет физический предел снизу: меньше точки на пиксель буфера — и
// поверхность перестаёт быть поверхностью. Отсюда 2.2M: машине 551 тысяча.
const N = 1_800_000;                        // 2.2M рендер не пережил по памяти

// ⚠️ Доли НЕ задаются руками. Яркость поверхности из точек равна плотности на
// м² и от выноса камеры не зависит, поэтому «объект чуть тусклее машины» — это
// отношение плотностей, а не отдельная альфа. Отсюда бюджет решается уравнением:
//   D = N / (A_машины + Σ вес_i · A_i),   N_i = D · вес_i · A_i
// где A — реальная площадь поверхности в мировых единицах. Добавили объект —
// доли всех пересчитались сами, и ни один не поехал по яркости.

// ── Материал точки (размеры в пикселях БУФЕРА 2880×1620, не экрана) ────────
// ⚠️ Альфы посчитаны, а не подобраны: пиковое накопление держим около 0.75,
// выше начинается выбеленное пятно вместо формы. Плотность у текста и у
// машины отличается на порядок (38 тыс. пикселей ink против 560 тыс.
// оболочки), поэтому одна альфа на оба состояния физически невозможна.
const PX_TEXT = 1.5;                        // резкий код: штрих сплошной
const PX_GLOW = 3.0;                        // полосы: точка чуть крупнее
const PX_VAN = 2.05;                        // собранная машина: зерно различимо
// Альфы поделены на рост бюджета: суммарный свет есть N × alpha, и при N в
// 2.2 раза больше та же картинка требует alpha во столько же раз меньше.
const A_TEXT = 0.0323;
const A_GLOW = 0.0166;                       // разброс проредил плотность в восемь раз
// Машина отдала пятую часть вещества, её плотность упала с 25 700 до 20 000
// точек на м² — альфу поднимаем ровно на столько же, чтобы абсолютный уровень
// остался тем, что выставлен замером. Колонка при этом остаётся тусклее сама
// по себе: у неё меньше точек на метр поверхности.
const A_VAN = 0.231;
// ⚠️ Свет собранной машины: столько точек несут её яркость при альфе A_VAN.
// Постоянная, а не остаток бюджета — иначе любая правка мира перекрашивала бы
// машину. 421 тысяча — машина в последнем кадре с миром.
const CAR_LIGHT = 421_000;
const FLY_DIM = 1.0;
// ⚠️ Отдельного гашения в полёте НЕТ. Вещество тускнеет само: летящие точки
// размазаны вдоль дуг, и плотность на пиксель падает на порядок. Домножить
// сверху — значит стереть шлейф, а он и есть доказательство, что материал один.
const PX_MIN = 1.0;
const PX_MAX = 16.0;
const ALPHA_FLOOR = 0.05;

// ── Код: финальное состояние предыдущей сцены ──────────────────────────────
// Это буквально тот кадр, на котором закончился chargingHeroDemoScene: слитая
// функция и две двери к ней. Раскладка повторена по его же числам, включая
// дрейф кадра (stage.scale 1.022, y 11) — стык идёт без скачка.
const WRAP_FLEET = `fun startFleetSession(cmd: StartFleet) {
    val owner = SessionOwner.Vehicle(cmd.vehicle)
    startSession(StartSession(cmd.connector, owner))
}`;
const WRAP_PUBLIC = `fun startPublicSession(cmd: StartPublic) {
    val owner = SessionOwner.Driver(cmd.driver)
    startSession(StartSession(cmd.connector, owner))
}`;
const MERGED = `fun startSession(cmd: StartSession) {
    val connector = connectors.acquire(cmd.connector)
    val session = sessions.open(connector, cmd.owner)
    metering.start(session.id)
    charger.energize(connector.id)
    events.publish(SessionStarted(session.id))
}`;

const FS = 25;                              // кегль предыдущей сцены
const ADV = FS * 0.6;                       // шаг моноширинного JetBrains Mono
const LH = FS * 1.5;                        // шаг строки Manticore
const TEXT_LEFT = -832;                     // левое поле: правый край текста ≈ −52
const COL_Y = 140;
const Y_HOME = COL_Y;
const Y_WRAP_PUBLIC = Y_HOME - 6.5 * LH;
const Y_WRAP_FLEET = Y_WRAP_PUBLIC - 5 * LH;
const STAGE_SCALE = 1.022;
const STAGE_DY = 11;

// Сверхсемплинг текстуры кода. Кадр рендерится в 2880×1620, значит текст должен
// быть чётким на 2880 — 5760 даёт два образца на пиксель кадра и мягкий край.
const SS = 3;
const TEX_W = Screen.width * SS;
const TEX_H = Screen.height * SS;
const INK_CUT = 6;                          // ниже — шум сглаживания, не буква

// ⚠️ Разброс, которым буквы сливаются в полосы. Пять с половиной экранных
// пикселей — треть ширины знакоместа: соседние глифы смыкаются, но пробелы
// между словами выживают, и строка держит свой ритм. На семи слова слипались
// в сплошную плиту. По горизонтали чуть шире: смыкаться должно ВДОЛЬ строки.
const SPREAD_R = 5.5;
const SPREAD_X = 1.25;

// ── Камера ─────────────────────────────────────────────────────────────────
// Сборка: 1.8% наезда за восемь секунд — дыхание кадра (тот же приём, которым
// заканчивается предыдущая сцена), а не наезд. Ракурс — спереди в три четверти,
// как в принятом прототипе.
const FOV = 34;
const CAM_AZ = 34 * D2R;                    // отклонение от оси кузова: три четверти
const CAM_EL = 11 * D2R;
// ⚠️ Доля ширины кадра под машину. Больше 0.55 — колёса подходят к нижней
// кромке, и кадр теряет воздух.
const FILL = 0.52;
const TGT_DY = -0.16;                       // цель ниже центра кузова: машина встаёт по центру кадра
const CAM_BREATH = 0.982;

// ── Полёт камеры ───────────────────────────────────────────────────────────
// ⚠️ Машина НИКУДА НЕ ЕДЕТ (решение автора, окончательное). Собравшись, она
// остаётся на месте, а камера просто летит над ней вперёд, как дрон; объекты встают по сторонам пути по мере приближения. Проезд машины,
// камеру за спиной и сбоку, крутящиеся колёса автор перебрал и отверг.
// ⚠️ Всё — функция одного сигнала времени, без накопленного состояния: сцена
// обязана скрабиться.
// ⚠️ БЕЗ НАБОРА ВЫСОТЫ (решение автора). Камера только переносится вперёд по
// пути: высота и направление взгляда — те же, что на сборке. Любой подъём на
// старте, даже на метр, пока ход вперёд ещё не набран, читается как взлёт.
// Над крышей камера проходит с запасом в три десятка сантиметров: машина из
// точек прозрачна, вблизи крыша рассыпается крупным зерном и уходит под кадр.
const FLY_START = 8.2;                      // с: машина собрана, под ней уже ложится земля
const FLY_V = 5.0;                          // крейсерская скорость, м/с
const FLY_ACC = 1.5;                        // разгон с нуля, с: рывка на старте нет
// Горизонтальный вынос камеры сборки от центра кузова, DT·cos(CAM_EL). Нужен
// таблице мира ДО загрузки модели; в сцене сверяется с настоящим DT.
const CAM_BACK = 6.27;
// Объект начинает вставать, когда до него остаётся столько метров пути: к концу
// роста он ещё впереди и в кадре, а не уходит за боковую кромку.
const REVEAL_AHEAD = 30;
const REVEAL_DUR = 2.4;                     // с
// Ближние объекты по расстоянию встали бы все разом на старте полёта — между
// ними держится шаг по метрам.
const STREET_FROM = 16;                     // первый объект, м за машиной
const REVEAL_STAGGER = 0.12;                // с на метр

// ── МИР: таблица объектов ────────────────────────────────────────────────
// ⚠️ Положение задаётся ОТ МАШИНЫ, а не в мировых осях: столько-то метров
// вправо по ходу и столько-то вдоль носа. Модель может прийти повёрнутой как
// угодно, разворот по умолчанию — лицом к машине.
//
// Добавить объект = добавить строку. Площадь, доля бюджета, подмножество точек
// на машине и расписание появления считаются из неё автоматически.
interface WorldObj {
  key: string;
  /** Модель. Нет — объект строится процедурно (дом ряда, телефон). */
  url?: string;
  right?: number;                           // метров вправо по ходу машины
  fwd?: number;                             // метров вдоль носа машины
  yaw?: number;                             // доворот, рад
  height?: number;                          // подогнать высоту объекта, м
  pick?: RegExp;                            // какие меши брать из пачки
  skip?: RegExp;                            // какие выбросить
  density?: number;                         // плотность точек относительно машины
  house?: HouseSpec;                        // дом (ряда или улицы)
  street?: 'right';                         // дом улицы: фасадом к дороге
  pocketOf?: string;                        // телефон: ключ фигуры, в чьём он кармане
  points?: number;                          // точек на объект (вместо плотности)
  gain?: number;                            // множитель яркости точек объекта
  at?: number;                              // начало появления, секунды сцены
  dur?: number;                             // длительность появления, с
  t0?: number;                              // (старая раскладка) начало, доля worldGrowth
  span?: number;                            // (старая раскладка) длительность, доля
}

// ── РЯД ДОМОВ ──────────────────────────────────────────────────────────────
// ⚠️ Плотный ряд сразу за улицей, а не одинокий дом в глубине: на ста тридцати
// метрах дом читался далёким фоном, автор попросил застройку ближе к машине.
// ⚠️ Высоты двух сортов. При возвышении в двенадцать градусов верхняя кромка
// кадра на линии фасадов — девять с небольшим метров. Двухэтажный дом
// показывает крышу, от четырёх этажей дом уходит за кромку. Три этажа
// упираются макушкой ровно в кромку и выглядят случайной обрезкой — их нет.
// ⚠️ Швы между домами разнесены от столбов переднего плана (мачта, фонари,
// светофоры, стойки остановки) больше чем на метр: шов, совпавший со столбом,
// склеивает два плана в одну линию.
// ⚠️ Вблизи дом узнаётся по ОКНАМ. Ровная стена из точек на сорока метрах — это
// зернистая плита; тёмные проёмы окон сразу дают масштаб.
interface HouseSpec {
  w: number;
  h: number;
  d: number;
  floors: number;
  /** Боковые стены −x и +x. null — стена смотрит от камеры и не строится. */
  sides: [SideCover | null, SideCover | null];
  /** Окна и этажи на боковой стене. У дома ряда бок — глухой брандмауэр, у
   *  отдельно стоящего дома улицы торец смотрит в камеру и обязан быть фасадом. */
  sideWin?: boolean;
}
/** Кусок боковой стены, закрытый соседом: [z0, z1] по глубине × [0, y1] по высоте. */
interface SideCover { z0: number; z1: number; y1: number; }

const ROW_F = 22;                           // линия фасадов, м вглубь от машины
const ROW_LEFT = -33;                       // ряд шире кадра: торцов не видно
const STOREY = 3.2;
const PARAPET = 0.4;
const HOUSE_D = 11;
const WIN_W = 1.3, WIN_H = 1.6, WIN_SILL = 0.9, BAY = 2.6;
const HOUSE_PTS = 450;                      // точек на м² стены: зерно около двух пикселей
const HOUSE_REL = 0.14;                     // яркость стены относительно кузова машины
const SIDE_K = 0.5;                         // бок виден под углом и копит яркость — реже
const BAND_SHARE = 0.20;                    // доля точек на междуэтажных отметках
const CORNICE_SHARE = 0.04;                 // и на кромке крыши
const HOUSE_T0 = 0.60, HOUSE_STEP = 0.022, HOUSE_SPAN = 0.16;
// ⚠️ Дом улицы — объект, а не фон. На яркости дома ряда (0.14 от кузова) он
// читался серой пылью рядом со светящейся машиной (кадр 15.5 с). Плотнее —
// ради зерна на тридцати метрах, ярче — чтобы окна читались окнами.
const STREET_PTS = 700;
const STREET_REL = 0.32;

// Слева направо. Широкий дом по центру стоит за мачтой.
const ROW: {w: number; floors: number; set: number}[] = [
  {w: 6.0, floors: 4, set: 0.0},
  {w: 5.0, floors: 2, set: 0.6},
  {w: 5.5, floors: 5, set: 0.0},
  {w: 5.5, floors: 2, set: 0.8},
  {w: 5.0, floors: 2, set: 0.3},
  {w: 9.5, floors: 6, set: 0.0},
  {w: 5.5, floors: 2, set: 1.0},
  {w: 4.8, floors: 4, set: 0.0},
  {w: 6.2, floors: 5, set: 0.4},
  {w: 6.0, floors: 2, set: 0.7},
  {w: 7.0, floors: 4, set: 0.0},
];

function windowBays(w: number): {nb: number; bw: number; ww: number} {
  const nb = Math.max(1, Math.round(w / BAY));
  const bw = w / nb;
  return {nb, bw, ww: Math.min(WIN_W, bw * 0.6)};
}

/** Попадает ли точка стены шириной width в оконный проём. u — от середины стены. */
function winAt(width: number, floors: number, u: number, ly: number): boolean {
  const k = Math.floor(ly / STOREY);
  if (k < 0 || k >= floors) return false;
  const fy = ly - k * STOREY;
  if (fy < WIN_SILL || fy > WIN_SILL + WIN_H) return false;
  const {nb, bw, ww} = windowBays(width);
  const j = Math.min(nb - 1, Math.floor((u + width / 2) / bw));
  return Math.abs(u - (-width / 2 + (j + 0.5) * bw)) < ww / 2;
}

function winArea(width: number, floors: number): number {
  const {nb, ww} = windowBays(width);
  return floors * nb * ww * WIN_H;
}

function frontArea(spec: HouseSpec): number {
  return spec.w * spec.h - winArea(spec.w, spec.floors);
}

function sideArea(spec: HouseSpec, s: 0 | 1): number {
  const c = spec.sides[s];
  if (!c) return 0;
  return spec.d * spec.h - Math.max(0, c.z1 - c.z0) * c.y1 - (spec.sideWin ? winArea(spec.d, spec.floors) : 0);
}

function houseRow(): WorldObj[] {
  const hs: {w: number; floors: number; set: number; r0: number; h: number}[] = [];
  let x = ROW_LEFT;
  for (const r of ROW) { hs.push({...r, r0: x, h: r.floors * STOREY + PARAPET}); x += r.w; }
  // Очередь появления — от центра ряда к краям.
  const mid = (i: number) => Math.abs(hs[i].r0 + hs[i].w / 2);
  const order = hs.map((_, i) => i).sort((a, b) => mid(a) - mid(b));
  return hs.map((hh, i) => {
    // Сосед закрывает боковую стену по своей высоте на общем отрезке глубины.
    // Локальные оси дома: фасад на z = +d/2, вглубь — к минусу.
    const cover = (nb?: typeof hh): SideCover => {
      if (!nb) return {z0: 0, z1: 0, y1: 0};
      const zf = HOUSE_D / 2 - (nb.set - hh.set);
      return {z0: Math.max(-HOUSE_D / 2, zf - HOUSE_D), z1: Math.min(HOUSE_D / 2, zf), y1: Math.min(hh.h, nb.h)};
    };
    // Строится только та боковая стена, что смотрит к оси взгляда.
    const spec: HouseSpec = {
      w: hh.w, h: hh.h, d: HOUSE_D, floors: hh.floors,
      sides: [hh.r0 > 0 ? cover(hs[i - 1]) : null, hh.r0 + hh.w < 0 ? cover(hs[i + 1]) : null],
    };
    const area = frontArea(spec) + (sideArea(spec, 0) + sideArea(spec, 1)) * SIDE_K;
    return {
      key: `house-${i}`, house: spec, points: Math.round(area * HOUSE_PTS),
      right: hh.r0 + hh.w / 2, fwd: ROW_F + hh.set + HOUSE_D / 2,
      t0: HOUSE_T0 + order.indexOf(i) * HOUSE_STEP, span: HOUSE_SPAN,
    };
  });
}

/** Точки дома ряда: фасад с окнами, этажами и кромкой крыши, видимые куски боков. */
function sampleHouse(
  spec: HouseSpec, cx: number, cz: number, yaw: number,
  count: number, rnd: Rng, out: Float32Array,
): void {
  const {w, h, d} = spec;
  const front = frontArea(spec);
  // Бок дома ряда виден под углом и копит яркость — его прореживаем; торец
  // отдельного дома смотрит в камеру и набирается как фасад.
  const sideK = spec.sideWin ? 1 : SIDE_K;
  const left = sideArea(spec, 0) * sideK;
  const total = front + left + sideArea(spec, 1) * sideK;
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  const top = spec.floors * STOREY;
  for (let k = 0; k < count; k++) {
    let lx = 0, ly = 0, lz = 0;
    const t = rnd() * total;
    if (t < front) {
      do { lx = (rnd() - 0.5) * w; ly = rnd() * h; } while (winAt(w, spec.floors, lx, ly));
      lz = d / 2;
    } else {
      const s = t - front < left ? 0 : 1;
      const c = spec.sides[s]!;
      do { lz = (rnd() - 0.5) * d; ly = rnd() * h; }
      while ((lz > c.z0 && lz < c.z1 && ly < c.y1) || (!!spec.sideWin && winAt(d, spec.floors, lz, ly)));
      lx = s === 0 ? -w / 2 : w / 2;
    }
    // Этажи и кромка крыши: ровная россыпь по стене без них читается занавесом.
    // Глухой бок дома ряда их не получает — там брандмауэр, а не фасад.
    if (t < front || spec.sideWin) {
      const r = rnd();
      if (r < BAND_SHARE) ly = Math.min(top, Math.round(ly / STOREY) * STOREY) + (rnd() - 0.5) * 0.10;
      else if (r < BAND_SHARE + CORNICE_SHARE) ly = h - rnd() * 0.08;
    }
    const o = k * 3;
    out[o] = cx + lx * cs - lz * sn;
    out[o + 1] = Math.max(0, ly);
    out[o + 2] = cz + lx * sn + lz * cs;
  }
}

// ── ТЕЛЕФОН В КАРМАНЕ ──────────────────────────────────────────────────────
interface Pocket { c: Vector3; t: Vector3; u: Vector3; n: Vector3; }
const PHONE_W = 0.075, PHONE_H = 0.15, PHONE_T = 0.012;
const POCKET_Y = 0.54;                      // линия кармана, доля роста
const POCKET_OUT = 0.65;                    // доля телефона над карманом
const POCKET_SIDE = 0.55;                   // сдвиг к краю силуэта
const POCKET_TILT = 0.14;                   // рад: в кармане телефон не стоит по отвесу

/** Точки телефона: только часть над карманом, нижняя скрыта в ткани. */
function samplePhone(pk: Pocket, count: number, rnd: Rng, out: Float32Array): void {
  const top = PHONE_H * POCKET_OUT;
  for (let k = 0; k < count; k++) {
    let s = (rnd() - 0.5) * PHONE_W;
    let v = rnd() * top;
    let w: number;
    const r = rnd();
    if (r < 0.45) w = 0.004 + PHONE_T;                 // лицевая сторона
    else if (r < 0.9) w = 0.004;                       // сторона к телу
    else {                                             // кромка
      w = 0.004 + rnd() * PHONE_T;
      if (rnd() < 0.4) v = top; else s = (rnd() < 0.5 ? -0.5 : 0.5) * PHONE_W;
    }
    const o = k * 3;
    out[o] = pk.c.x + pk.t.x * s + pk.u.x * v + pk.n.x * w;
    out[o + 1] = pk.c.y + pk.t.y * s + pk.u.y * v + pk.n.y * w;
    out[o + 2] = pk.c.z + pk.t.z * s + pk.u.z * v + pk.n.z * w;
  }
}

// ── ЗЕМЛЯ: сетка из точек ──────────────────────────────────────────────────
// Общая земля вместо площадок под каждым объектом (площадки автор отверг).
// Сначала ложится под машиной волной от неё наружу — сразу после сборки, — а
// дальше растёт впереди камеры с запасом перед объектами: земля под объектом
// обязана лечь РАНЬШЕ него. На лету линии проходят под камерой и дают скорость.
// ⚠️ Риск — Трон: ровная яркая сетка на чёрном выглядит дешёвым синтвейвом.
// Поэтому она тише любого объекта, из тех же точек и гаснет к горизонту.
const GRID_CELL = 3.0;                      // шаг, м
const GRID_HALF = 24;                       // полуширина полосы вдоль пути, м
const GRID_F0 = -4, GRID_F1 = 85;           // от нижней кромки стартового кадра вперёд по пути
const GRID_PPM = 45;                        // точек на погонный метр линии
const GRID_GAIN = 0.5;
const GRID_START = 7.2;                     // с: машина собрана — под ней ложится земля
const GRID_INTRO = 1.2;                     // с: волна от машины до радиуса GRID_INTRO_R
const GRID_INTRO_R = 25;
const GRID_POW = 0.55;                      // у машины быстро, к краю медленнее
const GRID_AHEAD = 45;                      // дальше земля встаёт на столько впереди камеры, м
const GRID_HOVER_MIN = 0.22, GRID_HOVER_VAR = 0.30;
// У линии яркость на пиксель длины падает с глубиной (у поверхности — нет),
// поэтому линии выравниваются по глубине от камеры прямо в шейдере: камера
// летит, и статичный множитель от расстояния тут не годится. С потолком — иначе
// за зажимом размера точки даль вышла бы ярче ближнего. К горизонту гаснут.
const LINE_COMP_R = 13, LINE_COMP_MAX = 8;
const LINE_FADE0 = 45, LINE_FADE1 = 95;

interface GridSeg { r0: number; f0: number; r1: number; f1: number; }
function gridSegments(): GridSeg[] {
  const out: GridSeg[] = [];
  for (let r = -GRID_HALF; r <= GRID_HALF + 1e-6; r += GRID_CELL) out.push({r0: r, f0: GRID_F0, r1: r, f1: GRID_F1});
  for (let f = Math.ceil(GRID_F0 / GRID_CELL) * GRID_CELL; f <= GRID_F1 + 1e-6; f += GRID_CELL) {
    out.push({r0: -GRID_HALF, f0: f, r1: GRID_HALF, f1: f});
  }
  return out;
}
const GRID_POINTS = Math.round(GRID_PPM * gridSegments().reduce((a, g) => a + Math.hypot(g.r1 - g.r0, g.f1 - g.f0), 0));

/** Когда встаёт точка земли: волна от машины, дальше — впереди летящей камеры. */
function gridRevealAt(right: number, fwd: number): number {
  const wave = GRID_START + GRID_INTRO * Math.pow(Math.hypot(right, fwd) / GRID_INTRO_R, GRID_POW);
  return Math.max(wave, FLY_START + flyTimeAt(fwd + CAM_BACK - GRID_AHEAD));
}

// ── Путь камеры: время появления по расстоянию ─────────────────────────────
/** Путь камеры к моменту t от начала полёта: равномерный разгон, потом ровный ход. */
function flyDistance(t: number): number {
  if (t <= 0) return 0;
  if (t < FLY_ACC) return (0.5 * FLY_V * t * t) / FLY_ACC;
  return FLY_V * (t - 0.5 * FLY_ACC);
}

/** Обратная к flyDistance: когда камера пролетит путь s. */
function flyTimeAt(s: number): number {
  if (s <= 0) return 0;
  const sAcc = 0.5 * FLY_V * FLY_ACC;
  return s < sAcc ? Math.sqrt((2 * s * FLY_ACC) / FLY_V) : FLY_ACC + (s - sAcc) / FLY_V;
}

/** Секунда сцены, когда объект в fwd метрах за машиной начинает вставать. */
function revealAt(fwd: number): number {
  return FLY_START + Math.max(flyTimeAt(fwd + CAM_BACK - REVEAL_AHEAD), Math.max(0, fwd - STREET_FROM) * REVEAL_STAGGER);
}

// ── МИР: столбы и люди вдоль пути ──────────────────────────────────────────
// Путь камеры идёт над машиной дальше вперёд, объекты стоят по обе стороны:
// right — вбок по кадру от линии полёта, fwd — метров вперёд от центра кузова.
// Столбы держат ритм улицы, люди ближе к линии полёта, у каждого телефон в
// кармане. Разворот по умолчанию — лицом к машине, то есть к подлетающей камере.
// ⚠️ Первые объекты стоят сразу за машиной и встают, пока камера ещё
// поднимается: мир начинается за машиной, а не где-то впереди.
function onStreet(o: WorldObj & {fwd: number}): WorldObj {
  return {...o, at: revealAt(o.fwd), dur: REVEAL_DUR};
}

/** Человек и телефон в кармане: телефон проявляется, когда фигура уже стоит. */
function person(key: string, id: string, fwd: number, right: number, height: number, yaw: number): WorldObj[] {
  const at = revealAt(fwd);
  return [
    {key, url: '/lowpoly_people__waldo.pts.glb', pick: new RegExp(`^${id}_person`),
     right, fwd, yaw, height, density: 1.0, at, dur: REVEAL_DUR},
    {key: `${key}-phone`, pocketOf: key, points: 600, gain: 3.2, at: at + REVEAL_DUR * 0.7, dur: 0.9},
  ];
}

const LAMPS = '/various_low-poly_street_lights.pts.glb';
const LIGHTS = '/traffic_lights_street_assets_vol._02.pts.glb';

const WORLD: WorldObj[] = [
  // Колонка справа от машины, как в принятом прототипе; встаёт снизу вверх
  // ОДНОВРЕМЕННО с машиной — пока на кузов садятся точки.
  {key: 'charger', url: '/charging_station.pts.glb',
   right: 2.35, fwd: 0.30, density: 0.90, at: 4.3, dur: 2.9},
  onStreet({key: 'lamp-1', url: LAMPS, pick: /^polySurface69_/, right: 5.5, fwd: 16, density: 0.8}),
  ...person('man-1', '21', 19, 4.3, 1.75, 0.5),
  onStreet({key: 'lamp-2', url: LAMPS, pick: /^polySurface88_/, right: -5.5, fwd: 23, density: 0.7}),
  ...person('man-2', '134', 27, -4.5, 1.72, -0.6),
  // Пачка светофоров: транспортный справа, пешеходный напротив — перекрёсток.
  onStreet({key: 'light-veh', url: LIGHTS, pick: /^Light_/, right: 5.2, fwd: 32, density: 1.0}),
  onStreet({key: 'light-ped', url: LIGHTS, pick: /^Pedestrian_/, right: -5.0, fwd: 33, density: 0.9}),
  ...person('man-3', '191', 36, 4.4, 1.78, 0.9),
  onStreet({key: 'cctv', url: '/lamppost_with_cctv_cameras.pts.glb', right: -6.0, fwd: 42, density: 0.85}),
  onStreet({key: 'lamp-3', url: LAMPS, pick: /^polySurface69_/, right: 5.5, fwd: 47, density: 0.8}),
  ...person('man-4', '71', 50, -4.3, 1.70, -0.3),
  onStreet({key: 'lamp-4', url: LAMPS, pick: /^polySurface88_/, right: -5.5, fwd: 55, density: 0.7}),
  ...person('man-5', '264', 60, 4.4, 1.80, 0.2),
  onStreet({key: 'lamp-5', url: LAMPS, pick: /^polySurface69_/, right: 5.5, fwd: 64, density: 0.8}),
];

// ⚠️ Прототип полёта: машина с колонкой, земля, затем столбы и люди. Полная сцена — около сорока
// секунд.
const DUR = 20.0;

// ── Полёт ──────────────────────────────────────────────────────────────────
// ⚠️ Задержка назначается по КВАНТИЛЮ расстояния цели от центра кузова, а не
// по самому расстоянию. На поверхности точек с большим радиусом кратно больше,
// и «delay ∝ r» отправляет девять десятых вещества в последнюю треть такта:
// первые полторы секунды в кадре не происходит ничего. Квантиль даёт ровный
// поток массы, и машина набирается изнутри наружу с постоянной скоростью.
const FLY_SPAN = 0.34;                      // доля сигнала на полёт одной точки
// ⚠️ БОКОВОГО ПЕРЕЛЁТА НЕТ ВООБЩЕ (решение автора, дважды). Любая траектория от
// машины к объекту — хоть по воздуху, хоть низом — читается как «огоньки
// притащили предмет»: событие происходит с частицами, а не с объектом.
// Поэтому точка ГАСНЕТ на машине и ПОЯВЛЯЕТСЯ над своим конечным местом,
// откуда опускается на него. Переброс идёт на нулевой альфе, в кадре его нет.
//   ⚠️ Цена решения: видимой связи «вещество взято у машины» не остаётся.
//   Остаётся временнáя: машина тускнеет ровно тогда, когда встаёт колонка.
// Очередь по-прежнему снизу вверх, поэтому фронт роста ползёт кверху, а над ним
// висит и оседает облако появившегося вещества.
// ⚠️ Проход ОДНОЙ точки — короткий. Раньше он был 0.24 при окне объекта в 0.20,
// и окно схлопывалось в ноль: все точки объекта получали одну и ту же задержку,
// объект возникал целиком, а не рос снизу. Ровно это и сломало анимацию.
// Правило: OBJ_SPAN обязан быть заметно меньше самого короткого span в таблице.
// ⚠️ Часы мира — один сигнал worldGrowth, а окна появления в таблице заданы в
// СЕКУНДАХ сцены: объекты встают по ходу полёта. Проход одной точки тоже в
// секундах, пересчитан в долю сигнала.
const WORLD_START = Math.min(GRID_START, ...WORLD.map(w => w.at ?? FLY_START));
const WORLD_T = Math.max(gridRevealAt(GRID_HALF, GRID_F1) + 0.77, ...WORLD.map(w => (w.at ?? 0) + (w.dur ?? 0))) - WORLD_START;
if (WORLD_START + WORLD_T > DUR) {
  throw new Error(`мир не успевает встать до конца сцены: ${(WORLD_START + WORLD_T).toFixed(1)} с > ${DUR} с`);
}
const OBJ_SPAN = 0.77 / WORLD_T;

/** Секунды сцены → доля сигнала worldGrowth. */
function worldFrac(sec: number): number {
  return (sec - WORLD_START) / WORLD_T;
}

/** Окно появления объекта в долях сигнала: секунды из таблицы или старые доли. */
function schedOf(w: WorldObj): {t0: number; span: number} {
  if (w.at !== undefined) return {t0: worldFrac(w.at), span: (w.dur ?? 1) / WORLD_T};
  return {t0: w.t0 ?? 0, span: w.span ?? 1};
}
const HANDOFF = 0.30;                       // доля пути до переброса
const DROP_FROM = 0.48;                     // с этого места точка начинает опускаться
const HOVER_MIN = 0.55;                     // метров над целью
const HOVER_VAR = 0.85;
const HOVER_JIT = 0.25;                     // разброс вбок: облако, а не копия объекта

const SWIRL = 0.20;                         // закрутка вокруг оси взгляда, рад
const BOW_NEAR = 0.93;                      // дуга выгибается К камере
const BOW_OUT = 1.06;                       // и чуть наружу

// ⚠️ Сцена грузит ОБЛЕГЧЁННЫЕ копии (.pts.glb), а не исходные модели. В облаке
// точек не используются ни текстуры, ни нормали, ни UV — только позиции вершин,
// и на них приходится ничтожная часть веса файла. Инструмент _glbstrip.cjs
// срезал набор с 24.9 МБ до 4.9: на исходных холодный старт упирался в таймаут,
// потому что vite отдавал двадцать шесть мегабайт дольше, чем страница ждала.
// Исходники остаются в public/ нетронутыми — их грузят другие сцены.

// ⚠️ Меши, которых в кадре быть не должно. SombraSketchfab — плоскость тени
// из экспорта Sketchfab: она лежит на нуле, по площади сравнима с кузовом и
// съедает заметную долю бюджета, рисуя под машиной светящийся прямоугольник.
// Xlay3d — водяной знак автора модели. Ни то, ни другое не машина.
const MESH_SKIP = /sombra|xlay3d/i;

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
let _bloom: UnrealBloomPass | null = null;

// ───────────────────────────────────────────────────────────────────────────
// Код → пиксели. Своя растеризация, а не Manticore: нужен доступ к пикселям,
// а не к нодам. Палитра берётся из канона, поэтому код прилетает окрашенным
// ровно так, как ушёл из прошлой сцены, и цвет стекает уже в полёте.
// ───────────────────────────────────────────────────────────────────────────

interface Tok {
  text: string;
  col: number;
  color: string;
}

const KEYWORDS = new Set(['fun', 'val', 'var', 'return', 'if', 'else', 'true', 'false', 'null']);

function tokenize(line: string): Tok[] {
  const out: Tok[] = [];
  const re = /[A-Za-z_][A-Za-z0-9_]*|\s+|./g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) out.push({text: m[0], col: m.index, color: Canon.ink});
  return out;
}

/** Порядок правил повторяет buildCanonRules: побеждает более специфичное. */
function colorize(toks: Tok[]): void {
  const sig = (i: number, step: number): string => {
    let j = i + step;
    while (j >= 0 && j < toks.length && /^\s+$/.test(toks[j].text)) j += step;
    return j >= 0 && j < toks.length ? toks[j].text : '';
  };
  for (let i = 0; i < toks.length; i++) {
    const s = toks[i].text;
    if (/^\s+$/.test(s)) {
      toks[i].color = '';
      continue;
    }
    if (!/^[A-Za-z_]/.test(s)) {
      toks[i].color = Canon.punctuation;
      continue;
    }
    if (KEYWORDS.has(s)) {
      toks[i].color = Canon.keyword;
      continue;
    }
    if (sig(i, -1) === 'fun') {
      toks[i].color = Canon.methodDef;       // имя в определении — якорь
      continue;
    }
    if (/^[A-Z]/.test(s)) {
      toks[i].color = Canon.type;            // типы раньше вызовов: SessionStarted( — тип
      continue;
    }
    toks[i].color = sig(i, 1) === '(' ? Canon.methodCall : Canon.ink;
  }
}

interface InkPixel {
  x: number[];
  y: number[];
  w: number[];
  rgb: number[];
  total: number;
}

function rasterizeCode(): InkPixel {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d')!;

  // Экранные координаты сцены (центр в нуле) + дрейф прошлой сцены.
  ctx.setTransform(SS, 0, 0, SS, TEX_W / 2, TEX_H / 2);
  ctx.translate(0, STAGE_DY);
  ctx.scale(STAGE_SCALE, STAGE_SCALE);
  ctx.font = `${FS}px ${Fonts.code}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  // ⚠️ Подстановочный моноширинный (Consolas и подобные) идёт с шагом 0.55, а
  // не 0.6: раскладка молча разъедется, и код в кадре будет чужим. Сцена не
  // имеет права стартовать на не той гарнитуре.
  const adv = ctx.measureText('MMMMMMMMMM').width / 10;
  if (Math.abs(adv - ADV) > 0.4) {
    throw new Error(`шрифт кода не JetBrains Mono: шаг ${adv.toFixed(2)} вместо ${ADV}`);
  }

  const blocks: [string, number][] = [
    [WRAP_FLEET, Y_WRAP_FLEET],
    [WRAP_PUBLIC, Y_WRAP_PUBLIC],
    [MERGED, Y_HOME],
  ];
  for (const [src, cy] of blocks) {
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const y = cy + (i - (lines.length - 1) / 2) * LH;
      const toks = tokenize(lines[i]);
      colorize(toks);
      for (const t of toks) {
        if (!t.color) continue;
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, TEXT_LEFT + t.col * ADV, y);
      }
    }
  }

  // Чтение полосами: полный getImageData на 5760×3240 — это 75 МБ разом.
  const out: InkPixel = {x: [], y: [], w: [], rgb: [], total: 0};
  const STRIPS = 12;
  for (let s = 0; s < STRIPS; s++) {
    const y0 = Math.floor((TEX_H * s) / STRIPS);
    const y1 = Math.floor((TEX_H * (s + 1)) / STRIPS);
    const img = ctx.getImageData(0, y0, TEX_W, y1 - y0).data;
    for (let row = 0; row < y1 - y0; row++) {
      const base = row * TEX_W * 4;
      for (let col = 0; col < TEX_W; col++) {
        const o = base + col * 4;
        const a = img[o + 3];
        if (a <= INK_CUT) continue;
        // Альфа — покрытие: у пунктуации она вдвое ниже (цвет канона задан с
        // прозрачностью), и точек ей достаётся ровно вдвое меньше. Это верно.
        const w = a / 255;
        out.x.push(col);
        out.y.push(y0 + row);
        out.w.push(w);
        out.rgb.push(img[o], img[o + 1], img[o + 2]);
        out.total += w;
      }
    }
  }
  if (out.total <= 0) throw new Error('растеризация кода дала пустой кадр');
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// Модель → точки. Используется РОВНО ОДИН РАЗ, в сцену не попадает.
// ───────────────────────────────────────────────────────────────────────────

function collectMeshes(root: Object3D, pick?: RegExp, skip?: RegExp): Mesh[] {
  const out: Mesh[] = [];
  root.updateMatrixWorld(true);
  root.traverse((n: any) => {
    if (!n.isMesh || !n.geometry?.getAttribute?.('position')) return;
    if (MESH_SKIP.test(n.name ?? '')) return;
    if (skip && skip.test(n.name ?? '')) return;
    // Пачки ассетов (несколько светофоров в одном файле) разбираются по имени:
    // каждый вариант ставится отдельным объектом мира, иначе они слипнутся.
    if (pick && !pick.test(n.name ?? '')) return;
    const mats = Array.isArray(n.material) ? n.material : [n.material];
    if (mats.some((m: any) => MESH_SKIP.test(m?.name ?? ''))) return;
    if (mats.every((m: any) => m?.transparent && (m.opacity ?? 1) < 0.6)) return;
    out.push(n as Mesh);
  });
  return out;
}

/** Площадь меша В МИРОВЫХ единицах: доли сэмплов обязаны учитывать масштаб узлов. */
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

/** Суммарная площадь поверхности объекта в мировых единицах. */
function surfaceArea(root: Object3D, pick?: RegExp, skip?: RegExp): number {
  return collectMeshes(root, pick, skip).reduce((s, m) => s + worldArea(m), 0);
}

/** Диапазон точек одного меша в выдаче сэмплера: по нему точка узнаёт свою деталь. */
interface MeshRange { mesh: Mesh; from: number; to: number; }

function sampleSurface(
  roots: Object3D[], count: number, rnd: Rng, out: Float32Array,
  pick?: RegExp, skip?: RegExp, ranges?: MeshRange[],
): void {
  const meshes = roots.flatMap(r => collectMeshes(r, pick, skip));
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
    // three 0.183, но его нет в @types — отсюда каст и проверка.
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
    ranges?.push({mesh: meshes[mi], from: written, to: written + share});
    written += share;
  }
  if (written < count) throw new Error(`сэмплер выдал ${written} точек из ${count}`);
}

// ───────────────────────────────────────────────────────────────────────────
// Сортировки по упакованному ключу. Морton даёт соответствие текст↔машина,
// ранг радиуса — очередь вылета.
// ⚠️ Ключ пакуется в Float64: 22 бита значения + 20 бит индекса = 42, мантисса
// держит 53 — целые точные. Сортировка типизированного массива числовая.
// ───────────────────────────────────────────────────────────────────────────

const MORTON_BITS = 11;                     // сетка 2048×2048 на кадр
// ⚠️ Основание упаковки обязано быть НЕ МЕНЬШЕ N: при 2^20 и бюджете 2.2M
// индекс переполнялся в поле значения, половина точек получала чужие цели.
// 22 бита значения + 22 бита индекса = 44 при мантиссе 53 — целые точные.
const IDX_BASE = 1 << 22;

function part1by1(n: number): number {
  n &= 0x0000ffff;
  n = (n | (n << 8)) & 0x00ff00ff;
  n = (n | (n << 4)) & 0x0f0f0f0f;
  n = (n | (n << 2)) & 0x33333333;
  n = (n | (n << 1)) & 0x55555555;
  return n;
}

function orderByKey(keys: Float64Array, n: number): Int32Array {
  keys.sort();
  const order = new Int32Array(n);
  for (let i = 0; i < n; i++) order[i] = keys[i] % IDX_BASE;
  return order;
}

/** Перемешанный порядок индексов: подмножество берётся равномерно по поверхности. */
function shuffledOrder(n: number, rnd: Rng): Int32Array {
  const o = new Int32Array(n);
  for (let i = 0; i < n; i++) o[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    const t = o[i]; o[i] = o[j]; o[j] = t;
  }
  return o;
}

/** Индексы, отсортированные по коду Мортона от экранных NDC. */
function mortonOrder(ndc: Float32Array, n: number): Int32Array {
  const Q = (1 << MORTON_BITS) - 1;
  const keys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let qx = Math.round(((ndc[i * 2] + 1) * 0.5) * Q);
    let qy = Math.round(((1 - ndc[i * 2 + 1]) * 0.5) * Q);
    qx = qx < 0 ? 0 : qx > Q ? Q : qx;
    qy = qy < 0 ? 0 : qy > Q ? Q : qy;
    keys[i] = (part1by1(qx) | (part1by1(qy) << 1)) * IDX_BASE + i;
  }
  return orderByKey(keys, n);
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  const rnd = rng(SEED);

  // ⚠️ Растеризация идёт по реальным метрикам гарнитуры: до неё шрифт обязан
  // быть загружен, иначе первый кадр уедет на подстановочный.
  yield document.fonts.load(`${FS}px "JetBrains Mono"`);

  // ── Машина: модель используется один раз ─────────────────────────────────
  const loader = new GLTFLoader();
  const load = (url: string) => new Promise<any>((res, rej) =>
    loader.load(url, res, undefined,
      () => rej(new Error(`нет файла ${url} — положи модель в public/`))));
  const gltf = yield load('/honda_e.pts.glb');
  // Пачка ассетов упоминается в таблице дважды (два светофора, два фонаря) —
  // файл при этом обязан приехать один раз.
  const byUrl = new Map<string, any>();
  for (const w of WORLD) if (w.url && !byUrl.has(w.url)) byUrl.set(w.url, yield load(w.url));
  const worldGltf = WORLD.map(w => (w.url ? byUrl.get(w.url) : null));
  const car = gltf.scene as Object3D;
  car.updateMatrixWorld(true);
  const bb = new Box3().setFromObject(car);
  car.position.y -= bb.min.y;                // ставим на нулевую отметку
  car.position.x -= (bb.min.x + bb.max.x) / 2;
  car.position.z -= (bb.min.z + bb.max.z) / 2;
  car.updateMatrixWorld(true);
  const box = new Box3().setFromObject(car);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());

  // ── Камера: три четверти от оси кузова ───────────────────────────────────
  // Ось длины берётся из габарита, а не хардкодом: модель может прийти
  // повёрнутой, и ракурс не должен от этого разъезжаться.
  const alongX = size.x >= size.z;
  const halfLen = (alongX ? size.x : size.z) / 2;
  const halfWid = (alongX ? size.z : size.x) / 2;
  const screenHalf = halfLen * Math.sin(CAM_AZ) + halfWid * Math.cos(CAM_AZ);
  const tanX = Math.tan((FOV * D2R) / 2) * (Screen.width / Screen.height);
  const DT = screenHalf / (FILL * tanX);

  const dirLen = alongX ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1);
  const dirWid = alongX ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0);
  const flat = dirLen.clone().multiplyScalar(Math.cos(CAM_AZ))
    .addScaledVector(dirWid, Math.sin(CAM_AZ))
    .normalize();
  const camDir = new Vector3(
    flat.x * Math.cos(CAM_EL),
    Math.sin(CAM_EL),
    flat.z * Math.cos(CAM_EL),
  ).normalize();

  const target = center.clone();
  target.y += TGT_DY;
  const camPos = target.clone().addScaledVector(camDir, DT);

  const camera = new PerspectiveCamera(FOV, Screen.width / Screen.height, 0.1, 400);

  // Направление полёта: по горизонтали от камеры сборки через машину вперёд.
  const pathDir = new Vector3(-flat.x, 0, -flat.z).normalize();
  if (Math.abs(DT * Math.cos(CAM_EL) - CAM_BACK) > 0.15) {
    throw new Error(`CAM_BACK=${CAM_BACK} разошёлся с выносом камеры ${(DT * Math.cos(CAM_EL)).toFixed(2)} — поправь константу`);
  }

  // Одна функция на всю камеру: дыхание кадра на сборке и полёт над машиной.
  // Вызывается из onRender по сигналам. Камера только переносится вперёд по
  // пути, направление взгляда не меняется.
  const aim = new Vector3();
  function placeCamera(breathV: number, flyT: number): void {
    camera.position.copy(target)
      .addScaledVector(camDir, DT * (1 + (CAM_BREATH - 1) * breathV))
      .addScaledVector(pathDir, flyDistance(flyT));
    aim.copy(camera.position).addScaledVector(camDir, -DT);
    camera.lookAt(aim);
    camera.updateMatrixWorld(true);
  }
  placeCamera(0, 0);

  const fwd = target.clone().sub(camPos).normalize();
  const right = new Vector3().crossVectors(fwd, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(right, fwd).normalize();

  // ── Точки текста ─────────────────────────────────────────────────────────
  // Плоскость текста стоит перпендикулярно взгляду на выносе камеры: кадр там
  // ровно в границах экрана, а перспективный множитель равен единице.
  const halfH = Math.tan((FOV * D2R) / 2) * DT;
  const halfW = halfH * (Screen.width / Screen.height);

  const aText = new Float32Array(N * 3);
  const aTint = new Uint8Array(N * 3);
  const ndcText = new Float32Array(N * 2);

  {
    const ink = rasterizeCode();
    const count = ink.w.length;
    const scale = N / ink.total;
    let cur = 0;
    // Стохастическое округление доли: пиксель получает floor(w·s + ξ) точек.
    // Это ровнее выборки по CDF — там пуассоновский разброс комкует штрих.
    // Хвост (±пара сотен по дисперсии) добираем циклическим обходом.
    for (let pass = 0; cur < N; pass++) {
      for (let e = 0; e < count && cur < N; e++) {
        let k = pass === 0 ? Math.floor(ink.w[e] * scale + rnd()) : 1;
        while (k-- > 0 && cur < N) {
          const px = ink.x[e] + rnd();
          const py = ink.y[e] + rnd();
          const nx = (px / TEX_W) * 2 - 1;
          const ny = 1 - (py / TEX_H) * 2;
          const o = cur * 3;
          aText[o] = camPos.x + fwd.x * DT + right.x * nx * halfW + up.x * ny * halfH;
          aText[o + 1] = camPos.y + fwd.y * DT + right.y * nx * halfW + up.y * ny * halfH;
          aText[o + 2] = camPos.z + fwd.z * DT + right.z * nx * halfW + up.z * ny * halfH;
          aTint[o] = ink.rgb[e * 3];
          aTint[o + 1] = ink.rgb[e * 3 + 1];
          aTint[o + 2] = ink.rgb[e * 3 + 2];
          ndcText[cur * 2] = nx;
          ndcText[cur * 2 + 1] = ny;
          cur++;
        }
      }
    }
  }

  // ── Точки машины ─────────────────────────────────────────────────────────
  const vanPos = new Float32Array(N * 3);
  sampleSurface([car], N, rnd, vanPos);

  const ndcVan = new Float32Array(N * 2);
  {
    const mvp = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const m = mvp.elements;
    for (let i = 0; i < N; i++) {
      const o = i * 3;
      const x = vanPos[o], y = vanPos[o + 1], z = vanPos[o + 2];
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      const iw = 1 / (Math.abs(w) < 1e-6 ? 1e-6 : w);
      ndcVan[i * 2] = (m[0] * x + m[4] * y + m[8] * z + m[12]) * iw;
      ndcVan[i * 2 + 1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) * iw;
    }
  }

  // ── Мир: вдоль пути камеры ────────────────────────────────────────────
  // ⚠️ Оси ПУТИ: right — вбок по кадру сборки, fwd — вдоль полёта от центра
  // кузова. Объекты встают по сторонам линии, над которой летит камера.
  const roadDir = right.clone().setY(0).normalize();
  const roadNrm = pathDir.clone();

  interface Placed {
    w: WorldObj;
    root: Object3D | null;
    segs: number[] | null;
    area: number;
    length: number;
    px?: number;
    pz?: number;
    pocket?: Pocket;
  }
  // ── Карман ───────────────────────────────────────────────────────────────
  // ⚠️ Телефон торчит из кармана НА САМОЙ ФИГУРЕ, а не висит в воздухе у бедра.
  // Карман ищется по поверхности бёдер: сторона, видимая камере в конце
  // отъезда, чуть к краю силуэта наружу от машины — там искра не тонет в
  // свечении фигуры. Руки на этой высоте отсекаются по радиусу от оси бёдер,
  // иначе телефон сел бы на кисть и читался «в руке».
  const camEnd = camPos.clone();               // карман смотрит на камеру, подлетающую сзади по пути
  function findPocket(host: Placed): Pocket {
    const S = 8000;
    const pts = new Float32Array(S * 3);
    // Свой генератор: поиск кармана не сдвигает случайную последовательность сцены.
    sampleSurface([host.root!], S, rng(SEED + 17), pts, host.w.pick, host.w.skip);
    let yTop = 0;
    for (let k = 0; k < S; k++) yTop = Math.max(yTop, pts[k * 3 + 1]);
    const y0 = yTop * (POCKET_Y - 0.03), y1 = yTop * (POCKET_Y + 0.03);
    let band: number[] = [];
    for (let k = 0; k < S; k++) if (pts[k * 3 + 1] >= y0 && pts[k * 3 + 1] <= y1) band.push(k);
    if (band.length < 40) throw new Error(`${host.w.key}: на высоте кармана нет поверхности`);
    let cx = 0, cz = 0;
    for (let pass = 0; ; pass++) {
      cx = 0; cz = 0;
      for (const k of band) { cx += pts[k * 3]; cz += pts[k * 3 + 2]; }
      cx /= band.length; cz /= band.length;
      if (pass === 1) break;
      const dist = band.map(k => Math.hypot(pts[k * 3] - cx, pts[k * 3 + 2] - cz));
      const med = [...dist].sort((a, b) => a - b)[dist.length >> 1];
      band = band.filter((_, j) => dist[j] <= med * 1.15);
    }
    const toCam = new Vector3(camEnd.x - cx, 0, camEnd.z - cz).normalize();
    const side = (host.w.right ?? 1) < 0 ? -1 : 1;
    const score = (k: number) => {
      const dx = pts[k * 3] - cx, dz = pts[k * 3 + 2] - cz;
      return dx * toCam.x + dz * toCam.z + POCKET_SIDE * side * (dx * roadDir.x + dz * roadDir.z);
    };
    const top = [...band].sort((a, b) => score(b) - score(a))
      .slice(0, Math.max(4, Math.round(band.length * 0.04)));
    let qx = 0, qz = 0;
    for (const k of top) { qx += pts[k * 3]; qz += pts[k * 3 + 2]; }
    qx /= top.length; qz /= top.length;
    const n = new Vector3(qx - cx, 0, qz - cz).normalize();
    const u = new Vector3(0, 1, 0).applyAxisAngle(n, POCKET_TILT);
    const t = new Vector3().crossVectors(u, n).normalize();
    return {c: new Vector3(qx, yTop * POCKET_Y, qz), t, u, n};
  }

  const placed: Placed[] = [];
  const placeOne = (w: WorldObj, i: number): Placed => {
    const px = center.x + roadDir.x * (w.right ?? 0) + roadNrm.x * (w.fwd ?? 0);
    const pz = center.z + roadDir.z * (w.right ?? 0) + roadNrm.z * (w.fwd ?? 0);

    // Дом ряда строится процедурно, прямо в мировых координатах.
    if (w.house) return {w, root: null, segs: null, area: 0, length: 0, px, pz};

    // Телефону нужна уже поставленная фигура: карман ищется на её поверхности.
    if (w.pocketOf) {
      const host = placed.find(p => p.w.key === w.pocketOf);
      if (!host?.root) throw new Error(`${w.key}: фигура ${w.pocketOf} должна стоять в таблице выше`);
      return {w, root: null, segs: null, area: 0, length: 0, pocket: findPocket(host)};
    }

    // ⚠️ КОПИЯ, а не сам загруженный объект. Один файл упомянут в таблице по
    // два-три раза (два светофора, два фонаря, три человека). Общий объект
    // означал, что каждая следующая запись двигает предыдущую: в кадре
    // оставалась последняя позиция, а остальные фигуры уезжали к чёрту на кулички.
    // clone(true) разделяет только узлы, геометрия остаётся общей — памяти не ест.
    const inner = (worldGltf[i].scene as Object3D).clone(true);
    inner.updateMatrixWorld(true);
    // ⚠️ Габарит считаем по ВЗЯТЫМ мешам, а не по всей модели: у пачки из
    // восьми фонарей центр файла приходится на пустоту между вариантами, и
    // объект уехал бы на десяток метров мимо своего места.
    let pb = new Box3();
    for (const m of collectMeshes(inner, w.pick, w.skip)) pb.expandByObject(m);
    // Подгонка роста: набор людей приходит десятиметровыми фигурами.
    if (w.height) {
      inner.scale.multiplyScalar(w.height / Math.max(1e-4, pb.max.y - pb.min.y));
      inner.updateMatrixWorld(true);
      pb = new Box3();
      for (const m of collectMeshes(inner, w.pick, w.skip)) pb.expandByObject(m);
    }
    // ⚠️ Модель кладётся ВНУТРЬ пустого узла, и в ноль сдвигается она, а не он.
    // Иначе поворот идёт вокруг начала координат ФАЙЛА, а не вокруг объекта: у
    // пачки людей каждая фигура лежит в своём углу поля в четыреста метров, и
    // доворот отбрасывал её за кадр. У пачек фонарей и светофоров то же самое,
    // только на десятке метров — потому и не бросалось в глаза.
    inner.position.x -= (pb.min.x + pb.max.x) / 2;
    inner.position.y -= pb.min.y;                      // на нулевую отметку
    inner.position.z -= (pb.min.z + pb.max.z) / 2;
    const root = new Object3D();
    root.add(inner);
    root.position.set(px, 0, pz);
    // Лицом к машине плюс доворот из таблицы.
    root.rotation.y = Math.atan2(-(center.z - pz), center.x - px) + (w.yaw ?? 0);
    root.updateMatrixWorld(true);
    return {w, root, segs: null, area: surfaceArea(root, w.pick, w.skip), length: 0, px, pz};
  };
  WORLD.forEach((w, i) => placed.push(placeOne(w, i)));
  // Дома ряда стоят фасадом к камере: локальная x идёт вдоль ряда.
  const houseYaw = Math.atan2(roadDir.z, roadDir.x);
  // Дом улицы справа: фасад к осевой, локальная +x — назад по ходу, к камере.
  const streetYawRight = Math.atan2(-roadNrm.z, -roadNrm.x);

  // ⚠️ Плотность объекта считается от СВЕТА машины, а не от остатка бюджета:
  // яркость машины закреплена (CAR_LIGHT), и «объект чуть тусклее машины» —
  // это доля от её плотности на м². Добавили объект — остальные не поехали.
  // Земля, дома ряда и телефоны берут фиксированное число точек: мерить их по
  // площади бессмысленно — плотность там задаётся расстоянием.
  const carArea = surfaceArea(car);
  const D = CAR_LIGHT / carArea;
  let assigned = 0;
  const parts = placed.map(p => {
    const n = p.w.points !== undefined
      ? p.w.points
      : Math.max(0, Math.round(D * (p.w.density ?? 1) * p.area));
    assigned += n;
    // ⚠️ Яркость стены дома задаётся ОТНОШЕНИЕМ к кузову, а не числом: плотность
    // дома выбрана под зерно, множитель досчитывается от плотности машины D.
    const gain = !p.w.house ? (p.w.gain ?? 1)
      : p.w.street ? (STREET_REL * D) / STREET_PTS : (HOUSE_REL * D) / HOUSE_PTS;
    return {...p, n, gain};
  });
  assigned += GRID_POINTS;                            // земля
  const N_CAR = N - assigned;
  const groundDelays = new Float32Array(GRID_POINTS);   // очередь земли — для компенсации яркости машины
  if (N_CAR < CAR_LIGHT) {
    throw new Error(`миру ушло ${assigned} из ${N}: машине осталось меньше её света (${CAR_LIGHT})`);
  }
  for (const p of parts) {
    console.log(p.w.points !== undefined
      ? `[мир] ${p.w.key}: ${p.n} точек, множитель ${p.gain.toFixed(2)}`
      : `[мир] ${p.w.key}: ${p.area.toFixed(1)} м², ${p.n} точек, ${(p.n / Math.max(p.area, 1e-6)).toFixed(0)} точек/м²`);
  }
  console.log(`[мир] машина: ${carArea.toFixed(1)} м², ${N_CAR} точек, ${(N_CAR / carArea).toFixed(0)} точек/м²`);

  // ⚠️ ЗДЕСЬ РЕШАЕТСЯ, ЧИТАЕТСЯ СЦЕНА ИЛИ НЕТ. Оба набора идут по одному
  // обходу экрана, пары берутся по рангу — приблизительный перенос массы,
  // сохраняющий взаимное расположение. Текст не рассыпается, он складывается.
  const orderText = mortonOrder(ndcText, N);
  const orderVan = mortonOrder(ndcVan, N);

  const aTarget = new Float32Array(N * 3);
  const aVia = new Float32Array(N * 3);
  const aSpread = new Float32Array(N * 3);
  const aSeed = new Float32Array(N);
  const aKind = new Float32Array(N);         // 1 — линия сетки (яркость по глубине), 0 — остальное
  const aDelay = new Float32Array(N);
  const aSpan = new Float32Array(N);
  // Второй дом точки: куда она уходит с машины. У неподвижных совпадает с
  // aTarget — тогда кривая вырождается в точку и полёта не происходит вовсе.
  const aHome2 = new Float32Array(N * 3);
  const aVia2 = new Float32Array(N * 3);
  const aSched2 = new Float32Array(N * 4);   // (delay, span, group, gain)

  const pxWorld = (2 * halfH) / Screen.height;   // мир на один экранный пиксель

  const mid = new Vector3(), perp = new Vector3(), cr = new Vector3();
  for (let r = 0; r < N; r++) {
    const ti = orderText[r];
    const vi = orderVan[r];
    const to = ti * 3, vo = vi * 3;

    aTarget[to] = vanPos[vo];
    aTarget[to + 1] = vanPos[vo + 1];
    aTarget[to + 2] = vanPos[vo + 2];

    // Дуга: середина пути, отведённая к камере и закрученная вокруг оси
    // взгляда. Стечение получает вращение, но кадр не превращается в вихрь.
    mid.set(
      (aText[to] + aTarget[to]) * 0.5,
      (aText[to + 1] + aTarget[to + 1]) * 0.5,
      (aText[to + 2] + aTarget[to + 2]) * 0.5,
    ).sub(camPos);
    const depth = mid.dot(fwd);
    perp.copy(mid).addScaledVector(fwd, -depth);
    cr.crossVectors(fwd, perp);
    const cs = Math.cos(SWIRL), sn = Math.sin(SWIRL);
    const jx = (rnd() - 0.5) * 0.5, jy = (rnd() - 0.5) * 0.5, jz = (rnd() - 0.5) * 0.5;
    aVia[to] = camPos.x + fwd.x * depth * BOW_NEAR + (perp.x * cs + cr.x * sn) * BOW_OUT + jx;
    aVia[to + 1] = camPos.y + fwd.y * depth * BOW_NEAR + (perp.y * cs + cr.y * sn) * BOW_OUT + jy;
    aVia[to + 2] = camPos.z + fwd.z * depth * BOW_NEAR + (perp.z * cs + cr.z * sn) * BOW_OUT + jz;

    // Разброс, которым буквы сливаются в полосы: равномерный по площади диск
    // в плоскости кадра, чуть вытянутый вдоль строки.
    const th = rnd() * Math.PI * 2;
    const rad = SPREAD_R * pxWorld * Math.sqrt(rnd());
    const cw = Math.cos(th) * rad * SPREAD_X, sw = Math.sin(th) * rad;
    aSpread[to] = right.x * cw + up.x * sw;
    aSpread[to + 1] = right.y * cw + up.y * sw;
    aSpread[to + 2] = right.z * cw + up.z * sw;

    aSeed[ti] = rnd();
    aSpan[ti] = FLY_SPAN;
  }

  // Очередь вылета по квантилю радиуса цели: машина набирается изнутри наружу
  // с постоянным потоком массы.
  {
    const keys = new Float64Array(N);
    let rMax = 1e-6;
    for (let i = 0; i < N; i++) {
      const o = i * 3;
      const r = Math.hypot(aTarget[o] - center.x, aTarget[o + 1] - center.y, aTarget[o + 2] - center.z);
      if (r > rMax) rMax = r;
      keys[i] = r;
    }
    const Q = IDX_BASE - 1;
    for (let i = 0; i < N; i++) keys[i] = Math.round((keys[i] / rMax) * Q) * IDX_BASE + i;
    const byRadius = orderByKey(keys, N);
    for (let rank = 0; rank < N; rank++) {
      const i = byRadius[rank];
      const q = rank / (N - 1);
      aDelay[i] = Math.max(0, Math.min(1 - FLY_SPAN, q * (1 - FLY_SPAN) + (rnd() - 0.5) * 0.04));
    }
  }

  // ── Второй дом: объекты мира ─────────────────────────────────────────────
  // По умолчанию точка никуда не летит: обе контрольные точки совпадают с её
  // местом на машине, а delay=1 держит её долю пути в нуле при любом сигнале.
  aHome2.set(aTarget);
  aVia2.set(aTarget);
  for (let i = 0; i < N; i++) { aSched2[i * 4] = 1; aSched2[i * 4 + 1] = 1; aSched2[i * 4 + 3] = 1; }

  {
    // ⚠️ Подмножество РАВНОМЕРНОЕ по всей поверхности машины. Взять индексы
    // подряд нельзя: сэмплер идёт мешами, и у машины исчез бы целый кусок
    // кузова — читалось бы как поломка, а не как отдача материала.
    const shuf = shuffledOrder(N, rnd);

    const mvp = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const m = mvp.elements;
    const ndcAt = (x: number, y: number, z: number, out: Float32Array, k: number) => {
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      const iw = 1 / (Math.abs(w) < 1e-6 ? 1e-6 : w);
      out[k * 2] = (m[0] * x + m[4] * y + m[8] * z + m[12]) * iw;
      out[k * 2 + 1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) * iw;
    };

    let cursor = 0;                                    // сколько точек машины уже роздано
    for (const part of parts) {
      const n = part.n;
      if (n <= 0) continue;
      const pos = new Float32Array(n * 3);
      if (part.w.house) {
        sampleHouse(part.w.house, part.px!, part.pz!, part.w.street === 'right' ? streetYawRight : houseYaw, n, rnd, pos);
      } else if (part.pocket) {
        samplePhone(part.pocket, n, rnd, pos);
      } else {
        sampleSurface([part.root!], n, rnd, pos, part.w.pick, part.w.skip);
      }

      const ndcFrom = new Float32Array(n * 2);
      const ndcTo = new Float32Array(n * 2);
      for (let k = 0; k < n; k++) {
        const o = shuf[cursor + k] * 3;
        ndcAt(aTarget[o], aTarget[o + 1], aTarget[o + 2], ndcFrom, k);
        ndcAt(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2], ndcTo, k);
      }
      // Тот же принцип, что и на тексте: пары по экранному рангу.
      const oFrom = mortonOrder(ndcFrom, n);
      const oTo = mortonOrder(ndcTo, n);

      // Очередь по РАНГУ высоты цели: объект набирается снизу вверх ровным
      // потоком материала. По абсолютной высоте у объекта с тонкой мачтой и
      // массивной головой мачта строилась бы пусто, а голова возникла разом.
      const hKeys = new Float64Array(n);
      let hMin = Infinity, hMax = -Infinity;
      for (let k = 0; k < n; k++) {
        const y = pos[k * 3 + 1];
        if (y < hMin) hMin = y;
        if (y > hMax) hMax = y;
      }
      const hSpan = Math.max(1e-6, hMax - hMin);
      for (let k = 0; k < n; k++) {
        hKeys[k] = Math.round(((pos[k * 3 + 1] - hMin) / hSpan) * (IDX_BASE - 1)) * IDX_BASE + k;
      }
      const byHeight = orderByKey(hKeys, n);
      const rankOf = new Int32Array(n);
      for (let r = 0; r < n; r++) rankOf[byHeight[r]] = r;

      // Окно появления объекта внутри общего сигнала worldGrowth.
      const {t0, span: sp} = schedOf(part.w);
      const win = Math.max(OBJ_SPAN, sp) - OBJ_SPAN;

      for (let r = 0; r < n; r++) {
        const i = shuf[cursor + oFrom[r]];
        const dst = oTo[r];
        const o = i * 3, p = dst * 3;
        aHome2[o] = pos[p];
        aHome2[o + 1] = pos[p + 1];
        aHome2[o + 2] = pos[p + 2];

        // Точка ПОЯВЛЕНИЯ — над своим же местом, с небольшим разбросом вбок,
        // чтобы над объектом висело облако, а не его призрачная копия.
        aVia2[o] = aHome2[o] + (rnd() - 0.5) * 2 * HOVER_JIT;
        aVia2[o + 1] = aHome2[o + 1] + HOVER_MIN + rnd() * HOVER_VAR;
        aVia2[o + 2] = aHome2[o + 2] + (rnd() - 0.5) * 2 * HOVER_JIT;

        const q = rankOf[dst] / Math.max(1, n - 1);
        const so = i * 4;
        aSched2[so] = Math.max(0, Math.min(1 - OBJ_SPAN, t0 + q * win + (rnd() - 0.5) * 0.04));
        aSched2[so + 1] = OBJ_SPAN;
        aSched2[so + 2] = 1;
        aSched2[so + 3] = part.gain;
      }
      cursor += n;
    }

    // ── Земля: сетка из точек ────────────────────────────────────────────
    // Точки берутся со следующих перемешанных индексов машины. Мортон тут не
    // нужен: переброс идёт на нулевой альфе, связь в кадре не видна.
    {
      const segs = gridSegments();
      const cdf = new Float64Array(segs.length);
      let acc = 0;
      for (let k = 0; k < segs.length; k++) {
        acc += Math.hypot(segs[k].r1 - segs[k].r0, segs[k].f1 - segs[k].f0);
        cdf[k] = acc;
      }
      for (let g = 0; g < GRID_POINTS; g++) {
        const t = rnd() * acc;
        let lo = 0, hi = segs.length - 1;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < t) lo = mid + 1; else hi = mid; }
        const sg = segs[lo], u = rnd();
        const rt = sg.r0 + (sg.r1 - sg.r0) * u;
        const fw = sg.f0 + (sg.f1 - sg.f0) * u;
        const i = shuf[cursor + g];
        const h3 = i * 3;
        aHome2[h3] = center.x + roadDir.x * rt + roadNrm.x * fw;
        aHome2[h3 + 1] = 0;
        aHome2[h3 + 2] = center.z + roadDir.z * rt + roadNrm.z * fw;
        // Точка появляется чуть над своим местом и оседает — без бокового
        // разброса, иначе линии размажутся.
        aVia2[h3] = aHome2[h3];
        aVia2[h3 + 1] = GRID_HOVER_MIN + rnd() * GRID_HOVER_VAR;
        aVia2[h3 + 2] = aHome2[h3 + 2];
        const delay = Math.max(0, Math.min(1 - OBJ_SPAN,
          worldFrac(gridRevealAt(rt, fw)) + (rnd() - 0.5) * (0.12 / WORLD_T)));
        const so = i * 4;
        aSched2[so] = delay;
        aSched2[so + 1] = OBJ_SPAN;
        aSched2[so + 2] = 1;
        aSched2[so + 3] = GRID_GAIN;
        aKind[i] = 1;                                 // линия: яркость по глубине в шейдере
        groundDelays[g] = delay;
      }
      cursor += GRID_POINTS;
      groundDelays.sort();
    }
  }

  // Сколько точек и когда уходит с машины — по этому считается компенсация.
  const drain = parts.map(p => ({
    n: p.n,
    t0: schedOf(p.w).t0,
    span: Math.max(OBJ_SPAN, schedOf(p.w).span),
  }));

  // ── Облако ───────────────────────────────────────────────────────────────
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(aText, 3));
  geo.setAttribute('aTarget', new BufferAttribute(aTarget, 3));
  geo.setAttribute('aVia', new BufferAttribute(aVia, 3));
  geo.setAttribute('aSpread', new BufferAttribute(aSpread, 3));
  geo.setAttribute('aTint', new BufferAttribute(aTint, 3, true));
  geo.setAttribute('aSeed', new BufferAttribute(aSeed, 1));
  geo.setAttribute('aKind', new BufferAttribute(aKind, 1));
  geo.setAttribute('aDelay', new BufferAttribute(aDelay, 1));
  geo.setAttribute('aSpan', new BufferAttribute(aSpan, 1));
  geo.setAttribute('aHome2', new BufferAttribute(aHome2, 3));
  geo.setAttribute('aVia2', new BufferAttribute(aVia2, 3));
  geo.setAttribute('aSched2', new BufferAttribute(aSched2, 4));

  const mat = new ShaderMaterial({
    uniforms: {
      uDissolve: {value: 0},
      uAssemble: {value: 0},
      uWorld: {value: 0},
      uDrain: {value: 0},
      uRef: {value: DT},
      uPxText: {value: PX_TEXT},
      uPxGlow: {value: PX_GLOW},
      uPxVan: {value: PX_VAN},
      uATxt: {value: A_TEXT},
      uAGlow: {value: A_GLOW},
      uAVan: {value: A_VAN},
      uCarLift: {value: 1},
      uLineCompR: {value: LINE_COMP_R},
      uLineCompMax: {value: LINE_COMP_MAX},
      uLineFade0: {value: LINE_FADE0},
      uLineFade1: {value: LINE_FADE1},
      uFlyDim: {value: FLY_DIM},
      uMinPx: {value: PX_MIN},
      uMaxPx: {value: PX_MAX},
      uFloor: {value: ALPHA_FLOOR},
      uHandoff: {value: HANDOFF},
      uDropFrom: {value: DROP_FROM},
      uInk: {value: new Color(INK).convertSRGBToLinear()},
    },
    vertexShader: `
      attribute vec3 aTarget;
      attribute vec3 aVia;
      attribute vec3 aSpread;
      attribute vec3 aTint;
      attribute float aSeed;
      attribute float aKind;
      attribute float aDelay;
      attribute float aSpan;
      attribute vec3 aHome2;
      attribute vec3 aVia2;
      attribute vec4 aSched2;
      uniform float uDissolve, uAssemble, uWorld, uDrain, uRef;
      uniform float uPxText, uPxGlow, uPxVan;
      uniform float uATxt, uAGlow, uAVan, uFlyDim, uCarLift;
      uniform float uLineCompR, uLineCompMax, uLineFade0, uLineFade1;
      uniform float uMinPx, uMaxPx, uFloor;
      uniform float uHandoff, uDropFrom;
      uniform vec3 uInk;
      varying float vA;
      varying vec3 vTint;

      float ease(float t) { return t * t * (3.0 - 2.0 * t); }

      // Атрибут цвета приходит в sRGB (пиксели канваса), рендер линейный.
      vec3 srgbToLinear(vec3 c) {
        return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
      }

      void main() {
        // Такт 1. Разбег по точкам небольшой: буквы обязаны РАСПУСКАТЬСЯ, а не
        // плыть однородным блюром — часть вещества отходит от штриха раньше.
        float d = ease(clamp((uDissolve - aSeed * 0.25) / 0.75, 0.0, 1.0));
        vec3 loose = position + aSpread * d;
        float pxD = mix(uPxText, uPxGlow, d);
        float aD = mix(uATxt, uAGlow, d);

        // Такт 2. У каждой точки своя задержка, путь — дуга через aVia.
        float g = ease(clamp((uAssemble - aDelay) / aSpan, 0.0, 1.0));
        float u = 1.0 - g;
        vec3 p = u * u * loose + 2.0 * u * g * aVia + g * g * aTarget;

        // Такт 3, шаг 1. Точка гаснет на машине, появляется НАД своим местом и
        // опускается на него. Перелёта в кадре нет: переброс идёт на нулевой
        // альфе. У неподвижных aSched2.x = 1, значит h = 0 и всё вырождается.
        float h = ease(clamp((uWorld - aSched2.x) / max(aSched2.y, 1e-4), 0.0, 1.0));
        float sw = step(uHandoff, h);
        float drop = smoothstep(uDropFrom, 1.0, h);
        p = mix(p, mix(aVia2, aHome2, drop), sw);
        // Гашение на машине и проявление над целью; между ними точка невидима.
        float visOut = 1.0 - smoothstep(0.0, uHandoff * 0.92, h);
        float visIn = smoothstep(uHandoff * 1.05, uDropFrom, h);
        float vis = mix(visOut, visIn, sw);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;

        // Перспективный размер с зажимом и компенсацией альфой: суммарная
        // яркость формы не зависит от того, где точка оказалась по глубине.
        // Точка, уже перешедшая на объект, живёт по его правилам, как бы далеко ни
        // была её собственная сборка: колонка встаёт, пока машина ещё собирается.
        float px = mix(mix(pxD, uPxVan, g), uPxVan, sw);
        float want = px * uRef / max(-mv.z, 0.001);
        float size = clamp(want, uMinPx, uMaxPx);
        float k = want / size;

        // Пока точка на машине — её яркость правится на убыль вещества; встав
        // на свой объект, она переходит на собственную плотность объекта.
        float a = mix(mix(aD, uAVan * uCarLift, g), uAVan, sw);
        a *= mix(1.0, uFlyDim, 4.0 * g * (1.0 - g));
        a *= mix(1.0, vis, aSched2.z);
        // ⚠️ Усиление яркости объекта. Дом набран редко — по-другому его на
        // семидесяти метрах не собрать, — и без множителя он был бы чёрным.
        // Телефону оно же даёт искру, которую видно на фигуре в семьдесят пикселей.
        a *= mix(1.0, aSched2.w, h);
        // Линии сетки: выравнивание по глубине от камеры и гашение к горизонту.
        float depth = -mv.z;
        float line = step(0.5, aKind) * sw;
        a *= mix(1.0, clamp(depth / uLineCompR, 1.0, uLineCompMax)
          * (1.0 - smoothstep(uLineFade0, uLineFade1, depth)), line);
        vA = a * clamp(k * k, uFloor, 1.0);
        vTint = mix(srgbToLinear(aTint), uInk, uDrain);
        gl_PointSize = size;
      }
    `,
    fragmentShader: `
      varying float vA;
      varying vec3 vTint;
      void main() {
        if (vA < 0.0015) discard;
        vec2 q = gl_PointCoord - 0.5;
        float r = length(q) * 2.0;
        if (r > 1.0) discard;
        float core = 1.0 - smoothstep(0.45, 1.0, r);
        gl_FragColor = vec4(vTint, core * vA);
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });

  const cloud = new Points(geo, mat);
  cloud.frustumCulled = false;

  // ⚠️ В сцене РОВНО ОДИН объект. Модель дальше не нужна.
  const scene3 = new Scene();
  scene3.add(cloud);

  // ── Сигналы ──────────────────────────────────────────────────────────────
  const dissolveCode = createSignal(0);   // код → светящиеся полосы
  const assembleCar = createSignal(0);    // вещество → машина
  const worldGrowth = createSignal(0);    // часы мира: объекты встают по ходу полёта
  const fly = createSignal(0);            // секунды с начала полёта камеры
  
  const returnToCode = createSignal(0);   // такт 5 — вне прототипа
  const breath = createSignal(0);

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
        _bloom = new UnrealBloomPass(new Vector2(RW, RH), 0.16, 0.45, 0.62);
        _composer = new EffectComposer(renderer);
        _composer.setSize(RW, RH);
        _composer.addPass(_renderPass);
        _composer.addPass(_bloom);
        _composer.addPass(new OutputPass());
        _composer.addPass(new ShaderPass(DITHER));
      }
      _renderPass!.scene = s;
      _renderPass!.camera = c;
      renderer.toneMapping = NoToneMapping;
      renderer.toneMappingExposure = 1.0;

      const dis = dissolveCode();
      const asm = assembleCar();
      mat.uniforms.uDissolve.value = dis;
      mat.uniforms.uAssemble.value = asm;
      const wg = worldGrowth();
      mat.uniforms.uWorld.value = wg;
      let gone = 0;
      for (const d of drain) gone += d.n * Math.min(1, Math.max(0, (wg - d.t0) / d.span));
      // Земля уходит с машины по своей очереди — считаем точно, по отсортированным задержкам.
      {
        let lo = 0, hi = groundDelays.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (groundDelays[mid] < wg) lo = mid + 1; else hi = mid; }
        gone += lo;
      }
      mat.uniforms.uCarLift.value = CAR_LIGHT / Math.max(1, N - gone);
      // Цвет канона стекает в крем: код уходит вместе со своей палитрой,
      // дальше в кадре только вещество.
      const t = (dis - 0.15) / 0.6;
      mat.uniforms.uDrain.value = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
      void returnToCode();

      // ⚠️ Блум — это ТАКТ, а не постоянный слой. На резком коде он почти
      // выключен и порог поднят: при низком пороге в ореол уходит весь штрих,
      // и код читается размытым, хотя точки стоят на своих пикселях. Максимум —
      // на светящихся полосах; к собранной машине блум снова убирается.
      const glow = dis * (1 - asm * 0.85);
      _bloom!.strength = 0.16 + 0.70 * glow + 0.26 * asm;
      _bloom!.radius = 0.45 + 0.30 * glow;
      _bloom!.threshold = 0.62 - 0.42 * glow - 0.18 * asm;

      // Дыхание кадра на сборке и полёт камеры — функции сигналов времени.
      placeCamera(breath(), fly());

      _composer.render();
    },
  });

  view.add(threeView.node);
  mountVignette(view, 0.5);

  // ── Такты ────────────────────────────────────────────────────────────────
  // 0.0  код из предыдущей сцены, резкий и читаемый — ЭТОТ такт обязателен:
  //      если зритель не успел опознать код, приёмка провалится не из-за частиц
  // 1.5  ТАКТ 1: цвет стекает, буквы распускаются в светящиеся полосы
  // 2.9  ТАКТ 2: вещество снимается изнутри наружу и стекается в машину
  //      ⚠️ Полёт начинается ДО конца распада. На стыке в кадре одновременно
  //      стоят ещё читаемые полосы кода и уже летящие одиночные точки — именно
  //      это, а не статичное зерно, объявляет, что материал один и тот же.
  //      Одновременно с машиной справа снизу вверх встаёт зарядная колонка.
  // 7.2  под машиной волной ложится земля-сетка
  // 8.2  ТАКТ 3: камера летит над машиной вперёд; земля растёт впереди, по
  //      сторонам пути встают столбы и люди
  yield* all(
    chain(breath(1, 7.6, linear), waitFor(DUR - 7.6)),
    // Часы мира идут отдельно от тактов: окна появления в таблице — в секундах сцены.
    chain(waitFor(WORLD_START), worldGrowth(1, WORLD_T, linear), waitFor(DUR - WORLD_START - WORLD_T)),
    chain(waitFor(FLY_START), fly(DUR - FLY_START, DUR - FLY_START, linear)),
    (function* () {
      yield* waitFor(1.5);
      yield* all(
        dissolveCode(1, 1.9, easeInOutSine),
        chain(waitFor(1.4), assembleCar(1, 4.3, linear)),
      );
    })(),
  );
});
