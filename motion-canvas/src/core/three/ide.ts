// ── Редактор на мониторе: код интеграции, подсветка, темы ───────────────────
// Код на мониторах ЧИТАЕТСЯ (автор: «не нравится заблюренный монитор, пусть код
// будет видно»): крупный кегль, редактор прокручен к handle() — пять шагов
// обработчика (проверка, поиск устройства, отправка, сохранение, ответ; 1.1).
// У каждого своя тема и свой редактор, пять шагов — на одних и тех же высотах.
// ⚠️ Импорт paletteCanon тянет MC — цвета канона продублированы здесь.

export interface IdeTheme {
  bg: [string, string];            // верх и низ фона
  chrome: string;                  // полоса вкладок
  tab: string;                     // активная вкладка
  tabLine: string;                 // подчёркивание активной вкладки
  tabText: string;
  gutter: string;                  // номера строк
  current: string;                 // подсветка текущей строки
  c: {kw: string; type: string; str: string; num: string; call: string; def: string; ink: string; punct: string; prop: string; comment: string};
}

export const IDE_THEMES: Record<string, IdeTheme> = {
  // канон ролика: поднятый графит, холодные ключевые, тёплые методы
  canon: {
    bg: ['#15161A', '#1C1E24'], chrome: '#111215', tab: '#1A1B20', tabLine: '#FF8CA3', tabText: 'rgba(244,241,235,0.82)',
    gutter: 'rgba(244,241,235,0.22)', current: 'rgba(255,255,255,0.035)',
    c: {kw: '#A3CDFF', type: 'rgba(205,198,250,0.90)', str: '#94C086', num: '#A3CDFF', call: '#FFAEC0', def: '#FF8CA3',
      ink: 'rgba(244,241,235,0.96)', punct: 'rgba(244,241,235,0.58)', prop: '#85B0DC', comment: 'rgba(244,241,235,0.45)'},
  },
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
    if (/[0-9]/.test(ch)) { let j = i; while (/[0-9._]/.test(line[j] ?? '')) j++; push(line.slice(i, j), 'num'); i = j; continue; }
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

/** Обработчик лампы из сценария (1.1): пять шагов, отделены пустыми строками. */
export const LAMP_HANDLER = `class SetLampBrightnessHandler(
    private val devices: DeviceRepository,
    private val gateway: DeviceGateway,
    private val events: EventPublisher,
    private val metrics: Metrics,
) : CommandHandler<SetLampBrightness> {

    private val log = logger<SetLampBrightnessHandler>()

    override suspend fun handle(command: SetLampBrightness, caller: Caller): CommandResult {
        metrics.increment("integration.lamp.set_brightness")

        if (command.brightness !in 0..100) {
            return CommandResult.Invalid("brightness must be in 0..100")
        }

        val lamp = devices.find(command.homeId, command.deviceId) as? Lamp
            ?: return CommandResult.NotFound("device \${command.deviceId} not found")

        val ack = withTimeoutOrNull(DEVICE_TIMEOUT) {
            gateway.send(lamp.address, LampPayload.SetLevel(command.brightness))
        } ?: return CommandResult.DeviceUnavailable(lamp.id)

        val updated = lamp.copy(brightness = ack.level, updatedAt = ack.receivedAt)
        devices.save(updated)
        events.publish(DeviceStateChanged(updated.id, updated.state()))

        log.info("lamp brightness set", "device" to lamp.id, "level" to ack.level)
        return CommandResult.Ok(updated.state())
    }
}`;

export interface IdeOptions {
  file: string;
  code: string;
  /** Кегль кода, px холста. */
  font?: number;
  /** Строка с кареткой (1-based) — подсвечена как текущая. */
  current?: number;
  /** С какой строки (1-based) начинается видимая часть — редактор прокручен. */
  from?: number;
}

/** Нарисовать редактор на холсте экрана. */
export function drawIde(g: CanvasRenderingContext2D, W: number, H: number, t: IdeTheme, o: IdeOptions): void {
  const FS = o.font ?? 17, LH = Math.round(FS * 1.5), TAB = 56, GUT = 88, X0 = GUT + 28, Y0 = TAB + 26;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, t.bg[0]); bg.addColorStop(1, t.bg[1]);
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // вкладки
  g.fillStyle = t.chrome; g.fillRect(0, 0, W, TAB);
  g.fillStyle = t.tab; g.fillRect(0, 0, 520, TAB);
  g.fillStyle = t.tabLine; g.fillRect(0, TAB - 3, 520, 3);
  g.font = `500 22px "JetBrains Mono", monospace`;
  g.textBaseline = 'middle';
  g.fillStyle = t.tabText;
  g.fillText(o.file, 28, TAB / 2 + 1);
  const from = (o.from ?? 1) - 1;
  const lines = o.code.split('\n').slice(from);
  if (o.current) { g.fillStyle = t.current; g.fillRect(0, Y0 + (o.current - 1 - from) * LH, W, LH); }
  g.font = `500 ${FS}px "JetBrains Mono", monospace`;
  const cw = g.measureText('M').width;
  lines.forEach((ln, i) => {
    const y = Y0 + i * LH + LH / 2;
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
  });
}
