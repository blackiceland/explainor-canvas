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
const N = 1_600_000;

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
const A_TEXT = 0.0363;
const A_GLOW = 0.0187;                       // разброс проредил плотность в восемь раз
// Машина отдала пятую часть вещества, её плотность упала с 25 700 до 20 000
// точек на м² — альфу поднимаем ровно на столько же, чтобы абсолютный уровень
// остался тем, что выставлен замером. Колонка при этом остаётся тусклее сама
// по себе: у неё меньше точек на метр поверхности.
const A_VAN = 0.231;
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
// Одно движение и то формальное: 1.8% наезда за восемь секунд. Это дыхание
// кадра (тот же приём, которым заканчивается предыдущая сцена), а не наезд:
// у движения нет ни начала, ни события. Отъезд начинается только в такте 3.
const FOV = 34;
const CAM_AZ = 34 * D2R;                    // отклонение от оси кузова: три четверти
const CAM_EL = 11 * D2R;
// ⚠️ Доля ширины кадра под машину. Больше 0.55 — колёса подходят к нижней
// кромке, и такту 3 некуда отъезжать: кадр обязан начинаться с воздухом.
const FILL = 0.52;
const TGT_BACK = 2.40;                      // прицел уходит вглубь вместе с отъездом
const TGT_UP = 0.90;                        // и поднимается: группа встаёт по центру
const TGT_DY = -0.16;                       // цель ниже центра кузова: машина встаёт по центру кадра
const CAM_BREATH = 0.982;

// ⚠️ Начало отъезда. Колонка стоит в трёх метрах вбок от машины, а при
// стартовом выносе полукадр всего 3.5 м — она упёрлась бы в кромку. Камера
// обязана отойти вместе с её появлением: это не отдельное движение, это первый
// шаг того самого отъезда из такта 3.
// ⚠️ Отъезд теперь настоящий: в кадр должны войти девятиметровый фонарь и
// двенадцатиметровая остановка. Вынос растёт вчетверо с лишним, угол
// возвышения поднимается — под камеру уходит земля, которой нет, поэтому выше
// двадцати градусов забираться нельзя: объекты повиснут.
// ⚠️ Возвышение НИЖЕ, а не выше. На восемнадцати градусах дальние объекты
// уезжали в верхнюю половину кадра, нижняя оставалась пустой. На двенадцати
// глубина почти не превращается в высоту, и горизонт заходит в кадр.
const CAM_PULL = 3.30;                      // множитель выноса к концу такта 3
const CAM_EL2 = 12 * D2R;

// ── МИР: таблица объектов ────────────────────────────────────────────────
// ⚠️ Положение задаётся ОТ КАМЕРЫ, а не в мировых осях. Модель может прийти
// повёрнутой как угодно, а решение здесь экранное: столько-то метров вбок по
// оси кадра и столько-то вглубь. Разворот по умолчанию — лицом к машине.
//
// Добавить объект = добавить строку. Площадь, доля бюджета, подмножество точек
// на машине и расписание появления считаются из неё автоматически.
interface WorldObj {
  key: string;
  /** Модель. Нет — значит объект строится из коробок (дом). */
  url?: string;
  /** ⚠️ Координаты УЛИЧНЫЕ, не экранные. along — метров вдоль улицы,
   *  off — поперёк: 0 это середина проезжей части, минус уходит на дальний
   *  тротуар. Так у расстановки появляется логика: фонари стоят в ряд по
   *  бортовому камню, светофор на углу, остановка на тротуаре, дом за ним. */
  along: number;
  off: number;
  yaw?: number;                             // доворот, рад
  height?: number;                          // подогнать высоту объекта, м
  pick?: RegExp;                            // какие меши брать из пачки
  skip?: RegExp;                            // какие выбросить
  density?: number;                         // плотность точек относительно машины
  /** Дом: [ширина, высота, глубина] основного объёма и надстройки. */
  box?: [number, number, number];
  setback?: [number, number, number];
  floor?: number;                           // шаг междуэтажных линий, м
  cols?: number;                            // сколько вертикалей на фасаде
  /** Точек на погонный метр ребра. Для домов — вместо плотности по площади. */
  lineDensity?: number;
  t0?: number;                              // начало появления, доля worldGrowth
  span?: number;                            // длительность появления, доля worldGrowth
}

// ⚠️ УЛИЦА, А НЕ РОССЫПЬ. Машина стоит у бортового камня, зарядная колонка
// рядом с ней на тротуаре, фонари — в один ряд вдоль камня с постоянным шагом,
// светофоры на углу выше по улице, остановка на тротуаре, люди на тротуаре,
// дом за линией застройки. Порядок появления идёт вдоль улицы от машины.
const WORLD: WorldObj[] = [
  // ── у машины ──────────────────────────────────────────────────────────
  {key: 'charger', url: '/charging_station.pts.glb',
   along: 1.6, off: -3.2, density: 0.90, t0: 0.00, span: 0.16},

  // ── фонари в ряд по камню, шаг двенадцать метров ──────────────────────
  // Два РАЗНЫХ варианта из пачки: один и тот же столб, размноженный по сцене,
  // читается как копипаст.
  {key: 'lamp-a', url: '/various_low-poly_street_lights.pts.glb', pick: /^polySurface69_/,
   along: 6.0, off: -3.6, density: 0.80, t0: 0.10, span: 0.16},
  {key: 'lamp-b', url: '/various_low-poly_street_lights.pts.glb', pick: /^polySurface88_/,
   along: -6.0, off: -3.6, density: 0.70, t0: 0.17, span: 0.16},

  // ── люди на тротуаре ──────────────────────────────────────────────────
  // В наборе 282 фигуры; берём три и подгоняем рост. На таком выносе телефон
  // в руке не различить — работает силуэт человека, а не его поза.
  {key: 'man-1', url: '/lowpoly_people__waldo.pts.glb', pick: /^21_person/,
   along: 3.2, off: -4.7, height: 1.75, density: 1.00, t0: 0.24, span: 0.12},
  {key: 'man-2', url: '/lowpoly_people__waldo.pts.glb', pick: /^134_person/,
   along: -2.4, off: -5.0, yaw: 2.1, height: 1.72, density: 1.00, t0: 0.29, span: 0.12},
  {key: 'man-3', url: '/lowpoly_people__waldo.pts.glb', pick: /^191_person/,
   along: 8.6, off: -4.4, yaw: -1.2, height: 1.78, density: 1.00, t0: 0.34, span: 0.12},

  // ── угол улицы ────────────────────────────────────────────────────────
  {key: 'light-veh', url: '/traffic_lights_street_assets_vol._02.pts.glb', pick: /^Light_/,
   along: -11.0, off: -3.4, density: 1.00, t0: 0.40, span: 0.16},
  {key: 'light-ped', url: '/traffic_lights_street_assets_vol._02.pts.glb', pick: /^Pedestrian_/,
   along: -9.2, off: -5.2, yaw: 1.6, density: 0.90, t0: 0.46, span: 0.14},

  {key: 'ambulance', url: '/shvan_92_ambulance_-_low_poly_model.pts.glb',
   skip: /Interior|Bottom|Suspension|Runningboard/,
   along: 17.0, off: 0.2, density: 0.30, t0: 0.52, span: 0.18},

  {key: 'cctv', url: '/lamppost_with_cctv_cameras.pts.glb',
   along: -15.0, off: -3.8, density: 0.85, t0: 0.60, span: 0.18},

  // ⚠️ У остановки 67 м² приходится на плоскость пола (два треугольника) и ещё
  // 29 — на плоские щиты рекламы. В точках это светящиеся прямоугольники без
  // текстур, а по бюджету — треть всего мира. Выбрасываем.
  {key: 'busstop', url: '/bus_station.pts.glb', skip: /Floor|Signs/,
   along: 11.5, off: -5.6, density: 0.20, t0: 0.67, span: 0.18},

  // ── первый дом ────────────────────────────────────────────────────────
  // ⚠️ Дом НЕ сэмплируется по стенам. Стена большая, точки на ней встают далеко
  // друг от друга, и фасад выходит чёрным — я это уже проверял. Точки идут по
  // РЁБРАМ: по вертикалям углов и линиям перекрытий. На ребре они стоят
  // вплотную, и линия светится. Плотность считается на погонный метр.
  // ⚠️ Дом стоит ДАЛЕКО и высоко: вблизи каркас из рёбер читается стеклянным
  // кубом, а не домом. На выносе те же линии складываются в силуэт, и чем
  // дальше — тем плотнее решётка на экране, тем убедительнее.
  {key: 'block-a', box: [15, 20, 11], setback: [9.5, 7, 7.5], floor: 3.4, cols: 7, lineDensity: 150,
   along: -2.0, off: -24.0, t0: 0.76, span: 0.24},
];

const DUR = 24.0;

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
const OBJ_SPAN = 0.055;
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

/** Двенадцать рёбер коробки с основанием на y0. Отрезками, парами точек. */
function boxEdges(w: number, h: number, d: number, y0: number, out: number[], floor = 0, cols = 0): void {
  const x = w / 2, z = d / 2, y1 = y0 + h;
  const c: [number, number, number][] = [
    [-x, y0, -z], [x, y0, -z], [x, y0, z], [-x, y0, z],
    [-x, y1, -z], [x, y1, -z], [x, y1, z], [-x, y1, z],
  ];
  const e = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  for (const [a, b] of e) out.push(...c[a], ...c[b]);
  // ⚠️ Междуэтажные линии. Без них коробка читается стеклянным кубом, а не
  // домом: у силуэта нет масштаба. Горизонтали через каждый этаж дают и
  // масштаб, и ту самую светящуюся решётку, ради которой всё и затевалось.
  // ⚠️ ПРОМЕЖУТОЧНЫЕ ВЕРТИКАЛИ. Четырёх углов мало: коробка читается стеклянным
  // кубом. Дом делают частые вертикали по фасаду — простенки между окнами. Это
  // тот же вывод, что и в городском прототипе: здание из точек это пучок
  // вертикальных штрихов, а не силуэт.
  for (let i = 1; i < cols; i++) {
    const t = i / cols;
    const px = -x + w * t, pz = -z + d * t;
    out.push(px, y0, -z, px, y0 + h, -z);
    out.push(px, y0, z, px, y0 + h, z);
    out.push(-x, y0, pz, -x, y0 + h, pz);
    out.push(x, y0, pz, x, y0 + h, pz);
  }
  if (floor > 0.5) {
    for (let y = y0 + floor; y < y0 + h - 0.4; y += floor) {
      const r: [number, number, number][] = [[-x, y, -z], [x, y, -z], [x, y, z], [-x, y, z]];
      for (const [a, b] of [[0,1],[1,2],[2,3],[3,0]]) out.push(...r[a], ...r[b]);
    }
  }
}

/** Длина набора отрезков. */
function segLength(segs: number[]): number {
  let L = 0;
  for (let i = 0; i + 5 < segs.length; i += 6) {
    L += Math.hypot(segs[i + 3] - segs[i], segs[i + 4] - segs[i + 1], segs[i + 5] - segs[i + 2]);
  }
  return L;
}

/** Точки вдоль отрезков, поровну на погонный метр. */
function sampleSegments(segs: number[], count: number, rnd: Rng, out: Float32Array): void {
  const n = segs.length / 6;
  const cum = new Float64Array(n);
  let L = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 6;
    L += Math.hypot(segs[o + 3] - segs[o], segs[o + 4] - segs[o + 1], segs[o + 5] - segs[o + 2]);
    cum[i] = L;
  }
  for (let k = 0; k < count; k++) {
    const t = rnd() * L;
    let lo = 0, hi = n - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < t) lo = mid + 1; else hi = mid; }
    const o = lo * 6, u = rnd(), q = k * 3;
    out[q] = segs[o] + (segs[o + 3] - segs[o]) * u;
    out[q + 1] = segs[o + 1] + (segs[o + 4] - segs[o + 1]) * u;
    out[q + 2] = segs[o + 2] + (segs[o + 5] - segs[o + 2]) * u;
  }
}

/** Суммарная площадь поверхности объекта в мировых единицах. */
function surfaceArea(root: Object3D, pick?: RegExp, skip?: RegExp): number {
  return collectMeshes(root, pick, skip).reduce((s, m) => s + worldArea(m), 0);
}

function sampleSurface(roots: Object3D[], count: number, rnd: Rng, out: Float32Array, pick?: RegExp, skip?: RegExp): void {
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

  // Одна функция на всю камеру: дыхание кадра и отъезд складываются, угол
  // возвышения растёт вместе с выносом. Вызывается из onRender по сигналам.
  const camDirAt = new Vector3();
  const aim = new Vector3();
  function placeCamera(breathV: number, pullV: number): void {
    const el = CAM_EL + (CAM_EL2 - CAM_EL) * pullV;
    camDirAt.set(flat.x * Math.cos(el), Math.sin(el), flat.z * Math.cos(el)).normalize();
    // flat смотрит ОТ цели К камере, значит вглубь сцены — это минус flat.
    aim.copy(target).addScaledVector(flat, -TGT_BACK * pullV);
    aim.y += TGT_UP * pullV;
    const len = DT * (1 + (CAM_BREATH - 1) * breathV) * (1 + (CAM_PULL - 1) * pullV);
    camera.position.copy(aim).addScaledVector(camDirAt, len);
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

  // ── Мир: улица ──────────────────────────────────────────────────────────
  // ⚠️ Оси УЛИЧНЫЕ. Продольная — ось кузова машины: она припаркована вдоль
  // проезжей части. Отсюда у расстановки берётся логика: фонари в ряд по
  // бортовому камню с постоянным шагом, светофоры на углу, тротуар на дальней
  // стороне, дом за линией застройки. Раньше объекты стояли по осям КАДРА и
  // читались как россыпь без всякого смысла.
  // ⚠️ Улица идёт ПОПЕРЁК кадра, а не в камеру. Экранная горизонталь при
  // азимуте в тридцать четыре градуса совпадает в основном с поперечной осью
  // кузова, поэтому продольная ось улицы — именно она. Иначе «вдоль улицы»
  // означает «в глубину»: фонари вставали вплотную к объективу и вылетали за
  // край кадра. Машина при этом стоит носом к колонке — так и паркуются на
  // зарядке, а улица уходит влево-вправо.
  const roadDir = dirWid.clone().normalize();
  const roadNrm = dirLen.clone().normalize();

  interface Placed {
    w: WorldObj;
    root: Object3D | null;
    segs: number[] | null;
    area: number;
    length: number;
  }
  const placed: Placed[] = WORLD.map((w, i) => {
    const px = center.x + roadDir.x * w.along + roadNrm.x * w.off;
    const pz = center.z + roadDir.z * w.along + roadNrm.z * w.off;

    // Дом — не модель, а рёбра коробок; ставим сразу в мировых координатах.
    if (w.box) {
      const raw: number[] = [];
      boxEdges(w.box[0], w.box[1], w.box[2], 0, raw, w.floor ?? 0, w.cols ?? 0);
      if (w.setback) boxEdges(w.setback[0], w.setback[1], w.setback[2], w.box[1], raw, w.floor ?? 0, Math.round((w.cols ?? 0) * 0.7));
      const cs = Math.cos(w.yaw ?? 0), sn = Math.sin(w.yaw ?? 0);
      const segs: number[] = [];
      for (let k = 0; k < raw.length; k += 3) {
        segs.push(px + raw[k] * cs - raw[k + 2] * sn, raw[k + 1], pz + raw[k] * sn + raw[k + 2] * cs);
      }
      return {w, root: null, segs, area: 0, length: segLength(segs)};
    }

    // ⚠️ КОПИЯ, а не сам загруженный объект. Один файл упомянут в таблице по
    // два-три раза (два светофора, два фонаря, три человека). Общий объект
    // означал, что каждая следующая запись двигает предыдущую: в кадре
    // оставалась последняя позиция, а остальные фигуры уезжали к чёрту на кулички.
    // clone(true) разделяет только узлы, геометрия остаётся общей — памяти не ест.
    const root = (worldGltf[i].scene as Object3D).clone(true);
    root.updateMatrixWorld(true);
    // ⚠️ Габарит считаем по ВЗЯТЫМ мешам, а не по всей модели: у пачки из
    // восьми фонарей центр файла приходится на пустоту между вариантами, и
    // объект уехал бы на десяток метров мимо своего места.
    let pb = new Box3();
    for (const m of collectMeshes(root, w.pick, w.skip)) pb.expandByObject(m);
    // Подгонка роста: набор людей приходит десятиметровыми фигурами.
    if (w.height) {
      root.scale.multiplyScalar(w.height / Math.max(1e-4, pb.max.y - pb.min.y));
      root.updateMatrixWorld(true);
      pb = new Box3();
      for (const m of collectMeshes(root, w.pick, w.skip)) pb.expandByObject(m);
    }
    root.position.y -= pb.min.y;                       // на нулевую отметку
    root.position.x -= (pb.min.x + pb.max.x) / 2;
    root.position.z -= (pb.min.z + pb.max.z) / 2;
    root.position.x += px;
    root.position.z += pz;
    // Вдоль улицы плюс доворот из таблицы.
    root.rotation.y = Math.atan2(-roadDir.z, roadDir.x) + (w.yaw ?? 0);
    root.updateMatrixWorld(true);
    return {w, root, segs: null, area: surfaceArea(root, w.pick, w.skip), length: 0};
  });

  // ⚠️ Бюджет. Дома считаются НЕ по площади: у них точки идут по рёбрам, и
  // мера там — погонный метр. Сначала снимаем их долю с общего котла, остаток
  // делим по площадям: D — плотность точек на м² у машины.
  const lineTotal = placed.reduce((a, p) => a + p.length * (p.w.lineDensity ?? 0), 0);
  const carArea = surfaceArea(car);
  const denom = carArea + placed.reduce((a, p) => a + (p.w.density ?? 1) * p.area, 0);
  const D = Math.max(0, N - lineTotal) / Math.max(denom, 1e-6);
  let assigned = 0;
  const parts = placed.map(p => {
    const n = p.segs
      ? Math.round(p.length * (p.w.lineDensity ?? 0))
      : Math.max(0, Math.round(D * (p.w.density ?? 1) * p.area));
    assigned += n;
    return {...p, n};
  });
  const N_CAR = N - assigned;
  if (N_CAR < N * 0.2) {
    throw new Error(`миру ушло ${assigned} из ${N}: машине осталось меньше пятой части`);
  }
  for (const p of parts) {
    console.log(p.segs
      ? `[мир] ${p.w.key}: ${p.length.toFixed(0)} м рёбер, ${p.n} точек`
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
  const aDelay = new Float32Array(N);
  const aSpan = new Float32Array(N);
  // Второй дом точки: куда она уходит с машины. У неподвижных совпадает с
  // aTarget — тогда кривая вырождается в точку и полёта не происходит вовсе.
  const aHome2 = new Float32Array(N * 3);
  const aVia2 = new Float32Array(N * 3);
  const aSched2 = new Float32Array(N * 3);   // (delay, span, group)

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
  for (let i = 0; i < N; i++) { aSched2[i * 3] = 1; aSched2[i * 3 + 1] = 1; }

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
      if (part.segs) sampleSegments(part.segs, n, rnd, pos);
      else sampleSurface([part.root!], n, rnd, pos, part.w.pick, part.w.skip);

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
      const t0 = part.w.t0 ?? 0;
      const win = Math.max(OBJ_SPAN, part.w.span ?? 1) - OBJ_SPAN;

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
        aSched2[o] = Math.max(0, Math.min(1 - OBJ_SPAN, t0 + q * win + (rnd() - 0.5) * 0.04));
        aSched2[o + 1] = OBJ_SPAN;
        aSched2[o + 2] = 1;
      }
      cursor += n;
    }
  }

  // Сколько точек и когда уходит с машины — по этому считается компенсация.
  const drain = parts.map(p => ({
    n: p.n,
    t0: p.w.t0 ?? 0,
    span: Math.max(OBJ_SPAN, p.w.span ?? 1),
  }));

  // ── Облако ───────────────────────────────────────────────────────────────
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(aText, 3));
  geo.setAttribute('aTarget', new BufferAttribute(aTarget, 3));
  geo.setAttribute('aVia', new BufferAttribute(aVia, 3));
  geo.setAttribute('aSpread', new BufferAttribute(aSpread, 3));
  geo.setAttribute('aTint', new BufferAttribute(aTint, 3, true));
  geo.setAttribute('aSeed', new BufferAttribute(aSeed, 1));
  geo.setAttribute('aDelay', new BufferAttribute(aDelay, 1));
  geo.setAttribute('aSpan', new BufferAttribute(aSpan, 1));
  geo.setAttribute('aHome2', new BufferAttribute(aHome2, 3));
  geo.setAttribute('aVia2', new BufferAttribute(aVia2, 3));
  geo.setAttribute('aSched2', new BufferAttribute(aSched2, 3));

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
      attribute float aDelay;
      attribute float aSpan;
      attribute vec3 aHome2;
      attribute vec3 aVia2;
      attribute vec3 aSched2;
      uniform float uDissolve, uAssemble, uWorld, uDrain, uRef;
      uniform float uPxText, uPxGlow, uPxVan;
      uniform float uATxt, uAGlow, uAVan, uFlyDim, uCarLift;
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
        float px = mix(pxD, uPxVan, g);
        float want = px * uRef / max(-mv.z, 0.001);
        float size = clamp(want, uMinPx, uMaxPx);
        float k = want / size;

        // Пока точка на машине — её яркость правится на убыль вещества; встав
        // на свой объект, она переходит на собственную плотность объекта.
        float a = mix(aD, uAVan * mix(uCarLift, 1.0, h), g);
        a *= mix(1.0, uFlyDim, 4.0 * g * (1.0 - g));
        a *= mix(1.0, vis, aSched2.z);
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
  const worldGrowth = createSignal(0);    // объекты мира встают вокруг машины
  const cameraHeight = createSignal(0);   // отъезд: начат вместе с колонкой
  
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
      mat.uniforms.uCarLift.value = N_CAR / Math.max(1, N - gone);
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

      // Дыхание кадра (1.8% за восемь секунд) и начало отъезда — одним рычагом.
      placeCamera(breath(), cameraHeight());

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
  // 7.6  ТАКТ 3, шаг 1: камера начинает отходить, машина отдаёт пятую часть
  //      вещества, и справа от неё снизу вверх вырастает зарядная колонка
  yield* all(
    chain(breath(1, 7.6, linear), waitFor(DUR - 7.6)),
    (function* () {
      yield* waitFor(1.5);
      yield* all(
        dissolveCode(1, 1.9, easeInOutSine),
        chain(waitFor(1.4), assembleCar(1, 4.3, linear)),
      );
      yield* waitFor(0.4);
      // Отъезд и рост мира идут ОДНИМ движением: объект встаёт ровно тогда,
      // когда кадр под него открылся. Камера ведёт, мир заполняет.
      yield* all(
        cameraHeight(1, 15.5, easeInOutSine),
        chain(waitFor(0.5), worldGrowth(1, 14.0, linear)),
      );
      yield* waitFor(0.9);
    })(),
  );
});
