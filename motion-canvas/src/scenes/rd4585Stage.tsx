import {Line, Node, Rect, Txt} from '@motion-canvas/2d';
import {all, easeInCubic, easeOutCubic, easeInOutCubic, linear, ThreadGenerator} from '@motion-canvas/core';
import {Fonts} from '../core/theme';

// ─────────────────────────────────────────────────────────────────────────
// RD-4585 · СТЕНД
//
// Неподвижная часть сцены: коробки, труба origin, таблица, рельсы полос.
// Позиции фиксированы и НЕ меняются ни в одном акте — двигаются только
// конверты, ярлыки и карточки payload. Карта собирается в голове один раз.
//
// Нотация (объясняется в акте 0 и дальше соблюдается буквально):
//   • ВЕРХНЯЯ полоса — трафик В амо, всегда слева направо.
//   • НИЖНЯЯ полоса — трафик ИЗ амо, всегда справа налево.
//   • Сплошная цветная линия — данные (сообщения).
//   • Пунктир — управляющий контур: подключение, запросы к таблице.
//   • Цвет = личность симки. Вся задача про то, доезжает этот цвет до амо
//     или теряется по дороге.
// ─────────────────────────────────────────────────────────────────────────

export const MONO = Fonts.code;

export function A(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export const P = {
  ink: 'rgba(244,241,235,0.96)',
  soft: 'rgba(244,241,235,0.70)',
  dim: 'rgba(244,241,235,0.44)',
  faint: 'rgba(244,241,235,0.26)',
  hair: 'rgba(244,241,235,0.13)',
  panel: 'rgba(255,255,255,0.030)',
  panelEdge: 'rgba(255,255,255,0.10)',
  cardFill: 'rgba(11,12,16,0.94)',

  tb: '#A3CDFF',      // наша сторона: Pact, tb-*-srv
  amo: '#CDC6FA',     // сторона amoCRM: аккаунт, источники
  origin: '#F4F1EB',  // origin — один, кость, ни с чем не путать
  tbl: '#A2CDD6',     // whatsapp_sources — мост
  ctrl: '#9B93C7',    // управляющий контур (подключение)

  s501: '#8BD46A',    // симка 501 «Продажи»
  s502: '#FF9F43',    // симка 502 «Поддержка»
  s503: '#7A8296',    // симка 503 — ещё не подключена

  bad: '#FF4757',
  badSoft: '#FF6B7A',
  gone: 'rgba(244,241,235,0.20)',
} as const;

// ── ГЕОМЕТРИЯ ────────────────────────────────────────────────────────────
export const G = {
  eyebrowY: -510,
  captionY: 400,

  ctrlRowY: -435,     // полка управляющего контура (кабинет, tb-op-srv)
  ctrlBoxH: 62,
  laneToY: -320,      // полоса «в амо»  →
  laneFromY: -95,     // полоса «из амо» ←
  bandY: -207,        // полоса payload-карточек между полосами
  ctrlTrackY: 0,      // горизонтальный коридор управляющего контура
  lookupX: -620,      // вертикальный коридор запросов к таблице

  pactX: -790, pactW: 276, pactTop: -366, pactBot: -30,
  srvX: -450, srvW: 280, srvH: 76,
  cabinetX: -790, cabinetW: 276,
  opsrvX: -450, opsrvW: 280,

  originX: 330, originW: 56, originTop: -366, originBot: -30,

  amoX: 670, amoW: 460, amoTop: -380, amoBot: -20,

  tableX: -90, tableW: 1160, tableTop: 20, tableBot: 314,

  formulaX: 752, formulaY: 130,
};

// абсолютные x левых краёв колонок таблицы
export const COL = {
  tb: -640,
  amo: -480,
  ch: -300,
  name: -160,
  src: 290,
};

// удобные опорные точки для маршрутов
export const X = {
  pactR: G.pactX + G.pactW / 2,
  srvL: G.srvX - G.srvW / 2,
  srvR: G.srvX + G.srvW / 2,
  ctrlBypass: -270,
  originL: G.originX - G.originW / 2,
  originR: G.originX + G.originW / 2,
  amoL: G.amoX - G.amoW / 2,
};

// ── МЕЛКИЕ ФАБРИКИ ───────────────────────────────────────────────────────

export function txt(o: {
  t: string; x?: number; y?: number; size?: number; fill?: string;
  weight?: number; ls?: number; left?: boolean; right?: boolean; opacity?: number;
}): Txt {
  return new Txt({
    text: o.t,
    x: o.x ?? 0,
    y: o.y ?? 0,
    fontFamily: MONO,
    fontSize: o.size ?? 18,
    fontWeight: o.weight ?? 400,
    letterSpacing: o.ls ?? 0,
    fill: o.fill ?? P.ink,
    offset: o.left ? [-1, 0] : o.right ? [1, 0] : [0, 0],
    opacity: o.opacity ?? 1,
  });
}

export function panel(o: {
  x?: number; y?: number; w: number; h: number;
  stroke?: string; fill?: string; lw?: number; radius?: number; dash?: number[];
}): Rect {
  return new Rect({
    x: o.x ?? 0, y: o.y ?? 0, width: o.w, height: o.h,
    radius: o.radius ?? 10,
    fill: o.fill ?? P.panel,
    stroke: o.stroke ?? P.panelEdge,
    lineWidth: o.lw ?? 1.5,
    lineDash: o.dash,
  });
}

export function poly(pts: [number, number][], o: {
  color: string; lw?: number; dash?: number[]; arrow?: boolean; end?: number; radius?: number;
}): Line {
  return new Line({
    points: pts,
    stroke: o.color,
    lineWidth: o.lw ?? 2,
    lineDash: o.dash,
    endArrow: o.arrow ?? false,
    arrowSize: 11,
    end: o.end ?? 1,
    radius: o.radius ?? 12,
  });
}

// ── КОРОБКА СЕРВИСА ──────────────────────────────────────────────────────
export interface BoxHandle {
  node: Node; frame: Rect; title: Txt; sub: Txt;
}

export function makeBox(o: {
  x: number; y: number; w: number; h: number;
  title: string; sub?: string; color: string; dash?: boolean; titleSize?: number;
}): BoxHandle {
  const node = new Node({x: o.x, y: o.y});
  const frame = panel({
    w: o.w, h: o.h,
    stroke: A(o.color, 0.42),
    fill: A(o.color, 0.05),
    dash: o.dash ? [7, 7] : undefined,
  });
  const hasSub = !!o.sub;
  const title = txt({t: o.title, y: hasSub ? -13 : 0, size: o.titleSize ?? 21, fill: o.color, weight: 500});
  const sub = txt({t: o.sub ?? '', y: 16, size: 13.5, fill: P.dim});
  node.add(frame);
  node.add(title);
  node.add(sub);
  return {node, frame, title, sub};
}

// ── PACT + СИМКИ ─────────────────────────────────────────────────────────
export interface SimHandle {
  node: Node; frame: Rect; id: Txt; name: Txt; color: string; y: number;
}
export interface PactHandle {
  node: Node; frame: Rect; sims: SimHandle[];
}

export const SIM_DATA = [
  {id: '501', short: 'Продажи', name: 'Продажи +7 999 111-22-33', color: P.s501},
  {id: '502', short: 'Поддержка', name: 'Поддержка +7 999 111-22-44', color: P.s502},
  {id: '503', short: 'Логистика', name: 'Логистика +7 999 111-22-55', color: P.s503},
];

export function makePact(): PactHandle {
  const cy = (G.pactTop + G.pactBot) / 2;
  const h = G.pactBot - G.pactTop;
  const node = new Node({x: G.pactX, y: cy});
  const frame = panel({w: G.pactW, h, stroke: A(P.tb, 0.42), fill: A(P.tb, 0.05)});
  node.add(frame);
  node.add(txt({t: 'Pact', y: -h / 2 + 26, size: 21, fill: P.tb, weight: 500}));
  node.add(txt({t: 'подключения WhatsApp', y: -h / 2 + 50, size: 13, fill: P.dim}));

  const sims: SimHandle[] = [];
  const offs = [-72, 8, 88];
  const cw = G.pactW - 36;
  for (let i = 0; i < 3; i++) {
    const s = SIM_DATA[i];
    const g = new Node({y: offs[i]});
    const f = panel({w: cw, h: 62, radius: 8, stroke: A(s.color, 0.40), fill: A(s.color, 0.07)});
    const id = txt({t: s.id, x: -cw / 2 + 16, y: -13, size: 21, fill: s.color, weight: 600, left: true});
    const name = txt({t: s.name, x: -cw / 2 + 16, y: 14, size: 12.5, fill: P.dim, left: true});
    g.add(f);
    g.add(id);
    g.add(name);
    node.add(g);
    sims.push({node: g, frame: f, id, name, color: s.color, y: cy + offs[i]});
  }
  return {node, frame, sims};
}

// ── ORIGIN — одна труба ──────────────────────────────────────────────────
export interface OriginHandle {
  node: Node; pipe: Rect; label: Txt; code: Txt;
}

export function makeOrigin(): OriginHandle {
  const cy = (G.originTop + G.originBot) / 2;
  const h = G.originBot - G.originTop;
  const node = new Node({x: G.originX, y: cy});
  const pipe = new Rect({
    width: G.originW, height: h, radius: 6,
    fill: A(P.origin, 0.07), stroke: A(P.origin, 0.55), lineWidth: 2,
  });
  // подписи держим НАД трубой: под ней проходит коридор управляющего контура
  const label = txt({t: 'origin', y: -h / 2 - 48, size: 20, fill: P.origin, weight: 500});
  const code = txt({t: 'dev.whatsapp', y: -h / 2 - 24, size: 13.5, fill: P.dim});
  node.add(pipe);
  node.add(label);
  node.add(code);
  return {node, pipe, label, code};
}

// ── amoCRM + ИСТОЧНИКИ ───────────────────────────────────────────────────
export interface ChipHandle {
  node: Node; frame: Rect; name: Txt; meta: Txt; msg: Txt; y: number;
}
export interface AmoHandle {
  node: Node; frame: Rect;
  chips: ChipHandle[];
  inbox: Node; inboxRows: Txt[]; inboxNote: Txt; inboxY: number[];
}

export function makeAmo(): AmoHandle {
  const cy = (G.amoTop + G.amoBot) / 2;
  const h = G.amoBot - G.amoTop;
  const node = new Node({x: G.amoX, y: cy});
  const frame = panel({w: G.amoW, h, stroke: A(P.amo, 0.42), fill: A(P.amo, 0.05)});
  node.add(frame);
  node.add(txt({t: 'amoCRM · аккаунт 9f31', y: -h / 2 + 28, size: 19, fill: P.amo, weight: 500}));

  // «Один общий список» — состояние до релиза.
  const inbox = new Node({opacity: 0});
  const inboxRows: Txt[] = [];
  const rOffs = [-60, -4, 52];
  const rTexts = ['', '', ''];
  const iw = G.amoW - 56;
  for (let i = 0; i < 3; i++) {
    const r = new Node({y: rOffs[i]});
    r.add(panel({w: iw, h: 44, radius: 7, stroke: P.hair, fill: 'rgba(255,255,255,0.02)'}));
    const t = txt({t: rTexts[i], x: -iw / 2 + 16, size: 17, fill: P.soft, left: true});
    r.add(t);
    inbox.add(r);
    inboxRows.push(t);
  }
  const inboxNote = txt({t: 'источник не указан', y: 112, size: 14, fill: P.faint});
  inbox.add(inboxNote);
  node.add(inbox);

  // Источники — ярлыки на выходе из origin.
  const chips: ChipHandle[] = [];
  const cOffs = [-78, 14, 106];
  const cw = G.amoW - 46;
  for (let i = 0; i < 3; i++) {
    const g = new Node({y: cOffs[i], opacity: 0});
    const f = panel({w: cw, h: 74, radius: 9, stroke: A(P.amo, 0.40), fill: A(P.amo, 0.07)});
    const name = txt({t: '', x: -cw / 2 + 16, y: -18, size: 16, fill: P.amo, left: true});
    const meta = txt({t: '', x: -cw / 2 + 16, y: 5, size: 13, fill: P.dim, left: true});
    const msg = txt({t: '', x: -cw / 2 + 16, y: 25, size: 13, fill: P.faint, left: true, opacity: 0});
    g.add(f);
    g.add(name);
    g.add(meta);
    g.add(msg);
    node.add(g);
    chips.push({node: g, frame: f, name, meta, msg, y: cy + cOffs[i]});
  }
  return {node, frame, chips, inbox, inboxRows, inboxNote, inboxY: rOffs.map(o => cy + o)};
}

// ── ТАБЛИЦА whatsapp_sources — один объект на все акты ───────────────────
export interface RowHandle {
  node: Node; band: Rect; y: number;
  tb: Txt; amo: Txt; ch: Txt; name: Txt; src: Txt;
}
export interface TableHandle {
  node: Node; card: Rect; title: Txt; empty: Txt; head: Node; ghost: Txt; rows: RowHandle[];
}

export function makeTable(): TableHandle {
  const cy = (G.tableTop + G.tableBot) / 2;
  const h = G.tableBot - G.tableTop;
  const node = new Node({x: G.tableX, y: cy});
  const card = panel({
    w: G.tableW, h, stroke: A(P.tbl, 0.30), fill: A(P.tbl, 0.035), radius: 12, dash: [10, 10],
  });
  const left = -G.tableW / 2 + 30;
  const title = txt({t: 'whatsapp_sources', x: left, y: -h / 2 + 30, size: 20, fill: P.tbl, weight: 500, left: true});
  node.add(card);
  node.add(title);
  node.add(txt({t: 'связь: канал Pact ↔ источник amo', x: left + 246, y: -h / 2 + 31, size: 13.5, fill: P.dim, left: true}));

  // до сцены 3 таблицы ещё нет — рамка пунктиром и одна честная строка
  const ghost = txt({t: 'этой таблицы ещё нет — её добавляет эта задача', y: 12, size: 19, fill: P.faint});
  node.add(ghost);

  const head = new Node({opacity: 0});
  const headY = -h / 2 + 72;
  const heads: [number, string][] = [
    [COL.tb, 'tbAccountId'], [COL.amo, 'amoAccountId'], [COL.ch, 'channelId'],
    [COL.name, 'displayName'], [COL.src, 'sourceId'],
  ];
  for (const [x, t] of heads) {
    head.add(txt({t, x: x - G.tableX, y: headY, size: 13.5, fill: A(P.tbl, 0.75), left: true, ls: 0.5}));
  }
  head.add(new Rect({y: headY + 20, width: G.tableW - 60, height: 1, fill: P.hair}));
  node.add(head);

  const empty = txt({t: 'пусто', x: COL.tb - G.tableX, y: headY + 52, size: 17, fill: P.faint, left: true, opacity: 0});
  node.add(empty);

  const rows: RowHandle[] = [];
  const rOffs = [headY + 52, headY + 100, headY + 148];
  for (let i = 0; i < 3; i++) {
    const g = new Node({y: rOffs[i], opacity: 0});
    const band = new Rect({width: G.tableW - 60, height: 40, radius: 6, fill: 'rgba(0,0,0,0)'});
    g.add(band);
    const mk = (x: number) => {
      const t = txt({t: '', x: x - G.tableX, size: 18, fill: P.soft, left: true});
      g.add(t);
      return t;
    };
    rows.push({
      node: g, band, y: cy + rOffs[i],
      tb: mk(COL.tb), amo: mk(COL.amo), ch: mk(COL.ch), name: mk(COL.name), src: mk(COL.src),
    });
    node.add(g);
  }
  return {node, card, title, empty, head, ghost, rows};
}

// Сцена 3: таблица перестаёт быть призраком и становится настоящей.
export function* activateTable(t: TableHandle, dur = 0.5): ThreadGenerator {
  yield* t.ghost.opacity(0, dur * 0.5);
  t.card.lineDash([]);
  yield* all(
    t.card.stroke(A(P.tbl, 0.34), dur),
    t.card.fill(A(P.tbl, 0.045), dur),
    t.head.opacity(1, dur),
    t.empty.opacity(1, dur),
  );
}

export interface RowData {tb: string; amo: string; ch: string; name: string; src: string}

export function setRow(r: RowHandle, d: RowData) {
  r.tb.text(d.tb);
  r.amo.text(d.amo);
  r.ch.text(d.ch);
  r.name.text(d.name);
  r.src.text(d.src);
}

export function* showRow(r: RowHandle, dur = 0.5): ThreadGenerator {
  const y0 = r.node.y();
  r.node.y(y0 + 10);
  yield* all(
    r.node.opacity(1, dur, easeOutCubic),
    r.node.y(y0, dur, easeOutCubic),
  );
}

export function* bandOn(r: RowHandle, color: string, dur = 0.35): ThreadGenerator {
  yield* all(
    r.band.fill(A(color, 0.15), dur),
    r.tb.fill(P.ink, dur), r.amo.fill(P.ink, dur), r.ch.fill(color, dur),
    r.name.fill(P.ink, dur), r.src.fill(color, dur),
  );
}

export function* bandOff(r: RowHandle, dur = 0.35): ThreadGenerator {
  yield* all(
    r.band.fill('rgba(0,0,0,0)', dur),
    r.tb.fill(P.soft, dur), r.amo.fill(P.soft, dur), r.ch.fill(P.soft, dur),
    r.name.fill(P.soft, dur), r.src.fill(P.soft, dur),
  );
}

// ── КОНВЕРТ ──────────────────────────────────────────────────────────────
export interface EnvHandle {
  node: Node; body: Rect; flap: Line; label: Txt;
  tag: Node; tagFrame: Rect; tagTxt: Txt;
}

export function makeEnvelope(color: string, label: string, ghost = false): EnvHandle {
  const node = new Node({opacity: 0});
  const body = new Rect({
    width: 58, height: 40, radius: 5,
    fill: ghost ? 'rgba(0,0,0,0)' : A(color, 0.20),
    stroke: color, lineWidth: 2, lineDash: ghost ? [5, 5] : undefined,
  });
  const flap = new Line({
    points: [[-29, -20], [0, 3], [29, -20]],
    stroke: color, lineWidth: 2, lineDash: ghost ? [5, 5] : undefined,
  });
  const lbl = txt({t: label, y: 34, size: 16, fill: color});
  node.add(body);
  node.add(flap);
  node.add(lbl);

  const tag = new Node({y: -38, opacity: 0});
  const tagFrame = new Rect({width: 124, height: 26, radius: 13, fill: A(color, 0.22), stroke: color, lineWidth: 1.5});
  const tagTxt = txt({t: '', size: 14, fill: color, weight: 500});
  tag.add(tagFrame);
  tag.add(tagTxt);
  node.add(tag);

  return {node, body, flap, label: lbl, tag, tagFrame, tagTxt};
}

// Конверт меняет цвет целиком (тело, клапан, подпись).
export function* recolor(e: EnvHandle, color: string, dur = 0.4): ThreadGenerator {
  yield* all(
    e.body.fill(color === P.gone ? 'rgba(255,255,255,0.04)' : A(color, 0.20), dur),
    e.body.stroke(color, dur),
    e.flap.stroke(color, dur),
    e.label.fill(color, dur),
  );
}

// Полёт по ломаной: длительность делится пропорционально длине сегментов.
export function* fly(n: Node, pts: [number, number][], dur: number): ThreadGenerator {
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(d);
    total += d;
  }
  n.position(pts[0]);
  for (let i = 1; i < pts.length; i++) {
    const t = Math.max(0.1, (seg[i - 1] / Math.max(1, total)) * dur);
    // разгон на первом сегменте, ровно в середине, торможение на последнем
    const ease = pts.length === 2
      ? easeInOutCubic
      : i === 1 ? easeInCubic : i === pts.length - 1 ? easeOutCubic : linear;
    yield* n.position(pts[i], t, ease);
  }
}

// ── КАРТОЧКА PAYLOAD / ЗАМЕТКИ ───────────────────────────────────────────
//
// Motion Canvas схлопывает любые пробельные последовательности внутри Txt
// (и обычный пробел, и NBSP — регексп \s ловит оба), поэтому выравнивание
// «пробелами до колонки» не работает. Колонки задаются символом \t: сегмент
// после каждого \t ставится в позицию tabs[i], измеренную В СИМВОЛАХ моно-
// ширинного шрифта. Цвет можно задать посегментно через `cs`.
export interface CardLine {t: string; c?: string; cs?: (string | undefined)[]}
export interface CardHandle {
  node: Node; frame: Rect; lines: Txt[]; title: Txt;
}

const CH = 0.605;   // ширина знакоместа JetBrains Mono в долях кегля

export function makeCard(o: {
  x: number; y: number; lines: CardLine[];
  title?: string; size?: number; color?: string; minW?: number; pad?: number; tabs?: number[];
}): CardHandle {
  const fs = o.size ?? 16;
  const lh = fs * 1.55;
  const pad = o.pad ?? 18;
  const tabs = o.tabs ?? [];

  // ширина = самая правая точка среди всех сегментов всех строк
  const lineEnd = (l: CardLine): number => {
    const segs = l.t.split('\t');
    let max = 0;
    for (let i = 0; i < segs.length; i++) {
      const start = i === 0 ? 0 : tabs[i - 1] ?? 0;
      max = Math.max(max, start + segs[i].length);
    }
    return max * fs * CH;
  };
  const longest = Math.max(
    o.title ? o.title.length * 13.5 * 0.62 : 0,
    ...o.lines.map(lineEnd),
  );
  const w = Math.max(o.minW ?? 0, longest + pad * 2);
  const headH = o.title ? 28 : 0;
  const h = pad * 2 + headH + (o.lines.length - 1) * lh + fs + 4;

  const node = new Node({x: o.x, y: o.y, opacity: 0});
  const frame = new Rect({
    width: w, height: h, radius: 10,
    fill: P.cardFill,
    stroke: o.color ? A(o.color, 0.45) : 'rgba(255,255,255,0.14)',
    lineWidth: 1.5,
  });
  node.add(frame);

  const left = -w / 2 + pad;
  const top = -h / 2 + pad;
  const title = txt({t: o.title ?? '', x: left, y: top + 5, size: 13.5, fill: o.color ?? P.dim, left: true, ls: 1.4});
  if (o.title) node.add(title);

  // lines[i] — первый сегмент строки i (по нему меряют/перекрашивают акты)
  const lines: Txt[] = [];
  for (let i = 0; i < o.lines.length; i++) {
    const l = o.lines[i];
    const y = top + headH + fs / 2 + i * lh;
    const segs = l.t.split('\t');
    for (let j = 0; j < segs.length; j++) {
      if (!segs[j]) continue;
      const start = j === 0 ? 0 : tabs[j - 1] ?? 0;
      const t = txt({
        t: segs[j], x: left + start * fs * CH, y,
        size: fs, fill: l.cs?.[j] ?? l.c ?? P.soft, left: true,
      });
      node.add(t);
      if (j === 0) lines.push(t);
    }
    if (!segs[0]) lines.push(txt({t: '', x: left, y, size: fs}));
  }
  return {node, frame, lines, title};
}

export function* show(n: Node, dur = 0.35, dy = 8, to = 1): ThreadGenerator {
  const y0 = n.y();
  n.y(y0 + dy);
  yield* all(n.opacity(to, dur, easeOutCubic), n.y(y0, dur, easeOutCubic));
}

export function* hide(n: Node, dur = 0.3): ThreadGenerator {
  yield* n.opacity(0, dur);
}

// ── ФОРМУЛА external_id ──────────────────────────────────────────────────
export function makeFormula(): CardHandle {
  return makeCard({
    x: G.formulaX, y: G.formulaY, minW: 340, size: 16, pad: 18,
    title: 'external_id',
    color: P.tbl,
    lines: [
      {t: '"whatsapp_" + channelId', c: P.ink},
      {t: 'в таблице не хранится —', c: P.dim},
      {t: 'выводится из channelId', c: P.dim},
    ],
  });
}

// ── СБОРКА СТЕНДА ────────────────────────────────────────────────────────
export interface Stage {
  root: Node;
  rails: Node;
  cabinet: BoxHandle;
  opsrv: BoxHandle;
  pact: PactHandle;
  proc: BoxHandle;
  api: BoxHandle;
  origin: OriginHandle;
  amo: AmoHandle;
  table: TableHandle;
  formula: CardHandle;
  eyebrow: Txt;
  caption: Txt;
  fx: Node;                       // слой для конвертов, стрелок, карточек
  groups: Record<string, Node>;
}

export function buildStage(view: Node): Stage {
  const root = new Node({});
  view.add(root);

  // Рельсы полос — статичная разметка направлений.
  const rails = new Node({opacity: 0});
  for (const y of [G.laneToY, G.laneFromY]) {
    rails.add(new Line({points: [[X.srvR + 12, y], [X.originL - 12, y]], stroke: P.hair, lineWidth: 1.5}));
    rails.add(new Line({points: [[X.originR + 12, y], [X.amoL - 12, y]], stroke: P.hair, lineWidth: 1.5}));
  }
  rails.add(txt({t: 'В  АМО   →', x: 0, y: G.laneToY - 28, size: 15, fill: P.faint, ls: 2}));
  rails.add(txt({t: '←   ИЗ  АМО', x: 0, y: G.laneFromY - 28, size: 15, fill: P.faint, ls: 2}));
  root.add(rails);

  const cabinet = makeBox({
    x: G.cabinetX, y: G.ctrlRowY, w: G.cabinetW, h: G.ctrlBoxH,
    title: 'Кабинет TextBack', color: P.ctrl, dash: true, titleSize: 18,
  });
  const opsrv = makeBox({
    x: G.opsrvX, y: G.ctrlRowY, w: G.opsrvW, h: G.ctrlBoxH,
    title: 'tb-op-srv', color: P.ctrl, dash: true, titleSize: 19,
  });
  const pact = makePact();
  const proc = makeBox({
    x: G.srvX, y: G.laneToY, w: G.srvW, h: G.srvH,
    title: 'tb-amo-processor-srv', color: P.tb, sub: 'шлёт сообщения в амо', titleSize: 19,
  });
  const api = makeBox({
    x: G.srvX, y: G.laneFromY, w: G.srvW, h: G.srvH,
    title: 'tb-amo-api-srv', color: P.tb, sub: 'вебхуки из амо · подключение', titleSize: 19,
  });
  const origin = makeOrigin();
  const amo = makeAmo();
  const table = makeTable();
  const formula = makeFormula();

  for (const b of [cabinet, opsrv, proc, api]) root.add(b.node);
  root.add(pact.node);
  root.add(origin.node);
  root.add(amo.node);
  root.add(table.node);
  root.add(formula.node);

  const fx = new Node({});
  view.add(fx);

  const eyebrow = txt({t: '', x: -900, y: G.eyebrowY, size: 22, fill: P.dim, left: true, ls: 3.5, opacity: 0});
  const caption = txt({t: '', y: G.captionY, size: 29, fill: P.soft, opacity: 0});
  view.add(eyebrow);
  view.add(caption);

  const groups: Record<string, Node> = {
    rails, cabinet: cabinet.node, opsrv: opsrv.node, pact: pact.node,
    proc: proc.node, api: api.node, origin: origin.node, amo: amo.node,
    table: table.node, formula: formula.node,
  };
  for (const k of Object.keys(groups)) groups[k].opacity(0);

  return {root, rails, cabinet, opsrv, pact, proc, api, origin, amo, table, formula, eyebrow, caption, fx, groups};
}

// Фокус: перечисленные группы в полную силу, остальные приглушены.
// hidden — группы, которых в этом акте вообще нет в кадре.
export function* focus(
  s: Stage, keys: string[], o: {dur?: number; dim?: number; hidden?: string[]} = {},
): ThreadGenerator {
  const dur = o.dur ?? 0.45;
  const dim = o.dim ?? 0.22;
  const hidden = o.hidden ?? [];
  const anims: ThreadGenerator[] = [];
  for (const k of Object.keys(s.groups)) {
    const to = hidden.includes(k) ? 0 : keys.includes(k) ? 1 : dim;
    anims.push(s.groups[k].opacity(to, dur));
  }
  yield* all(...anims);
}
