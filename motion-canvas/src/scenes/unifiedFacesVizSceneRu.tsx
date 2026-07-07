import {makeScene2D, Rect, Txt, Circle, Node, Gradient} from '@motion-canvas/2d';
import {waitFor, Vector2} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {Canon, CanonBg} from '../core/code/model/paletteCanon';

// ── МОК · FLAT-виж в фиксированной сцене ──────────────────────────────
// Два лица (MODE, SAFETY) — виж всегда в ОДНОЙ зоне (одинаковый bounding box).
// FLAT-стиль (сплошные примитивы, цвет=состояние). Вместо карточки —
// мягкий feathered-scrim (цвет фона/свет, растушёван, не коробка).

const INK  = Canon.ink;
const DIM  = 'rgba(244,241,235,0.42)';
const CODE = 'rgba(244,241,235,0.50)';
const BLUE = Canon.param;
const TEAL = Canon.constant;
const ROSE = Canon.methodDef;

// Фиксированная сцена под виж — одинаковая во всех лицах.
const STAGE_X = 560;
const STAGE_W = 440;
const STAGE_H = 280;

const label = (p: Node, x: number, y: number, t: string, size: number, fill: string, off?: [number, number]) =>
  p.add(<Txt x={x} y={y} text={t} fontFamily={Fonts.code} fontSize={size} fill={fill} offset={off} />);

// мягкий scrim (обозначает фикс-зону, маскирует код; не карточка)
const scrim = (p: Node, cx: number, cy: number) =>
  p.add(<Rect x={cx} y={cy} width={STAGE_W} height={STAGE_H}
    fill={new Gradient({type: 'radial', from: new Vector2(0, 0), to: new Vector2(0, 0),
      fromRadius: 0, toRadius: 230,
      stops: [{offset: 0, color: 'rgba(255,255,255,0.045)'}, {offset: 1, color: 'rgba(255,255,255,0)'}]})} />);

const codeHint = (p: Node, cy: number, lines: string[]) => {
  lines.forEach((l, i) => label(p, -840, cy - 120 + i * 34, l, 20, CODE, [-1, 0]));
};

// FLAT-виж MODE — два сплошных круга (состояние)
const vizMode = (p: Node, cy: number) => {
  p.add(<Circle x={STAGE_X - 92} y={cy - 14} width={78} height={78} fill={'rgba(244,241,235,0.14)'} />);
  p.add(<Circle x={STAGE_X + 92} y={cy - 14} width={78} height={78} fill={BLUE} />);
  label(p, STAGE_X - 92, cy + 52, 'default', 17, DIM);
  label(p, STAGE_X + 92, cy + 52, 'silent', 17, BLUE);
};

// FLAT-виж SAFETY — сплошные бары (данные), Bob сохранён (тил)
const vizSafety = (p: Node, cy: number) => {
  const rows: [string, string, string][] = [
    ['Alice', 'rgba(244,241,235,0.14)', INK],
    ['Bob', TEAL, '#0B0C10'],
    ['Carol', 'rgba(244,241,235,0.14)', INK],
  ];
  rows.forEach(([nm, fill, tc], i) => {
    const y = cy - 46 + i * 46;
    p.add(<Rect x={STAGE_X} y={y} width={300} height={38} radius={4} fill={fill} />);
    label(p, STAGE_X - 132, y, nm, 17, tc, [-1, 0]);
  });
};

export default makeScene2D(function* (view) {
  view.add(<Rect x={0} y={0} width={1920} height={1080}
    fill={new Gradient({type: 'linear', from: new Vector2(0, -540), to: new Vector2(0, 540),
      stops: [{offset: 0, color: CanonBg.from}, {offset: 1, color: CanonBg.to}]})} />);

  // разделитель двух лиц (только для мока)
  view.add(<Rect x={0} y={0} width={1720} height={1} fill={'rgba(244,241,235,0.06)'} />);

  // ── Лицо 1: MODE (верхняя половина) ──
  {
    const cy = -270;
    const p = new Node({x: 0, y: 0});
    view.add(p);
    p.add(<Txt x={-840} y={cy - 190} text={'MODE'} fontFamily={Fonts.primary} fontSize={22} fontWeight={600} letterSpacing={4} fill={INK} offset={[-1, 0]} />);
    codeHint(p, cy, [
      'fun send(user, message, silent: Boolean)',
      '    val options = if (silent) Silent else Default',
      '    return gateway.send(user, message, options)',
    ]);
    scrim(p, STAGE_X, cy);
    vizMode(p, cy);
  }

  // ── Лицо 2: SAFETY (нижняя половина) — виж в ТОЙ ЖЕ зоне ──
  {
    const cy = 270;
    const p = new Node({x: 0, y: 0});
    view.add(p);
    p.add(<Txt x={-840} y={cy - 190} text={'SAFETY'} fontFamily={Fonts.primary} fontSize={22} fontWeight={600} letterSpacing={4} fill={INK} offset={[-1, 0]} />);
    codeHint(p, cy, [
      'fun delete(userId, soft: Boolean)',
      '    if (soft) return markDeleted(userId)',
      '    return deletePermanently(userId)',
    ]);
    scrim(p, STAGE_X, cy);
    vizSafety(p, cy);
  }

  yield* waitFor(2);
});
