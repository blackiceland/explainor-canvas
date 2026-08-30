import {blur, makeScene2D, Node} from '@motion-canvas/2d';
import {
  all,
  chain,
  createSignal,
  easeInOutCubic,
  easeInOutSine,
  easeOutCubic,
  easeOutQuint,
  waitFor,
} from '@motion-canvas/core';
import {
  ACESFilmicToneMapping,
  BackSide,
  Box3,
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShadowMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createThreeView} from '../core/three/ThreeCanvas';
import {Screen} from '../core/theme';
import {applyBackground} from '../core/utils';
import {Manticore} from '../core/code/components/Manticore';
import {buildCanonRules, CanonCodeTheme, paintCanonMethodCalls} from '../core/code/model/paletteCanon';

// Операторская демка. Автопарк стоит в кадре С САМОГО НАЧАЛА — глубоко в расфокусе,
// как задний план за героем. Ничто ниоткуда не появляется: мир цел с первого кадра.
// Два такта: резкое приближение к Honda e у стойки → отъезд с подъёмом, к концу
// которого задний план входит в фокус, а на своих местах проступают оба блока кода.
// Нижняя пара доходит до полной резкости, верхняя остаётся приглушённой: она фон.
// Камера за всю сцену не меняет ни азимут, ни объектив.
// Земли и тумана нет: всё стоит на графите applyBackground, тени ловит
// невидимый ShadowMaterial. Motion Canvas владеет временем, three — пространством.

const CAR_URL = '/honda_e.glb';
const POST_URL = '/charging_station.glb';
const VAN_URL = '/fedex_van.glb';

// Лицо стойки при rotation.y = 0 смотрит в +X.
const faceTo = (dx: number, dz: number) => Math.atan2(-dz, dx);
const D2R = Math.PI / 180;

// Полярная камера: азимут отсчитывается от +Z к +X.
function orbit(az: number, el: number, dist: number, t: Vector3): Vector3 {
  const ce = Math.cos(el);
  return new Vector3(
    t.x + Math.sin(az) * ce * dist,
    t.y + Math.sin(el) * dist,
    t.z + Math.cos(az) * ce * dist,
  );
}

// Съёмочный павильон для отражений (в кадре его нет — только в бликах кузова).
// Верх светлый, низ тёмный, тёплый ключевой софтбокс и холодный заполняющий:
// это даёт борту вертикальный перепад и линию горизонта.
function makeStudioEnv(): Scene {
  const env = new Scene();
  const wall = new Mesh(new BoxGeometry(), new MeshBasicMaterial({color: '#171B24', side: BackSide}));
  wall.scale.set(26, 16, 26);
  wall.position.set(0, 6, 0);
  env.add(wall);
  const ceil = new Mesh(new PlaneGeometry(24, 24), new MeshBasicMaterial({color: '#C3D2E8'}));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = 13.6; env.add(ceil);
  const floor = new Mesh(new PlaneGeometry(24, 24), new MeshBasicMaterial({color: '#080A0E'}));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.6; env.add(floor);
  const keyCard = new Mesh(new PlaneGeometry(9, 6), new MeshBasicMaterial({color: '#FFE9C8'}));
  keyCard.position.set(7.5, 7.0, 5.5); keyCard.lookAt(0, 1.2, 0); env.add(keyCard);
  const fillCard = new Mesh(new PlaneGeometry(7, 5), new MeshBasicMaterial({color: '#3E5A80'}));
  fillCard.position.set(-7.5, 4.5, -5.0); fillCard.lookAt(0, 1.2, 0); env.add(fillCard);
  return env;
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ── Общие утилиты ────────────────────────────────────────────────────────
  // Автокраска приходит зеркальной (roughness 0) — любой направленный источник
  // рисует жёсткую белую точку. Базу грубим, лак оставляем почти гладким.
  function dress(root: Object3D, minRough: number, coatRough = 0.07) {
    root.traverse((n: any) => {
      if (!n.isMesh) return;
      n.castShadow = true;
      n.receiveShadow = true;
      const m = n.material as MeshPhysicalMaterial;
      if (m.roughness !== undefined && m.roughness < minRough) m.roughness = minRough;
      if ((m as any).clearcoat > 0 && (m as any).clearcoatRoughness !== undefined) {
        (m as any).clearcoatRoughness = Math.max((m as any).clearcoatRoughness, coatRough);
      }
      // У CarPaintWhite нет baseColorFactor — по умолчанию glTF это альбедо 1.0,
      // физически невозможное даже для белой краски («виниры»). Сажаем в реальность.
      if (/CarPaint(White)?$/i.test(m.name || '') && m.color && !(m as any).map) {
        if (m.color.r > 0.95 && m.color.g > 0.95 && m.color.b > 0.95) {
          m.color.setRGB(0.845, 0.833, 0.808);
        }
      }
    });
  }
  function ground0(root: Object3D) {
    const b = new Box3().setFromObject(root);
    root.position.y -= b.min.y;
  }
  // Невидимая плоскость-приёмник тени: машины стоят прямо на графите фона,
  // но контактная тень остаётся — объект не висит.
  function shadowCatcher(): Mesh {
    const m = new Mesh(new PlaneGeometry(200, 200), new ShadowMaterial({opacity: 0.4}));
    m.rotation.x = -Math.PI / 2;
    m.receiveShadow = true;
    return m;
  }

  // ── Сцена героя ──────────────────────────────────────────────────────────
  const scene3 = new Scene();
  scene3.add(shadowCatcher());
  scene3.add(new HemisphereLight(0xa8c4ff, 0x141a26, 0.22));

  const key = new DirectionalLight(0xfff2e0, 1.25);
  key.position.set(6.5, 9.0, 5.0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.normalBias = 0.05;
  key.shadow.bias = -0.0004;
  const kc = key.shadow.camera;
  kc.left = -7; kc.right = 7; kc.top = 7; kc.bottom = -7; kc.near = 3; kc.far = 28;
  kc.updateProjectionMatrix();
  scene3.add(key);

  const rim = new DirectionalLight(0x9ec0ff, 0.8);
  rim.position.set(-7.0, 3.2, -6.0);
  scene3.add(rim);

  // ── Сцена депо (отдельная — у неё свой расфокус при материализации) ──────
  const sceneD = new Scene();
  sceneD.add(shadowCatcher());
  sceneD.add(new HemisphereLight(0xa8c4ff, 0x141a26, 0.22));

  const DEPOT_POS = new Vector3(-7.0, 0, -19.5);
  const keyD = new DirectionalLight(0xfff2e0, 1.25);
  keyD.position.copy(DEPOT_POS).add(new Vector3(6, 12, 7));
  keyD.target.position.copy(DEPOT_POS);
  keyD.castShadow = true;
  keyD.shadow.mapSize.set(2048, 2048);
  keyD.shadow.normalBias = 0.05;
  keyD.shadow.bias = -0.0004;
  const dcam = keyD.shadow.camera;
  dcam.left = -12; dcam.right = 12; dcam.top = 12; dcam.bottom = -12; dcam.near = 2; dcam.far = 55;
  dcam.updateProjectionMatrix();
  sceneD.add(keyD);
  sceneD.add(keyD.target);

  const rimD = new DirectionalLight(0x9ec0ff, 0.8);
  rimD.position.copy(DEPOT_POS).add(new Vector3(-7, 4, -7));
  sceneD.add(rimD);

  // ── Модели ───────────────────────────────────────────────────────────────
  const loader = new GLTFLoader();
  const carGltf = yield new Promise<any>((res, rej) => loader.load(CAR_URL, res, undefined, rej));
  const postGltf = yield new Promise<any>((res, rej) => loader.load(POST_URL, res, undefined, rej));
  const vanGltf = yield new Promise<any>((res, rej) => loader.load(VAN_URL, res, undefined, rej));

  const car = carGltf.scene as Object3D;
  dress(car, 0.26);
  car.position.set(0.55, 0, -0.20);
  // Тот же разворот, что у фургонов ряда 0 (депо повёрнуто на -31°): ракурс к
  // финальной камере совпадает — 46.2° против 44.6° у фургона.
  car.rotation.y = -31 * D2R;
  ground0(car);
  scene3.add(car);

  const post = postGltf.scene as Object3D;
  dress(post, 0.35);
  post.position.set(-1.95, 0, 0.85);
  post.rotation.y = faceTo(0.94, 0.34);   // лицом к машине и одновременно в камеру
  ground0(post);
  scene3.add(post);

  const postLit = createSignal(0);
  const postMats: MeshStandardMaterial[] = [];
  post.traverse((n: any) => {
    if (!n.isMesh) return;
    n.material = n.material.clone();
    n.material.emissive = new Color('#4ade80');
    n.material.emissiveIntensity = 0;
    postMats.push(n.material);
  });

  // Депо: раскладка ровно как в референсе S_mode_depot — два ряда носами к центру,
  // стойки островом по центральной оси спина к спине, каждая лицом к своему ряду.
  // Внутренняя геометрия не трогается вовсе; в кадр её ставит поворот всей группы:
  // камера смотрит с az 14°, референс смотрел с 45° → группа развёрнута на 14−45.
  // Позиция выверена проекцией (scratchpad/sweep.mjs): экранный бокс депо
  // 1009..1867 × 142..387 на обеих точках дрейфа — целиком в кадре.
  const depot = new Object3D();
  depot.position.copy(DEPOT_POS);
  depot.rotation.y = -31 * D2R;
  sceneD.add(depot);

  const depotLit = createSignal(1);
  const depotMats: MeshStandardMaterial[] = [];
  const vanSrc = vanGltf.scene as Object3D;
  const COLS = 3, SU = 3.3, ROW = 4.6, SPINE = 0.75;
  for (let i = 0; i < COLS * 2; i++) {
    const col = i % COLS, row = (i / COLS) | 0;
    const lx = (col - (COLS - 1) / 2) * SU;

    const v = vanSrc.clone(true);
    dress(v, 0.30);
    // r=0.5 у краски фургона не ловит окружение вовсе; лёгкий отблеск неба по
    // крыше, но герой остаётся заметно глянцевее — иерархия планов
    v.traverse((n: any) => {
      if (n.isMesh && !n.material.transparent && n.material.roughness > 0.45) n.material.roughness = 0.45;
    });
    v.position.set(lx, 0, row ? ROW : -ROW);
    v.rotation.y = row ? Math.PI : 0;      // нос к центральному острову
    const vb = new Box3().setFromObject(v);
    v.position.y = -vb.min.y;
    depot.add(v);

    const p = post.clone(true);
    p.position.set(lx, 0, row ? SPINE : -SPINE);
    p.rotation.y = faceTo(0, row ? 1 : -1);   // лицом к своему ряду
    p.traverse((n: any) => {
      if (!n.isMesh) return;
      n.material = n.material.clone();
      n.material.emissive = new Color('#4ade80');
      n.material.emissiveIntensity = 0;
      depotMats.push(n.material);
    });
    depot.add(p);
  }

  // ── Камера (одна на оба вьюпорта) ────────────────────────────────────────
  // Азимут и объектив постоянны — камера только отъезжает и поднимается.
  // Один жест, четыре канала на одной кривой, никакого доворота в конце.
  const AZ = 14 * D2R;
  const camera = new PerspectiveCamera(34, Screen.width / Screen.height, 0.1, 300);
  const camEl = createSignal(16 * D2R);
  const camDist = createSignal(10.5);
  const tgtX = createSignal(-0.62);
  const tgtY = createSignal(1.00);
  const tgtZ = createSignal(0.12);
  // Сдвиг точки прицеливания вдоль «вправо» камеры: двигает мир по кадру,
  // не трогая камеру — так левая колонна освобождается под код.
  const lookOff = createSignal(0);

  let envTex: any = null;
  function frame(renderer: WebGLRenderer, s: Scene) {
    if (!envTex) {
      const pm = new PMREMGenerator(renderer);
      envTex = pm.fromScene(makeStudioEnv(), 0.02).texture;
      scene3.environment = envTex;
      sceneD.environment = envTex;
      (scene3 as any).environmentIntensity = 0.9;
      (sceneD as any).environmentIntensity = 0.9;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFShadowMap;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.92;
    }
    for (const m of postMats) m.emissiveIntensity = postLit() * 3.4;
    for (const m of depotMats) m.emissiveIntensity = depotLit() * 3.4;

    const t = new Vector3(tgtX(), tgtY(), tgtZ());
    camera.position.copy(orbit(AZ, camEl(), camDist(), t));
    const off = lookOff();
    camera.lookAt(t.x + Math.cos(AZ) * off, t.y, t.z - Math.sin(AZ) * off);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(s, camera);
  }

  // Депо рисуется ПОД героем (узел добавлен раньше); у него свой блюр и своя
  // прозрачность — материализация тем же жестом расфокуса, что вход героя.
  const depotView = createThreeView({
    width: Screen.width, height: Screen.height, scene: sceneD, camera,
    onRender: r => frame(r, sceneD),
  });
  // Радиус держим малым относительно объекта: фургон на стартовом кадре ~147 px,
  // 7 это пять процентов его высоты. Больше — и просветы между машинами затекают,
  // ряд превращается в одно пятно; расфокус должен убирать фактуру, а не силуэт.
  const IN_BLUR_DEPOT = 7;
  const depShot = depotView.node;
  const depFocus = blur(IN_BLUR_DEPOT);
  depShot.opacity(0);
  depShot.filters([depFocus]);
  view.add(depShot);

  const mainView = createThreeView({
    width: Screen.width, height: Screen.height, scene: scene3, camera,
    onRender: r => frame(r, scene3),
  });
  const shot = mainView.node;
  const focus = blur(30);
  shot.opacity(0);
  shot.filters([focus]);
  view.add(shot);

  // ── Код: ДВА блока ───────────────────────────────────────────────────────
  // Каждый мир приносит свою функцию: сначала уличная (она уже в кадре),
  // потом — только после появления автопарка — фургонная. Так вторая читается
  // как почти-копия первой, и вилка «миры разные, код один» возникает у зрителя
  // сама, до того как мы её назовём.
  const CODE_PUBLIC = `fun startPublicSession(
    connector: Connector,
    driver: DriverId,
): Session {
    val session = Session.open(connector, driver)
    billing.authorize(session, PUBLIC_TARIFF)
    scheduler.stopAfter(session.id, 45.minutes)

    return session
}`;

  const CODE_FLEET = `fun startFleetSession(
    connector: Connector,
    vehicle: VehicleId,
): Session {
    val session = Session.open(connector, vehicle)
    billing.charge(session, FLEET_CONTRACT)
    scheduler.stopAfter(session.id, 8.hours)

    return session
}`;

  const CODE_FS = 27;
  // Каждый блок стоит НАПРОТИВ своего объекта, а не по порядку чтения:
  // депо сидит в кадре на y≈265 px, Хонда на y≈717 px — отсюда и центры блоков.
  // Порядок ПОЯВЛЕНИЯ при этом обратный: сначала нижний, уличный.
  const Y_FLEET = -275;                      // напротив автопарка
  const Y_PUBLIC = 177;                      // напротив Хонды

  // Код стоит на своём месте и не двигается вовсе: появление — только выход из блюра.
  const CODE_X = -448;
  const publicWrap = new Node({opacity: 0});
  const fleetWrap = new Node({opacity: 0});
  view.add(publicWrap);
  view.add(fleetWrap);

  const mkCode = (src: string, y: number, parent: Node) => {
    const m = Manticore.create(src, {
      x: CODE_X,
      y,
      width: 880,
      height: 0,
      fontSize: CODE_FS,
      theme: CanonCodeTheme,
      glowAccent: false,
      customTypes: ['Connector', 'DriverId', 'VehicleId', 'Session'],
      cardStyle: {fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)', radius: 0, edge: false},
    });
    m.mount(parent);
    m.colorize(buildCanonRules({
      types: ['Connector', 'DriverId', 'VehicleId', 'Session'],
      methods: ['startPublicSession', 'startFleetSession'],
      vars: ['connector', 'driver', 'vehicle', 'session', 'billing', 'scheduler'],
    }));
    paintCanonMethodCalls(m);
    return m;
  };

  const codeFleet = mkCode(CODE_FLEET, Y_FLEET, fleetWrap);
  const codePublic = mkCode(CODE_PUBLIC, Y_PUBLIC, publicWrap);
  // Manticore.mount ставит контейнеру opacity 0 — поднимаем, видимостью правит обёртка.
  codeFleet.node.opacity(1);
  codePublic.node.opacity(1);
  // Верхняя пара — фон разговора: и автопарк, и его код остаются под расфокусом с
  // частичной прозрачностью. Нижняя пара выходит в полную резкость.
  const DIM_OP = 0.45, DIM_BLUR = 4;
  const IN_BLUR = 8;                          // с чего начинают все трое
  const publicBlur = blur(IN_BLUR);
  const fleetBlur = blur(IN_BLUR);
  publicWrap.filters([publicBlur]);
  fleetWrap.filters([fleetBlur]);


  // ── Таймлайн ─────────────────────────────────────────────────────────────
  yield* waitFor(0.12);

  // Такт 1. Кадр открывается разом: герой выходит из расфокуса, автопарк уже стоит
  // за ним глубоким боке. Приближение короткое и резкое — 1.5 с на квинтике, то есть
  // бросок и мягкая посадка, а не плавный проезд.
  yield* all(
    shot.opacity(1, 0.5, easeOutCubic),
    depShot.opacity(DIM_OP, 0.5, easeOutCubic),
    focus.value(0, 1.25, easeOutCubic),
    camDist(5.70, 1.5, easeOutQuint),
    camEl(8.5 * D2R, 1.5, easeOutQuint),
    tgtX(-0.30, 1.5, easeOutQuint),
    tgtY(0.78, 1.5, easeOutQuint),
    tgtZ(0.00, 1.5, easeOutQuint),
  );
  yield* postLit(1, 0.7, easeOutCubic);
  yield* waitFor(0.5);

  // Такт 2. Отъезд с подъёмом. К концу его, когда кадр уже раскрылся, задний план
  // входит в фокус, а на своих местах проступают оба блока кода — одним моментом
  // и одним жестом. Ничто никуда не едет: только выход из размытия. Нижний блок
  // доходит до полной резкости, верхняя пара останавливается на приглушении.
  const APPEAR = 1.3;
  yield* all(
    camDist(17.0, 2.6, easeInOutCubic),
    camEl(22 * D2R, 2.6, easeInOutCubic),
    tgtX(0.62, 2.6, easeInOutCubic),
    tgtY(1.45, 2.6, easeInOutCubic),
    tgtZ(-1.2, 2.6, easeInOutCubic),
    lookOff(-5.6, 2.6, easeInOutCubic),
    chain(
      waitFor(1.9),
      all(
        publicWrap.opacity(1, APPEAR, easeOutCubic),
        publicBlur.value(0, APPEAR, easeOutCubic),
        fleetWrap.opacity(DIM_OP, APPEAR, easeOutCubic),
        fleetBlur.value(DIM_BLUR, APPEAR, easeOutCubic),
        depFocus.value(DIM_BLUR, APPEAR, easeOutCubic),
      ),
    ),
  );

  // Камера доехала и стоит. Никакого доворота.
  yield* waitFor(0.8);
});
