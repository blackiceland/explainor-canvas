// ── Редактор на мониторе: код интеграции, подсветка, темы, редакторы ────────
// Код на мониторах ЧИТАЕТСЯ (автор: «не нравится заблюренный монитор, пусть код
// будет видно»): крупный кегль, редактор прокручен к handle() — пять шагов
// обработчика (проверка, поиск устройства, отправка, сохранение, ответ; 1.1).
// У каждого из шести свой обработчик, своя тема, свой редактор и свои привычки
// (отступ 2 или 4, имена) — а пять шагов стоят на одних и тех же строках. Это и
// есть мысль монтажа: «спорили бы о форматировании — а куда смотреть, знаешь».
// ⚠️ Импорт paletteCanon тянет MC — цвета канона продублированы здесь.

export interface IdeTheme {
  bg: [string, string];            // верх и низ фона
  chrome: string;                  // полоса вкладок / боковые панели
  tab: string;                     // активная вкладка
  tabLine: string;                 // подчёркивание активной вкладки, акцент редактора
  tabText: string;
  gutter: string;                  // номера строк
  current: string;                 // подсветка текущей строки
  c: {kw: string; type: string; str: string; num: string; call: string; def: string; ink: string; punct: string; prop: string; comment: string};
  /** Экран светлый: светит сильнее и нейтральнее. */
  light?: boolean;
}

export const IDE_THEMES: Record<string, IdeTheme> = {
  // канон ролика: поднятый графит, холодные ключевые, тёплые методы
  canon: {
    bg: ['#15161A', '#1C1E24'], chrome: '#111215', tab: '#1A1B20', tabLine: '#FF8CA3', tabText: 'rgba(244,241,235,0.82)',
    gutter: 'rgba(244,241,235,0.22)', current: 'rgba(255,255,255,0.035)',
    c: {kw: '#A3CDFF', type: 'rgba(205,198,250,0.90)', str: '#94C086', num: '#A3CDFF', call: '#FFAEC0', def: '#FF8CA3',
      ink: 'rgba(244,241,235,0.96)', punct: 'rgba(244,241,235,0.58)', prop: '#85B0DC', comment: 'rgba(244,241,235,0.45)'},
  },
  // IntelliJ Light
  light: {
    bg: ['#FFFFFF', '#FBFBFC'], chrome: '#EBECF0', tab: '#FFFFFF', tabLine: '#3574F0', tabText: '#1E1F22',
    gutter: '#AEB3C2', current: '#FCFAED', light: true,
    c: {kw: '#0033B3', type: '#000000', str: '#067D17', num: '#1750EB', call: '#00627A', def: '#00627A',
      ink: '#080808', punct: '#080808', prop: '#871094', comment: '#8C8C8C'},
  },
  // Vim, gruvbox dark
  gruvbox: {
    bg: ['#282828', '#282828'], chrome: '#3C3836', tab: '#504945', tabLine: '#FABD2F', tabText: '#EBDBB2',
    gutter: '#7C6F64', current: '#32302F',
    c: {kw: '#FB4934', type: '#FABD2F', str: '#B8BB26', num: '#D3869B', call: '#8EC07C', def: '#8EC07C',
      ink: '#EBDBB2', punct: '#A89984', prop: '#83A598', comment: '#928374'},
  },
  // VS Code Dark+
  dark: {
    bg: ['#1E1E1E', '#1E1E1E'], chrome: '#252526', tab: '#1E1E1E', tabLine: '#0078D4', tabText: '#FFFFFF',
    gutter: '#858585', current: '#282828',
    c: {kw: '#569CD6', type: '#4EC9B0', str: '#CE9178', num: '#B5CEA8', call: '#DCDCAA', def: '#DCDCAA',
      ink: '#D4D4D4', punct: '#D4D4D4', prop: '#9CDCFE', comment: '#6A9955'},
  },
  // Solarized Light
  solarized: {
    bg: ['#FDF6E3', '#FDF6E3'], chrome: '#EEE8D5', tab: '#FDF6E3', tabLine: '#268BD2', tabText: '#586E75',
    gutter: '#93A1A1', current: '#EEE8D5', light: true,
    c: {kw: '#859900', type: '#B58900', str: '#2AA198', num: '#D33682', call: '#268BD2', def: '#268BD2',
      ink: '#657B83', punct: '#586E75', prop: '#6C71C4', comment: '#93A1A1'},
  },
  // Darcula
  darcula: {
    bg: ['#2B2B2B', '#2B2B2B'], chrome: '#3C3F41', tab: '#4E5254', tabLine: '#4A88C7', tabText: '#BBBBBB',
    gutter: '#606366', current: '#323232',
    c: {kw: '#CC7832', type: '#A9B7C6', str: '#6A8759', num: '#6897BB', call: '#FFC66D', def: '#FFC66D',
      ink: '#A9B7C6', punct: '#A9B7C6', prop: '#9876AA', comment: '#808080'},
  },
};

/** Какой это редактор: вкладки сверху (JetBrains), панель слева и мини-карта (VS Code), строка статуса (Vim). */
/** jetbrains / vscode / vim — редакторы людей; page — страница кода в каноне ролика
 *  (как в код-сценах: графит, без вкладок и номеров), код слева. */
export type IdeChrome = 'jetbrains' | 'vscode' | 'vim' | 'page';
/** Шрифт редактора: у каждого свой. */
export const IDE_FONTS: Record<IdeChrome, string> = {
  jetbrains: '"JetBrains Mono", monospace',
  vscode: '"Geist Mono", "JetBrains Mono", monospace',
  vim: '"IBM Plex Mono", "JetBrains Mono", monospace',
  page: '"JetBrains Mono", monospace',
};

type Kind = keyof IdeTheme['c'];
export type Tok = [string, Kind];

const KW = new Set(['class', 'private', 'val', 'var', 'override', 'suspend', 'fun', 'if', 'in', 'return', 'as', 'is', 'null',
  'true', 'false', 'object', 'interface', 'when', 'else', 'import', 'package', 'to', 'const']);

/** Простая раскраска Kotlin: строки, числа, ключевые, типы, вызовы, свойства. */
export function tokenize(line: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  let prevWord = '';
  const push = (s: string, k: Kind) => { if (s) out.push([s, k]); };
  while (i < line.length) {
    const ch = line[i];
    if (ch === ' ') { let j = i; while (line[j] === ' ') j++; push(line.slice(i, j), 'ink'); i = j; continue; }
    if (line.startsWith('//', i)) { push(line.slice(i), 'comment'); break; }
    if (ch === '"') { let j = i + 1; while (j < line.length && line[j] !== '"') j++; push(line.slice(i, j + 1), 'str'); i = j + 1; continue; }
    if (/[0-9]/.test(ch)) { let j = i; while (/[0-9_]/.test(line[j] ?? '') || (line[j] === '.' && /[0-9]/.test(line[j + 1] ?? ''))) j++; push(line.slice(i, j), 'num'); i = j; continue; }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i; while (/[A-Za-z0-9_]/.test(line[j] ?? '')) j++;
      const w = line.slice(i, j);
      const next = line.slice(j).trimStart()[0];
      const afterDot = out.length && out[out.length - 1][0].endsWith('.');
      let k: Kind = 'ink';
      if (KW.has(w)) k = 'kw';
      else if (prevWord === 'fun') k = 'def';
      else if (next === '(' || next === '{' && /^[a-z]/.test(w) && afterDot) k = /^[A-Z]/.test(w) ? 'type' : 'call';
      else if (/^[A-Z][A-Z0-9_]+$/.test(w)) k = 'prop';
      else if (/^[A-Z]/.test(w)) k = 'type';
      else if (afterDot) k = 'prop';
      push(w, k);
      prevWord = w;
      i = j;
      continue;
    }
    let j = i + 1;
    while (j < line.length && /[^\sA-Za-z0-9_"]/.test(line[j]) && !line.startsWith('//', j)) j++;
    push(line.slice(i, j), 'punct');
    i = j;
  }
  return out;
}

// ── Шесть обработчиков: одна форма, разные люди ─────────────────────────────
// Строки 13–15 — проверка, 17–18 — поиск устройства, 20–22 — отправка,
// 24–26 — сохранение, 28–29 — ответ. У всех одинаково (сценарий 1.1).
interface HandlerSpec {
  cls: string; cmd: string; metric: string; check: string; invalid: string;
  name: string; type: string; payload: string; copy: string; msg: string; logKey: string; ackField: string;
  /** Отступ: кто-то пишет в 2 пробела, кто-то в 4. */
  indent?: number;
}
function handler(h: HandlerSpec): string {
  const i1 = ' '.repeat(h.indent ?? 4), i2 = i1 + i1, i3 = i2 + i1;
  return [
    `class ${h.cls}(`,
    `${i1}private val devices: DeviceRepository,`,
    `${i1}private val gateway: DeviceGateway,`,
    `${i1}private val events: EventPublisher,`,
    `${i1}private val metrics: Metrics,`,
    `) : CommandHandler<${h.cmd}> {`,
    ``,
    `${i1}private val log = logger<${h.cls}>()`,
    ``,
    `${i1}override suspend fun handle(command: ${h.cmd}, caller: Caller): CommandResult {`,
    `${i2}metrics.increment("${h.metric}")`,
    ``,
    `${i2}if (${h.check}) {`,
    `${i3}return CommandResult.Invalid("${h.invalid}")`,
    `${i2}}`,
    ``,
    `${i2}val ${h.name} = devices.find(command.homeId, command.deviceId) as? ${h.type}`,
    `${i3}?: return CommandResult.NotFound("device \${command.deviceId} not found")`,
    ``,
    `${i2}val ack = withTimeoutOrNull(DEVICE_TIMEOUT) {`,
    `${i3}gateway.send(${h.name}.address, ${h.payload})`,
    `${i2}} ?: return CommandResult.DeviceUnavailable(${h.name}.id)`,
    ``,
    `${i2}val updated = ${h.name}.copy(${h.copy}, updatedAt = ack.receivedAt)`,
    `${i2}devices.save(updated)`,
    `${i2}events.publish(DeviceStateChanged(updated.id, updated.state()))`,
    ``,
    `${i2}log.info("${h.msg}", "device" to ${h.name}.id, "${h.logKey}" to ack.${h.ackField})`,
    `${i2}return CommandResult.Ok(updated.state())`,
    `${i1}}`,
    `}`,
  ].join('\n');
}

export const HANDLERS = {
  lamp: {file: 'SetLampBrightnessHandler.kt', code: handler({
    cls: 'SetLampBrightnessHandler', cmd: 'SetLampBrightness', metric: 'integration.lamp.set_brightness',
    check: 'command.brightness !in 0..100', invalid: 'brightness must be in 0..100', name: 'lamp', type: 'Lamp',
    payload: 'LampPayload.SetLevel(command.brightness)', copy: 'brightness = ack.level', msg: 'lamp brightness set', logKey: 'level', ackField: 'level'})},
  thermostat: {file: 'SetThermostatTargetHandler.kt', code: handler({
    cls: 'SetThermostatTargetHandler', cmd: 'SetThermostatTarget', metric: 'integration.thermostat.set_target',
    check: 'command.celsius !in 5.0..30.0', invalid: 'target must be in 5..30', name: 'thermostat', type: 'Thermostat',
    payload: 'ThermostatPayload.SetTarget(command.celsius)', copy: 'target = ack.target', msg: 'thermostat target set', logKey: 'target', ackField: 'target'})},
  lock: {file: 'LockDoorHandler.kt', code: handler({
    cls: 'LockDoorHandler', cmd: 'LockDoor', metric: 'integration.lock.lock_door', indent: 2,
    check: '!caller.canControl(command.homeId)', invalid: 'caller has no access to this home', name: 'lock', type: 'SmartLock',
    payload: 'LockPayload.Engage(command.pin)', copy: 'locked = ack.engaged', msg: 'door locked', logKey: 'engaged', ackField: 'engaged'})},
  blinds: {file: 'SetBlindsPositionHandler.kt', code: handler({
    cls: 'SetBlindsPositionHandler', cmd: 'SetBlindsPosition', metric: 'integration.blinds.set_position',
    check: 'command.percent !in 0..100', invalid: 'position must be in 0..100', name: 'dev', type: 'Blinds',
    payload: 'BlindsPayload.MoveTo(command.percent)', copy: 'position = ack.position', msg: 'blinds moved', logKey: 'position', ackField: 'position'})},
  speaker: {file: 'SetSpeakerVolumeHandler.kt', code: handler({
    cls: 'SetSpeakerVolumeHandler', cmd: 'SetSpeakerVolume', metric: 'integration.speaker.set_volume',
    check: 'command.volume !in 0..100', invalid: 'volume must be in 0..100', name: 'speaker', type: 'Speaker',
    payload: 'SpeakerPayload.SetVolume(command.volume)', copy: 'volume = ack.volume', msg: 'speaker volume set', logKey: 'volume', ackField: 'volume'})},
  camera: {file: 'ArmCameraHandler.kt', code: handler({
    cls: 'ArmCameraHandler', cmd: 'ArmCamera', metric: 'integration.camera.arm',
    check: 'command.sensitivity !in 1..10', invalid: 'sensitivity must be in 1..10', name: 'camera', type: 'Camera',
    payload: 'CameraPayload.Arm(command.sensitivity)', copy: 'armed = ack.armed', msg: 'camera armed', logKey: 'sensitivity', ackField: 'sensitivity'})},
};
/** Обработчик лампы из сценария (1.1). */
export const LAMP_HANDLER = HANDLERS.lamp.code;

export interface IdeOptions {
  file: string;
  code: string;
  /** Кегль кода, px холста. */
  font?: number;
  /** Строка с кареткой (1-based) — подсвечена как текущая. */
  current?: number;
  /** С какой строки (1-based) начинается видимая часть — редактор прокручен. */
  from?: number;
  chrome?: IdeChrome;
  /** Подсветка строк (1-based): канон проекта — полоска роуз 0.18 на всю ширину
   *  блока, высота 1.15 строки, углы острые; только строка, не блок. */
  stripes?: number[];
  /** Сила подсветки 0…1 (проявление). */
  stripeK?: number;
  /** Расфокус остальных строк, px холста (де-эмфазис — блюром, не затемнением). */
  defocus?: number;
}

export const STRIPE_COLOR = (k: number) => `rgba(255, 80, 120, ${(0.18 * k).toFixed(3)})`;

/** Доли экрана под код на странице: левый край и правый край блока (справа — дом). */
export const PAGE = {x0: 0.055, x1: 0.625};

/**
 * Страница кода в каноне ролика: графитовый градиент CanonBg, цвета Canon, без
 * вкладок и номеров строк. Код целиком, по вертикали — посередине; самая длинная
 * строка укладывается в левые PAGE.x1 ширины — правее потом встанет дом (автор).
 */
function drawCodePage(g: CanvasRenderingContext2D, W: number, H: number, t: IdeTheme, o: IdeOptions): void {
  const lines = o.code.split('\n');
  const widest = Math.max(...lines.map(l => l.length));
  const x0 = W * PAGE.x0, x1 = W * PAGE.x1;
  // кегль — по самой длинной строке: JetBrains Mono, знак = 0.6 кегля
  const FS = o.font ?? Math.floor((x1 - x0) / (widest * 0.6));
  const LH = Math.round(FS * 1.5);
  const y0 = Math.round((H - lines.length * LH) / 2);
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#15161A'); bg.addColorStop(1, '#1C1E24');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  if (o.stripes && (o.stripeK ?? 1) > 0) {
    // канон: на всю ширину блока кода, 1.15 строки, углы острые
    g.fillStyle = STRIPE_COLOR(o.stripeK ?? 1);
    for (const ln of o.stripes) {
      const cy = y0 + (ln - 1) * LH + LH / 2;
      g.fillRect(x0 - FS * 0.6, cy - LH * 0.575, x1 - x0 + FS * 1.2, LH * 1.15);
    }
  }
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.font = `500 ${FS}px ${IDE_FONTS.page}`;
  const cw = g.measureText('M').width;
  lines.forEach((ln, i) => {
    let col = 0;
    for (const [s, k] of tokenize(ln)) {
      g.fillStyle = t.c[k];
      g.fillText(s, x0 + col * cw, y0 + i * LH + LH / 2);
      col += s.length;
    }
  });
}

/** Нарисовать редактор на холсте экрана. Верх кода (Y0) у всех редакторов один —
 *  пять шагов на одних и тех же высотах. */
export function drawIde(g: CanvasRenderingContext2D, W: number, H: number, t: IdeTheme, o: IdeOptions): void {
  const chrome = o.chrome ?? 'jetbrains';
  if (chrome === 'page') { drawCodePage(g, W, H, t, o); return; }
  const face = IDE_FONTS[chrome];
  const FS = o.font ?? 17, LH = Math.round(FS * 1.5), TAB = 56, Y0 = TAB + 26;
  const LEFT = chrome === 'vscode' ? 64 : 0;          // панель действий VS Code
  const GUT = LEFT + 88, X0 = GUT + 28;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, t.bg[0]); bg.addColorStop(1, t.bg[1]);
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.textBaseline = 'middle';
  if (chrome === 'vim') {
    // строка буферов сверху и строка статуса снизу
    g.fillStyle = t.chrome; g.fillRect(0, 0, W, TAB);
    g.fillStyle = t.tab; g.fillRect(0, 0, 460, TAB);
    g.font = `600 22px ${face}`;
    g.fillStyle = t.tabText; g.textAlign = 'left';
    g.fillText(` 1 ${o.file} `, 18, TAB / 2 + 1);
    const SB = 52;
    g.fillStyle = t.chrome; g.fillRect(0, H - SB, W, SB);
    g.fillStyle = t.tabLine; g.fillRect(0, H - SB, 190, SB);
    g.fillStyle = t.bg[0]; g.font = `700 24px ${face}`;
    g.fillText(' NORMAL', 24, H - SB / 2);
    g.fillStyle = t.tabText; g.font = `500 22px ${face}`;
    g.fillText(`${o.file}   kotlin   utf-8`, 230, H - SB / 2);
  } else {
    // вкладки
    g.fillStyle = t.chrome; g.fillRect(0, 0, W, TAB);
    g.fillStyle = t.tab; g.fillRect(LEFT, 0, 560, TAB);
    g.fillStyle = t.tabLine;
    if (chrome === 'vscode') g.fillRect(LEFT, 0, 560, 3); else g.fillRect(LEFT, TAB - 3, 560, 3);
    g.font = `500 22px ${face}`;
    g.fillStyle = t.tabText; g.textAlign = 'left';
    g.fillText(o.file, LEFT + 28, TAB / 2 + 1);
    if (chrome === 'vscode') {
      g.fillStyle = t.chrome; g.fillRect(0, TAB, LEFT, H - TAB);
      g.fillStyle = t.gutter;
      for (let k = 0; k < 5; k++) g.fillRect(18, TAB + 30 + k * 64, 28, 28);
      g.fillStyle = t.tabLine; g.fillRect(0, H - 36, W, 36);          // строка статуса
    }
  }
  const from = (o.from ?? 1) - 1;
  const lines = o.code.split('\n').slice(from);
  if (o.current) { g.fillStyle = t.current; g.fillRect(LEFT, Y0 + (o.current - 1 - from) * LH, W - LEFT, LH); }
  // полоски — под текстом, на всю ширину блока кода
  if (o.stripes && (o.stripeK ?? 1) > 0) {
    g.fillStyle = STRIPE_COLOR(o.stripeK ?? 1);
    const right = chrome === 'vscode' ? W - 170 : W - 28;
    for (const ln of o.stripes) {
      const cy = Y0 + (ln - 1 - from) * LH + LH / 2;
      g.fillRect(GUT + 12, cy - LH * 0.575, right - GUT - 12, LH * 1.15);
    }
  }
  g.font = `500 ${FS}px ${face}`;
  const cw = g.measureText('M').width;
  const keep = new Set(o.stripes ?? []);
  lines.forEach((ln, i) => {
    const y = Y0 + i * LH + LH / 2;
    const blurred = (o.defocus ?? 0) > 0.05 && !keep.has(from + i + 1);
    g.filter = blurred ? `blur(${o.defocus!.toFixed(2)}px)` : 'none';
    g.textAlign = 'right';
    g.fillStyle = t.gutter;
    g.fillText(String(from + i + 1), GUT, y);
    g.textAlign = 'left';
    let col = 0;
    for (const [s, k] of tokenize(ln)) {
      g.fillStyle = t.c[k];
      g.fillText(s, X0 + col * cw, y);
      col += s.length;
    }
    g.filter = 'none';
    // мини-карта VS Code: строки кода штрихами справа
    if (chrome === 'vscode') {
      const mx = W - 150, my = TAB + 20 + (from + i) * 7;
      let mc = 0;
      for (const [s, k] of tokenize(ln)) {
        if (s.trim()) { g.fillStyle = t.c[k]; g.globalAlpha = 0.55; g.fillRect(mx + mc * 2.2, my, s.length * 2.2, 3); g.globalAlpha = 1; }
        mc += s.length;
      }
    }
  });
  if (chrome === 'vim') {
    // тильды после конца файла
    g.fillStyle = t.gutter; g.textAlign = 'left';
    for (let k = lines.length; Y0 + k * LH + LH < H - 56; k++) g.fillText('~', LEFT + 18, Y0 + k * LH + LH / 2);
  }
}
