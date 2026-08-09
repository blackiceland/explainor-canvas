import {Line, Node, Rect, makeScene2D} from '@motion-canvas/2d';
import {all, chain, easeInOutCubic, easeOutCubic, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {
  A, activateTable, bandOff, bandOn, buildStage, CardHandle, CardLine, EnvHandle, focus, fly, G, hide,
  makeCard, makeEnvelope, P, panel, poly, recolor, RowData, setRow, show, showRow,
  SIM_DATA, txt, X,
} from './rd4585Stage';

// ─────────────────────────────────────────────────────────────────────────
// RD-4585 · ПОДКЛЮЧЕНИЕ НЕСКОЛЬКИХ WhatsApp-КАНАЛОВ К amoCRM ЧЕРЕЗ ИСТОЧНИКИ
//
// Сцена-объяснялка по раскадровке: 10 актов + акт 0 (карта и нотация).
// Смотреть: http://127.0.0.1:5173/play.html?scene=rd4585SceneRu
//
// Что она отвечает по порядку:
//   0  кто есть кто и как читать картинку
//   1  как работает сегодня — амо не различает симки
//   2  подключение, уровень 1: origin (один на весь продукт)
//   3  подключение, уровень 2: источники (по одному на симку)   ← ядро
//   4  сообщение в амо: lookup по таблице → ярлык → нужный источник
//   5  ответ из амо: external_id → channelId → та же симка
//   6  переподключение: источники пересоздаются, sourceId меняются
//   7  удаление интеграции: источники в амо остаются висеть
//   8  четыре ветки отказа, включая потерю сообщения
//   9  существующие клиенты: кого покрывает скрипт миграции
//  10  открытый вопрос: вариант А против варианта Б
// ─────────────────────────────────────────────────────────────────────────

// сквозные данные — ровно те, что в раскадровке
const TB = 'a1b2';
const AMO = '9f31';

const ROW: Record<string, RowData> = {
  r501: {tb: TB, amo: AMO, ch: '501', name: SIM_DATA[0].name, src: '84025'},
  r502: {tb: TB, amo: AMO, ch: '502', name: SIM_DATA[1].name, src: '84026'},
  r501b: {tb: TB, amo: AMO, ch: '501', name: SIM_DATA[0].name, src: '84031'},
  r502b: {tb: TB, amo: AMO, ch: '502', name: SIM_DATA[1].name, src: '84032'},
  r503b: {tb: TB, amo: AMO, ch: '503', name: SIM_DATA[2].name, src: '84033'},
};

// опорные точки маршрутов
const SIM_Y = [-270, -190, -110];
const PACT_X = G.pactX;
const CORR = G.lookupX;           // вертикальный коридор слева от сервисов
const LANE_TO = G.laneToY;
const LANE_FROM = G.laneFromY;
const PROC_X = G.srvX;
const API_X = G.srvX;
const ORIG_X = G.originX;
const AMO_X = G.amoX;
const CHIP_Y = [-278, -186, -94];
const INBOX_Y = [-260, -204, -148];
const RIGHT_CORR = 400;           // коридор между origin и amoCRM

// Конверт «обрабатывается сервисом» — ждёт у ближней грани коробки, а не
// поверх её подписи. Подсвечиваем рамку: работает именно этот сервис.
const DOCK_IN = X.srvL - 8;       // подход слева  (в амо)
const DOCK_OUT = X.srvR + 8;      // подход справа (из амо)

export default makeScene2D(function* (view) {
  applyBackground(view);
  const s = buildStage(view);
  // симка 503 появляется только в акте 6 — до него её в Pact нет
  s.pact.sims[2].node.opacity(0);

  // ── общие помощники ────────────────────────────────────────────────────
  function* eyebrow(t: string) {
    yield* s.eyebrow.opacity(0, 0.18);
    s.eyebrow.text(t);
    yield* s.eyebrow.opacity(0.9, 0.22);
  }

  function* say(t: string, hold = 1.5) {
    if (s.caption.opacity() > 0.01) yield* s.caption.opacity(0, 0.2);
    s.caption.text(t);
    yield* s.caption.opacity(1, 0.3);
    yield* waitFor(hold);
  }

  function* mute() {
    if (s.caption.opacity() > 0.01) yield* s.caption.opacity(0, 0.25);
  }

  function bandCard(
    lines: CardLine[],
    o: {title?: string; size?: number; color?: string; tabs?: number[]} = {},
  ): CardHandle {
    const c = makeCard({
      x: 0, y: G.bandY, lines, size: o.size ?? 16, title: o.title, color: o.color, tabs: o.tabs,
    });
    s.fx.add(c.node);
    return c;
  }

  function* drop(c: CardHandle | undefined, dur = 0.28) {
    if (!c) return;
    yield* hide(c.node, dur);
    c.node.remove();
  }

  function wire(pts: [number, number][], color: string, dash = true): Line {
    const l = poly(pts, {color, dash: dash ? [7, 7] : undefined, arrow: true, lw: 2, end: 0});
    s.fx.add(l);
    return l;
  }

  function* draw(l: Line, dur = 0.5) {
    yield* l.end(1, dur, easeInOutCubic);
  }

  function* erase(l: Line, dur = 0.3) {
    yield* l.opacity(0, dur);
    l.remove();
  }

  // Конверт создаётся СРАЗУ в точке старта: иначе он на четверть секунды
  // проявляется в центре кадра (позицию задаёт только fly).
  function env(i: number, label: string, at: [number, number], ghost = false): EnvHandle {
    const e = makeEnvelope(SIM_DATA[i].color, label, ghost);
    e.node.position(at);
    s.fx.add(e.node);
    return e;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // АКТ 0 — карта и нотация
  // ═══════════════════════════════════════════════════════════════════════
  const title = makeCard({
    x: 0, y: -40, size: 26, pad: 26,
    lines: [
      {t: 'RD-4585', c: P.tbl},
      {t: 'несколько WhatsApp-каналов в amoCRM', c: P.ink},
      {t: 'через источники', c: P.ink},
    ],
  });
  title.frame.fill('rgba(0,0,0,0)');
  title.frame.stroke('rgba(0,0,0,0)');
  s.fx.add(title.node);
  yield* show(title.node, 0.7, 14);
  yield* waitFor(1.6);
  yield* drop(title, 0.5);

  yield* eyebrow('СЦЕНА 0 / 10   ·   КТО ЕСТЬ КТО');

  // коробки проявляются по одной, каждая со своей репликой
  const intro: [string, string][] = [
    ['pact', 'Pact держит подключения WhatsApp. Симка = канал с channelId и именем'],
    ['proc', 'tb-amo-processor-srv отправляет сообщения в амо'],
    ['api', 'tb-amo-api-srv принимает вебхуки из амо и обрабатывает подключение'],
    ['origin', 'origin — канал чата TextBack внутри амо. ОДИН на весь продукт'],
    ['amo', 'источники живут внутри аккаунта клиента и привязаны к origin'],
    ['table', 'whatsapp_sources — новая таблица: канал Pact ↔ источник амо'],
  ];
  for (const [key, line] of intro) {
    yield* all(s.groups[key].opacity(1, 0.45, easeOutCubic), say(line, 1.25));
  }
  yield* mute();

  // сразу показать три источника, чтобы «origin один — источников много»
  // читалось геометрически, а не на словах
  s.amo.chips[0].name.text(SIM_DATA[0].name);
  s.amo.chips[0].meta.text('id 84025 · whatsapp_501');
  s.amo.chips[1].name.text(SIM_DATA[1].name);
  s.amo.chips[1].meta.text('id 84026 · whatsapp_502');
  yield* all(
    s.amo.chips[0].node.opacity(1, 0.4),
    chain(waitFor(0.12), s.amo.chips[1].node.opacity(1, 0.4)),
  );
  yield* say('origin один — источников много. Их нельзя путать', 1.5);
  yield* all(s.amo.chips[0].node.opacity(0, 0.35), s.amo.chips[1].node.opacity(0, 0.35));

  // нотация полос
  yield* all(s.rails.opacity(1, 0.5), say('верхняя полоса — в амо, нижняя — из амо. Направление не смешивается', 1.6));

  const legend = makeCard({
    x: 0, y: G.bandY, size: 15, color: P.ctrl,
    lines: [
      {t: '——————   данные: сообщение летит по полосе', c: P.soft},
      {t: '- - - - -   управляющий контур: подключение, запрос к таблице', c: P.ctrl},
      {t: 'цвет  =  личность симки. Задача — довезти цвет до амо', c: P.ink},
    ],
  });
  s.fx.add(legend.node);
  yield* show(legend.node, 0.4);
  yield* waitFor(2.4);
  yield* all(drop(legend), mute());

  // ═══════════════════════════════════════════════════════════════════════
  // АКТ 1 — как работает сегодня
  // ═══════════════════════════════════════════════════════════════════════
  yield* all(
    eyebrow('СЦЕНА 1 / 10   ·   КАК РАБОТАЕТ СЕГОДНЯ'),
    focus(s, ['rails', 'pact', 'proc', 'origin', 'amo'], {hidden: ['formula', 'cabinet', 'opsrv']}),
  );
  yield* all(s.groups.table.opacity(0.5, 0.35), s.amo.inbox.opacity(1, 0.4));

  const p1 = bandCard([
    {t: '{ "text": "Здравствуйте",', c: P.soft},
    {t: ' "receiver": { … } }', c: P.soft},
    {t: ' "source": …\t← этого поля нет', c: P.badSoft},
  ], {title: 'PAYLOAD  ·  СЕГОДНЯ', tabs: [18]});
  yield* show(p1.node, 0.4);

  // перечёркиваем несуществующее поле
  const strikeY = p1.lines[2].y();
  const strikeX = p1.lines[2].x();
  const strike = new Line({
    points: [[strikeX - 4, strikeY], [strikeX + 13 * 16 * 0.605, strikeY]],
    stroke: P.bad, lineWidth: 2, end: 0,
  });
  p1.node.add(strike);
  yield* strike.end(1, 0.4);

  for (const i of [0, 1]) {
    const e = env(i, i === 0 ? 'Здравствуйте' : 'Где заказ?', [PACT_X, SIM_Y[i]]);
    yield* show(e.node, 0.25, 0);
    yield* fly(e.node, [
      [PACT_X, SIM_Y[i]], [CORR, SIM_Y[i]], [CORR, LANE_TO], [PROC_X, LANE_TO], [ORIG_X, LANE_TO],
    ], 1.5);
    // на выходе из трубы цвет теряется — амо получает безликое сообщение
    yield* all(
      fly(e.node, [[ORIG_X, LANE_TO], [AMO_X, INBOX_Y[i]]], 0.9),
      recolor(e, P.gone, 0.7),
      e.label.opacity(0, 0.6),
    );
    s.amo.inboxRows[i].text(i === 0 ? 'Здравствуйте' : 'Где заказ?');
    yield* all(hide(e.node, 0.25), s.amo.inboxRows[i].opacity(1, 0.3));
    e.node.remove();
  }

  yield* say('амо не знает, с какого номера пришло сообщение', 2.0);
  yield* all(drop(p1), mute());

  // ═══════════════════════════════════════════════════════════════════════
  // АКТ 2 — подключение, уровень 1: origin
  // ═══════════════════════════════════════════════════════════════════════
  yield* all(
    eyebrow('СЦЕНА 2 / 10   ·   ПОДКЛЮЧЕНИЕ: ORIGIN'),
    s.amo.inbox.opacity(0, 0.4),
    focus(s, ['cabinet', 'opsrv', 'api', 'origin', 'amo'], {hidden: ['formula']}),
  );
  yield* s.groups.table.opacity(0.5, 0.3);

  const w1 = wire([[X.pactR + 4, G.ctrlRowY], [X.srvL - 6, G.ctrlRowY]], P.ctrl);
  yield* draw(w1, 0.4);
  const c2a = bandCard([{t: 'клиент нажимает «подключить amoCRM»  →  POST /integrations', c: P.ink}]);
  yield* show(c2a.node, 0.35);
  yield* waitFor(1.0);

  const w2 = wire([[X.srvR + 4, G.ctrlRowY], [X.ctrlBypass, G.ctrlRowY], [X.ctrlBypass, LANE_FROM], [X.srvR + 6, LANE_FROM]], P.ctrl);
  yield* all(draw(w2, 0.7), drop(c2a));
  const c2b = bandCard([
    {t: 'tb-op-srv создаёт запись amo_accounts', c: P.soft},
    {t: 'и зовёт  POST /amo/connect/a1b2', c: P.ink},
  ]);
  yield* show(c2b.node, 0.35);
  yield* waitFor(1.3);

  const w3 = wire([[API_X, -57], [API_X, G.ctrlTrackY], [ORIG_X, G.ctrlTrackY], [ORIG_X, G.originBot + 4]], P.ctrl);
  yield* all(draw(w3, 0.8), drop(c2b));
  const c2c = bandCard([
    {t: 'в амо уходят id и secret канала чата — из конфига сервиса,', c: P.soft},
    {t: 'один и тот же для всех клиентов', c: P.ink},
  ]);
  yield* all(show(c2c.node, 0.35), s.origin.pipe.stroke(P.origin, 0.5), s.origin.pipe.lineWidth(3, 0.5));

  const originLink = poly([[X.originR + 6, -200], [X.amoL - 6, -200]], {color: A(P.origin, 0.55), lw: 2, arrow: true, end: 0});
  s.fx.add(originLink);
  yield* draw(originLink, 0.5);
  yield* waitFor(1.0);

  yield* say('origin подключён. Амо готово принимать сообщения, но симки не различает', 2.0);
  yield* all(drop(c2c), erase(w1), erase(w2), erase(w3), mute());

  // ═══════════════════════════════════════════════════════════════════════
  // АКТ 3 — подключение, уровень 2: источники (ядро задачи)
  // ═══════════════════════════════════════════════════════════════════════
  yield* all(
    eyebrow('СЦЕНА 3 / 10   ·   ПОДКЛЮЧЕНИЕ: ИСТОЧНИКИ'),
    focus(s, ['pact', 'api', 'origin', 'amo', 'table'], {hidden: ['formula', 'cabinet', 'opsrv', 'rails']}),
  );
  yield* activateTable(s.table, 0.5);

  const w4 = wire([[X.srvL - 4, LANE_FROM], [X.pactR + 6, LANE_FROM]], P.ctrl);
  yield* draw(w4, 0.4);
  const c3a = bandCard([{t: 'какие каналы у клиента a1b2 ?', c: P.ink}]);
  yield* show(c3a.node, 0.3);
  yield* waitFor(0.9);

  yield* drop(c3a);
  const c3b = bandCard([
    {t: '501\tПродажи +7 999 111-22-33', c: P.s501},
    {t: '502\tПоддержка +7 999 111-22-44', c: P.s502},
  ], {title: 'PACT ОТВЕЧАЕТ', tabs: [7]});
  yield* all(show(c3b.node, 0.35), s.pact.sims[0].frame.lineWidth(2.5, 0.3), s.pact.sims[1].frame.lineWidth(2.5, 0.3));
  yield* waitFor(1.5);
  yield* all(drop(c3b), erase(w4), s.pact.sims[0].frame.lineWidth(1.5, 0.3), s.pact.sims[1].frame.lineWidth(1.5, 0.3));

  const w5 = wire([[API_X, -57], [API_X, G.ctrlTrackY], [AMO_X, G.ctrlTrackY], [AMO_X, G.amoBot + 4]], P.ctrl);
  const c3c = bandCard([
    {t: 'POST /api/v4/sources\t\tодин запрос, два элемента', cs: [P.ink, undefined, P.dim]},
    {t: ' name\t"Продажи +7 999 111-22-33"', c: P.soft},
    {t: ' external_id\t"whatsapp_501"\t← мост', cs: [P.tbl, P.tbl, P.tbl]},
    {t: ' origin_code\t"dev.whatsapp"\t← один на весь продукт', cs: [P.origin, P.origin, P.origin]},
  ], {size: 15.5, tabs: [15, 36]});
  yield* all(draw(w5, 0.8), show(c3c.node, 0.4));
  yield* waitFor(2.4);

  // источники вырастают рядом с origin
  s.amo.chips[0].name.text(SIM_DATA[0].name);
  s.amo.chips[0].meta.text('id 84025 · whatsapp_501');
  s.amo.chips[1].name.text(SIM_DATA[1].name);
  s.amo.chips[1].meta.text('id 84026 · whatsapp_502');
  yield* all(
    show(s.amo.chips[0].node, 0.45, 10),
    chain(waitFor(0.15), show(s.amo.chips[1].node, 0.45, 10)),
    drop(c3c),
  );

  const c3d = bandCard([
    {t: '[ { "id": 84025, "external_id": "whatsapp_501" },', c: P.amo},
    {t: '  { "id": 84026, "external_id": "whatsapp_502" } ]', c: P.amo},
  ], {title: 'АМО ВОЗВРАЩАЕТ ID'});
  yield* show(c3d.node, 0.35);
  yield* waitFor(1.6);

  // строки записываются в таблицу
  yield* s.table.empty.opacity(0, 0.25);
  setRow(s.table.rows[0], ROW.r501);
  setRow(s.table.rows[1], ROW.r502);
  yield* showRow(s.table.rows[0], 0.45);
  yield* showRow(s.table.rows[1], 0.45);
  yield* all(drop(c3d), erase(w5));

  // мост: одно и то же значение светится в трёх местах сразу
  yield* show(s.formula.node, 0.4);
  yield* waitFor(0.6);
  yield* all(
    bandOn(s.table.rows[0], P.s501, 0.4),
    s.pact.sims[0].frame.stroke(P.s501, 0.4),
    s.pact.sims[0].frame.lineWidth(2.5, 0.4),
    s.amo.chips[0].frame.stroke(P.s501, 0.4),
    s.amo.chips[0].meta.fill(P.s501, 0.4),
    say('external_id = whatsapp_501 связывает симку, строку и источник', 2.2),
  );
  yield* all(
    bandOff(s.table.rows[0], 0.4),
    s.pact.sims[0].frame.stroke(A(P.s501, 0.4), 0.4),
    s.pact.sims[0].frame.lineWidth(1.5, 0.4),
    s.amo.chips[0].frame.stroke(A(P.amo, 0.4), 0.4),
    s.amo.chips[0].meta.fill(P.dim, 0.4),
  );
  yield* say('каждая симка получила свой источник', 1.6);
  yield* mute();

  // ═══════════════════════════════════════════════════════════════════════
  // АКТ 4 — сообщение идёт В АМО
  // ═══════════════════════════════════════════════════════════════════════
  yield* all(
    eyebrow('СЦЕНА 4 / 10   ·   СООБЩЕНИЕ  →  В АМО'),
    focus(s, ['rails', 'pact', 'proc', 'origin', 'amo', 'table'], {hidden: ['cabinet', 'opsrv', 'formula']}),
  );

  const lookupWire = wire([[X.srvL - 4, LANE_TO], [CORR, LANE_TO], [CORR, G.tableTop - 4]], P.tbl);

  for (const i of [0, 1]) {
    const e = env(i, i === 0 ? 'Здравствуйте' : 'Где заказ?', [PACT_X, SIM_Y[i]]);
    yield* show(e.node, 0.25, 0);
    yield* fly(e.node, [[PACT_X, SIM_Y[i]], [CORR, SIM_Y[i]], [CORR, LANE_TO], [DOCK_IN, LANE_TO]], 1.0);
    yield* s.proc.frame.stroke(P.tb, 0.25);

    // запрос к таблице
    lookupWire.end(0);
    lookupWire.opacity(1);
    const look = bandCard([
      {t: `lookup (tbAccountId = ${TB}, channelId = ${SIM_DATA[i].id})`, c: P.soft},
      {t: `\t→  sourceId ${i === 0 ? '84025' : '84026'}`, c: P.tbl},
    ], {size: 17, tabs: [8]});
    yield* all(draw(lookupWire, 0.5), show(look.node, 0.35), bandOn(s.table.rows[i], SIM_DATA[i].color, 0.4));
    yield* waitFor(1.2);

    // ярлык налипает на конверт (текст сообщения теперь виден в payload —
    // собственную подпись конверта гасим, чтобы не лезла на коробку)
    e.tagTxt.text(`whatsapp_${SIM_DATA[i].id}`);
    yield* all(show(e.tag, 0.35, 6), e.label.opacity(0, 0.3), drop(look));

    const p4 = bandCard([
      {t: `{ "text": "${i === 0 ? 'Здравствуйте' : 'Где заказ?'}",`, c: P.soft},
      {t: ` "source": { "type": "widget", "external_id": "whatsapp_${SIM_DATA[i].id}" } }`, c: SIM_DATA[i].color},
    ], {size: 14.5, title: 'PAYLOAD  ·  ПОСЛЕ РЕЛИЗА'});
    yield* show(p4.node, 0.35);

    // цвет доезжает до амо
    yield* all(
      fly(e.node, [[DOCK_IN, LANE_TO], [ORIG_X, LANE_TO], [AMO_X, CHIP_Y[i]]], 1.6),
      s.proc.frame.stroke(A(P.tb, 0.42), 0.4),
    );
    s.amo.chips[i].msg.text(i === 0 ? '«Здравствуйте»' : '«Где заказ?»');
    yield* all(
      hide(e.node, 0.3),
      s.amo.chips[i].frame.stroke(SIM_DATA[i].color, 0.4),
      s.amo.chips[i].frame.fill(A(SIM_DATA[i].color, 0.10), 0.4),
      s.amo.chips[i].msg.opacity(1, 0.4),
    );
    e.node.remove();
    yield* waitFor(0.9);
    yield* all(drop(p4), bandOff(s.table.rows[i], 0.35), lookupWire.opacity(0, 0.3));
  }

  yield* say('origin общий — различает только source', 2.0);
  yield* mute();

  // ═══════════════════════════════════════════════════════════════════════
  // АКТ 5 — ответ идёт ИЗ АМО
  // ═══════════════════════════════════════════════════════════════════════
  yield* all(
    eyebrow('СЦЕНА 5 / 10   ·   ОТВЕТ  ←  ИЗ АМО'),
    focus(s, ['rails', 'pact', 'api', 'origin', 'amo', 'table'], {hidden: ['cabinet', 'opsrv', 'formula', 'proc']}),
  );

  yield* all(
    s.amo.chips[0].frame.lineWidth(2.5, 0.35),
    say('менеджер отвечает в беседе под источником «Продажи»', 1.3),
  );
  yield* mute();

  const e5 = env(0, 'Ответ', [AMO_X, CHIP_Y[0]]);
  yield* all(show(e5.node, 0.3, 0), s.amo.chips[0].frame.lineWidth(1.5, 0.3));

  const p5 = bandCard([
    {t: '{ "message": { "source": { "external_id": "whatsapp_501" } } }', c: P.s501},
  ], {size: 15, title: 'ВЕБХУК ИЗ АМО'});
  yield* all(
    fly(e5.node, [[AMO_X, CHIP_Y[0]], [RIGHT_CORR, CHIP_Y[0]], [RIGHT_CORR, LANE_FROM], [ORIG_X, LANE_FROM], [DOCK_OUT, LANE_FROM]], 2.0),
    chain(waitFor(0.4), show(p5.node, 0.35)),
  );
  yield* all(s.api.frame.stroke(P.tb, 0.25), e5.label.opacity(0, 0.25));

  yield* drop(p5);
  const parse = bandCard([
    {t: '"whatsapp_501"  →  префикс whatsapp_  →  channelId = 501', c: P.ink},
    {t: `проверка строки (${TB}, 501)  →  найдена`, c: P.s501},
  ], {size: 15.5, title: 'РАЗБОР В tb-amo-api-srv'});
  lookupWire.points([[X.srvL - 4, LANE_FROM], [CORR, LANE_FROM], [CORR, G.tableTop - 4]]);
  lookupWire.end(0);
  lookupWire.opacity(1);
  yield* all(show(parse.node, 0.35), draw(lookupWire, 0.5), bandOn(s.table.rows[0], P.s501, 0.4));
  yield* waitFor(2.0);
  yield* all(drop(parse), lookupWire.opacity(0, 0.3));

  // уходит из симки 501; 502 в этот момент не участвует вовсе
  yield* all(
    fly(e5.node, [[DOCK_OUT, LANE_FROM], [CORR, LANE_FROM], [CORR, SIM_Y[0]], [PACT_X, SIM_Y[0]]], 1.5),
    s.api.frame.stroke(A(P.tb, 0.42), 0.4),
    s.pact.sims[1].node.opacity(0.3, 0.5),
  );
  yield* all(
    hide(e5.node, 0.3),
    s.pact.sims[0].frame.stroke(P.s501, 0.35),
    s.pact.sims[0].frame.lineWidth(2.5, 0.35),
  );
  e5.node.remove();
  yield* say('ответ уходит с того же номера, на который написали', 1.8);

  // призрак: как это выглядело раньше
  const ghost = env(1, 'раньше', [X.srvL - 30, LANE_FROM], true);
  ghost.label.fill(P.dim);
  yield* all(
    s.pact.sims[1].node.opacity(1, 0.4),
    ghost.node.opacity(0.55, 0.3),
    fly(ghost.node, [[X.srvL - 30, LANE_FROM], [CORR, LANE_FROM], [CORR, SIM_Y[1]], [PACT_X, SIM_Y[1]]], 1.2),
    say('раньше ответ мог уйти не с той симки', 1.4),
  );
  yield* all(hide(ghost.node, 0.4), bandOff(s.table.rows[0], 0.35),
    s.pact.sims[0].frame.stroke(A(P.s501, 0.4), 0.35), s.pact.sims[0].frame.lineWidth(1.5, 0.35));
  ghost.node.remove();
  yield* mute();

  // ═══════════════════════════════════════════════════════════════════════
  // АКТ 6 — переподключение
  // ═══════════════════════════════════════════════════════════════════════
  yield* all(
    eyebrow('СЦЕНА 6 / 10   ·   ПЕРЕПОДКЛЮЧЕНИЕ'),
    focus(s, ['pact', 'api', 'origin', 'amo', 'table', 'formula'], {hidden: ['cabinet', 'opsrv', 'rails', 'proc']}),
  );

  yield* all(show(s.pact.sims[2].node, 0.5, 8), say('в Pact появилась симка 503. Сама она не подключается', 1.6));
  yield* mute();

  const c6 = bandCard([
    {t: 'переподключение интеграции', c: P.ink},
    {t: 'источники и строки СНОСЯТСЯ, потом создаются заново', c: P.badSoft},
  ], {size: 16});
  yield* show(c6.node, 0.35);

  // снос
  yield* all(
    s.amo.chips[0].node.opacity(0, 0.5),
    chain(waitFor(0.1), s.amo.chips[1].node.opacity(0, 0.5)),
    s.table.rows[0].node.opacity(0, 0.5),
    chain(waitFor(0.1), s.table.rows[1].node.opacity(0, 0.5)),
  );
  yield* all(s.table.empty.opacity(1, 0.3), waitFor(0.7));
  yield* drop(c6);

  // пересоздание с новыми id
  const c6b = bandCard([
    {t: 'channelId\tбыло\tстало', c: P.dim},
    {t: '501\t84025\t84031', c: P.s501},
    {t: '502\t84026\t84032', c: P.s502},
    {t: '503\t—\t84033', c: P.s503},
  ], {size: 16, tabs: [14, 24]});
  yield* show(c6b.node, 0.35);

  const chipMeta = [
    ['id 84031 · whatsapp_501', SIM_DATA[0].name],
    ['id 84032 · whatsapp_502', SIM_DATA[1].name],
    ['id 84033 · whatsapp_503', SIM_DATA[2].name],
  ];
  for (let i = 0; i < 3; i++) {
    s.amo.chips[i].name.text(chipMeta[i][1]);
    s.amo.chips[i].meta.text(chipMeta[i][0]);
    s.amo.chips[i].msg.opacity(0);
    s.amo.chips[i].frame.stroke(A(P.amo, 0.4));
    s.amo.chips[i].frame.fill(A(P.amo, 0.07));
  }
  yield* s.table.empty.opacity(0, 0.25);
  const newRows = [ROW.r501b, ROW.r502b, ROW.r503b];
  for (let i = 0; i < 3; i++) {
    setRow(s.table.rows[i], newRows[i]);
    yield* all(show(s.amo.chips[i].node, 0.4, 10), showRow(s.table.rows[i], 0.4));
  }
  yield* waitFor(0.8);

  // что изменилось, а что нет
  yield* all(
    s.table.rows[0].src.fill(P.badSoft, 0.4),
    s.table.rows[1].src.fill(P.badSoft, 0.4),
    s.table.rows[2].src.fill(P.badSoft, 0.4),
    s.formula.frame.stroke(P.tbl, 0.4),
    s.formula.lines[0].fill(P.tbl, 0.4),
    say('sourceId сменились. external_id — нет: он выводится из channelId', 2.2),
  );
  yield* all(
    s.table.rows[0].src.fill(P.soft, 0.4),
    s.table.rows[1].src.fill(P.soft, 0.4),
    s.table.rows[2].src.fill(P.soft, 0.4),
    s.formula.frame.stroke(A(P.tbl, 0.45), 0.4),
    s.formula.lines[0].fill(P.ink, 0.4),
    drop(c6b),
  );
  yield* say('источники пересоздаются целиком. Новая симка подключается только так', 2.0);
  yield* mute();

  // ═══════════════════════════════════════════════════════════════════════
  // АКТ 7 — удаление интеграции
  // ═══════════════════════════════════════════════════════════════════════
  yield* all(
    eyebrow('СЦЕНА 7 / 10   ·   УДАЛЕНИЕ ИНТЕГРАЦИИ'),
    focus(s, ['cabinet', 'api', 'origin', 'amo', 'table'], {hidden: ['formula', 'rails', 'proc', 'opsrv']}),
  );

  const c7 = bandCard([{t: 'клиент удаляет интеграцию', c: P.ink}]);
  yield* show(c7.node, 0.3);
  yield* waitFor(0.8);

  originLink.lineDash([7, 7]);
  yield* all(
    originLink.stroke(P.gone, 0.5),
    s.origin.pipe.stroke(A(P.origin, 0.28), 0.5),
    s.origin.pipe.lineWidth(2, 0.5),
  );
  yield* all(
    s.table.rows[0].node.opacity(0, 0.5),
    chain(waitFor(0.08), s.table.rows[1].node.opacity(0, 0.5)),
    chain(waitFor(0.16), s.table.rows[2].node.opacity(0, 0.5)),
    s.table.empty.opacity(1, 0.6),
  );

  // источники в амо остаются висеть
  yield* all(
    ...s.amo.chips.map(c => all(
      c.frame.stroke(P.gone, 0.6),
      c.frame.fill('rgba(255,255,255,0.02)', 0.6),
      c.name.fill(P.gone, 0.6),
      c.meta.fill(P.gone, 0.6),
    )),
  );
  yield* all(drop(c7), say('источники в амо остаются, связь у нас удалена', 2.0));
  yield* mute();

  // ═══════════════════════════════════════════════════════════════════════
  // АКТ 8 — ветки отказа
  // ═══════════════════════════════════════════════════════════════════════
  // вернуть стенд в «чистое» состояние
  for (let i = 0; i < 3; i++) {
    s.amo.chips[i].node.opacity(0);
    s.amo.chips[i].frame.stroke(A(P.amo, 0.4));
    s.amo.chips[i].frame.fill(A(P.amo, 0.07));
    s.amo.chips[i].name.fill(P.amo);
    s.amo.chips[i].meta.fill(P.dim);
    s.table.rows[i].node.opacity(0);
  }
  s.origin.pipe.stroke(A(P.origin, 0.55));
  originLink.stroke(A(P.origin, 0.55));
  originLink.lineDash([]);
  yield* all(
    eyebrow('СЦЕНА 8 / 10   ·   ВЕТКИ ОТКАЗА'),
    focus(s, ['pact', 'api', 'origin', 'amo', 'table'], {hidden: ['cabinet', 'opsrv', 'formula', 'rails', 'proc']}),
  );

  // 8.1 — нет токена амо
  const f1 = bandCard([
    {t: 'подключение  →  auth = null', c: P.ink},
    {t: 'источники не создаются · строк нет · warn в лог', c: P.badSoft},
    {t: 'клиент работает как раньше', c: P.soft},
  ], {size: 16, title: '8.1   НЕТ ТОКЕНА АМО', color: P.badSoft});
  yield* show(f1.node, 0.35);
  yield* waitFor(2.4);
  yield* drop(f1);

  // 8.2 — амо отверг origin_code (задевает всех сразу)
  const f2 = bandCard([
    {t: 'POST /api/v4/sources  { "origin_code": "dev.whatsapp" }', c: P.ink},
    {t: 'ответ: ошибка', c: P.bad},
    {t: '0 источников · 0 строк · подключение считается успешным', c: P.badSoft},
  ], {size: 16, title: '8.2   АМО ОТВЕРГ origin_code', color: P.bad});
  yield* show(f2.node, 0.35);
  yield* all(
    s.origin.pipe.stroke(P.bad, 0.5),
    s.origin.pipe.fill(A(P.bad, 0.10), 0.5),
    s.origin.label.fill(P.bad, 0.5),
  );
  yield* say('origin один на весь продукт — отказ задевает всех клиентов сразу', 2.4);
  yield* all(
    drop(f2), mute(),
    s.origin.pipe.stroke(A(P.origin, 0.55), 0.5),
    s.origin.pipe.fill(A(P.origin, 0.07), 0.5),
    s.origin.label.fill(P.origin, 0.5),
  );

  // 8.3 — неизвестный external_id в ответе
  const f3 = bandCard([
    {t: 'отправили:\twhatsapp_501', c: P.soft},
    {t: 'вернулось:\twhatsapp_501,  whatsapp_999', cs: [P.soft, P.ink]},
  ], {size: 16, title: '8.3   НЕИЗВЕСТНЫЙ external_id', color: P.badSoft, tabs: [13]});
  yield* show(f3.node, 0.35);
  setRow(s.table.rows[0], ROW.r501);
  yield* s.table.empty.opacity(0, 0.2);
  yield* showRow(s.table.rows[0], 0.4);

  const orphan = makeCard({
    x: 0, y: G.tableBot + 38, size: 15, color: P.bad,
    lines: [{t: 'whatsapp_999  →  канала нет у клиента  →  отброшен с warn', c: P.badSoft}],
  });
  s.fx.add(orphan.node);
  yield* show(orphan.node, 0.35);
  yield* say('строка для 501 записана. Остальные каналы не страдают', 2.0);
  yield* all(drop(f3), drop(orphan), mute());

  // 8.4 — нет строки в таблице: сообщение исчезает
  yield* focus(s, ['rails', 'pact', 'proc', 'origin', 'amo', 'table'], {hidden: ['cabinet', 'opsrv', 'formula', 'api']});
  const f4 = bandCard([
    {t: 'входящее channelId = 503', c: P.ink},
    {t: 'lookup  →  строки нет', c: P.badSoft},
  ], {size: 16, title: '8.4   НЕТ СТРОКИ В ТАБЛИЦЕ', color: P.bad});
  yield* show(f4.node, 0.35);

  const gate = new Rect({
    x: X.srvR + 44, y: LANE_TO, width: 7, height: 96, radius: 3, fill: P.bad, opacity: 0,
  });
  s.fx.add(gate);
  yield* gate.opacity(0.9, 0.3);

  const e8 = env(2, 'Заказ готов?', [PACT_X, SIM_Y[2]]);
  yield* show(e8.node, 0.25, 0);
  yield* fly(e8.node, [[PACT_X, SIM_Y[2]], [CORR, SIM_Y[2]], [CORR, LANE_TO], [DOCK_IN, LANE_TO]], 1.1);
  yield* all(e8.label.opacity(0, 0.25), waitFor(0.5));
  yield* fly(e8.node, [[DOCK_IN, LANE_TO], [X.srvR + 12, LANE_TO]], 0.7);
  yield* all(
    e8.node.scale(0.6, 0.35, easeInOutCubic),
    e8.node.opacity(0, 0.35),
    gate.opacity(0.35, 0.35),
  );
  e8.node.remove();

  const lost = makeCard({
    x: 110, y: LANE_TO, size: 17, color: P.bad,
    lines: [{t: 'сообщение потеряно безвозвратно —', c: P.badSoft}, {t: 'оно не встаёт в очередь', c: P.badSoft}],
  });
  s.fx.add(lost.node);
  yield* show(lost.node, 0.35);
  yield* say('нет строки — сообщение в амо не уходит', 2.2);
  yield* all(drop(f4), drop(lost), gate.opacity(0, 0.3), mute());
  gate.remove();

  // ═══════════════════════════════════════════════════════════════════════
  // АКТ 9 — существующие клиенты
  // ═══════════════════════════════════════════════════════════════════════
  yield* all(
    eyebrow('СЦЕНА 9 / 10   ·   СУЩЕСТВУЮЩИЕ КЛИЕНТЫ'),
    s.root.opacity(0, 0.6), erase(originLink), erase(lookupWire),
  );

  const board = new Node({opacity: 0});
  s.fx.add(board);

  const GROUPS: [string, string, string, string][] = [
    ['подключились после релиза', 'источники есть', 'работают', P.s501],
    ['есть строка в старой таблице\nwhatsapp_channels', 'источников нет', 'ждут скрипт', P.s502],
    ['строки в старой таблице нет', 'источников нет', '???', P.bad],
  ];
  const gy = [-300, -170, -40];
  const gRefs: {frame: Rect; state: any; node: Node}[] = [];
  for (let i = 0; i < 3; i++) {
    const [who, src, state, color] = GROUPS[i];
    const g = new Node({y: gy[i], opacity: 0});
    const frame = panel({w: 1280, h: 104, radius: 12, stroke: A(color, 0.36), fill: A(color, 0.05)});
    g.add(frame);
    g.add(txt({t: who.replace('\n', '  '), x: -1280 / 2 + 28, y: -12, size: 20, fill: P.ink, left: true}));
    g.add(txt({t: src, x: -1280 / 2 + 28, y: 16, size: 15, fill: P.dim, left: true}));
    const st = txt({t: state, x: 1280 / 2 - 28, size: 22, fill: color, right: true, weight: 500});
    g.add(st);
    board.add(g);
    gRefs.push({frame, state: st, node: g});
  }
  yield* board.opacity(1, 0.01);
  for (const r of gRefs) yield* show(r.node, 0.4, 10);

  const numbers = makeCard({
    x: 0, y: 150, size: 19, pad: 22,
    tabs: [42],
    lines: [
      {t: 'строк в старой таблице whatsapp_channels\t58', cs: [P.soft, P.ink]},
      {t: 'аккаунтов с WhatsApp-трафиком в амо\t114', cs: [P.soft, P.ink]},
    ],
  });
  s.fx.add(numbers.node);
  yield* show(numbers.node, 0.4);
  yield* waitFor(1.6);

  const script = makeCard({
    x: 0, y: 282, size: 19, color: P.tbl,
    lines: [{t: 'скрипт миграции идёт по строкам старой таблицы', c: P.ink}],
  });
  s.fx.add(script.node);
  yield* show(script.node, 0.35);
  yield* waitFor(1.0);

  gRefs[1].state.text('покрыты');
  yield* all(
    gRefs[1].frame.stroke(P.s501, 0.6),
    gRefs[1].frame.fill(A(P.s501, 0.08), 0.6),
    gRefs[1].state.fill(P.s501, 0.6),
  );
  yield* waitFor(0.8);
  yield* all(
    gRefs[2].frame.stroke(P.bad, 0.5),
    gRefs[2].state.fill(P.bad, 0.5),
    numbers.node.y(numbers.node.y() - 4, 0.3),
  );
  yield* say('скрипт покрывает только тех, у кого была строка', 2.4);
  yield* all(drop(numbers), drop(script), mute());

  // ═══════════════════════════════════════════════════════════════════════
  // АКТ 10 — открытый вопрос
  // ═══════════════════════════════════════════════════════════════════════
  yield* all(
    eyebrow('СЦЕНА 10 / 10   ·   ОТКРЫТЫЙ ВОПРОС'),
    gRefs[0].node.opacity(0, 0.5),
    gRefs[1].node.opacity(0, 0.5),
    gRefs[2].node.y(-310, 0.7, easeInOutCubic),
  );

  const varA = makeCard({
    x: -340, y: 40, size: 19, pad: 26, color: P.tb, minW: 600,
    title: 'ВАРИАНТ А  ·  СТРОГО ПО ТЗ',
    lines: [
      {t: 'нет источника  →  не отправляем', c: P.ink},
      {t: '', c: P.dim},
      {t: 'эти клиенты замолкают', c: P.badSoft},
      {t: 'до ручного переподключения', c: P.badSoft},
      {t: '', c: P.dim},
      {t: 'цена: тишина у части клиентов', c: P.dim},
    ],
  });
  const varB = makeCard({
    x: 340, y: 40, size: 19, pad: 26, color: P.tbl, minW: 600,
    title: 'ВАРИАНТ Б  ·  С ФОЛЛБЭКОМ',
    lines: [
      {t: 'нет источника  →  шлём как раньше', c: P.ink},
      {t: '', c: P.dim},
      {t: 'ничего не ломается,', c: P.soft},
      {t: 'различения симок пока нет', c: P.soft},
      {t: '', c: P.dim},
      {t: 'цена: два поведения в одном коде', c: P.dim},
    ],
  });
  s.fx.add(varA.node);
  s.fx.add(varB.node);
  yield* all(show(varA.node, 0.5, 12), chain(waitFor(0.15), show(varB.node, 0.5, 12)));
  yield* say('решение за аналитиком', 2.6);

  yield* all(s.fx.opacity(0, 0.8), s.eyebrow.opacity(0, 0.8), s.caption.opacity(0, 0.8));
  yield* waitFor(0.4);
});
