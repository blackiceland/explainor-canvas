import {makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, easeOutCubic, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingX} from '../core/code/shared/TextMeasure';
import {textWidth} from '../core/utils/textMeasure';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ─────────────────────────────────────────────────────────────────────────
// YUDAN — the flag stayed the same; the system around it did not.
// A big, sharp, static core in the centre (the flag's decision, unchanged).
// Around it, ~5s of code lines riffling through years of the surrounding
// system. The centre never moves. Everything around it keeps changing.
// ─────────────────────────────────────────────────────────────────────────

// ── Palette (matches the Yudan chapter) ────────────────────────────────────
const VAR_LIGHT   = 'rgba(244,241,235,0.96)';
const TYPE_LILAC  = 'rgba(201,180,255,0.82)';
const METHOD_ROSE = '#FF8CA3';
const CONST_LILAC = 'rgba(201,180,255,0.80)';
const KEY_BLUE    = 'rgba(163,205,255,0.85)';
const CHURN_INK   = 'rgba(236,230,220,1)';   // surrounding lines, opacity drives the dim

const F = Fonts.code;

// ── The static centre — the flag's decision, frozen ────────────────────────
const HERO = `if (fromImport) {
    source = CustomerSource.IMPORT
}`;

const HERO_FS = 48;
const HERO_LH = 66;
const HERO_W  = 1400;

const HERO_TYPES = ['CustomerSource', 'CustomerStatus', 'CustomerPlan', 'Customer', 'RegisterCustomer', 'Boolean'];
const HERO_RULES: ColorRule[] = [
  {match: /^(if|else|return|throw|val|var|fun|true|false|null)$/, color: KEY_BLUE},
  {match: new RegExp('^(' + HERO_TYPES.join('|') + ')$'), color: TYPE_LILAC},
  {match: /^[A-Z][A-Z0-9_]+$/, color: CONST_LILAC},
  {match: /^[a-z][a-zA-Z0-9_]*$/, color: VAR_LIGHT},
  {match: /^[a-z][a-zA-Z0-9_]*$/, color: METHOD_ROSE, onlyTypes: ['method'] as const},
];

const TRANSPARENT_CARD = {
  radius: 0, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)', strokeWidth: 0,
  edge: false, opacity: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0,
} as const;

// ── The churning system around it — real fragments from register()'s history.
const POOL = [
  'val email = command.email',
  'email = email.trim().lowercase()',
  'if (!fromImport && email == null) {',
  'throw EmailRequired()',
  'existing = customers.findByEmail(email)',
  'if (existing != null) {',
  'return existing',
  'throw CustomerAlreadyExists(existing.id)',
  'var verified = command.emailVerified',
  'verified = true',
  'status = CustomerStatus.ACTIVE',
  'var plan = CustomerPlan.FREE',
  'plan = CustomerPlan.BUSINESS',
  'val customer = Customer(email, source)',
  'val saved = customers.save(customer)',
  'verification.start(saved.id)',
  'outbox.add(CustomerRegistered(saved.id))',
  'welcomeMessages.schedule(saved.id)',
  'return saved',
];

// One churning row: for `duration` seconds, riffle through the pool with a
// quick fade + upward slip on each swap, speeding up as time passes.
interface Row {
  txt: Txt;
  baseY: number;
  dim: number;
  startIdx: number;
  stride: number;
  phase: number;
}

const CHURN_FS  = 27;
const CHURN_DUR = 5.0;

// Rows framing the centre — nearer rows brighter, farther rows fainter.
const ROW_SPECS = [
  {y: -175, dim: 0.52, startIdx: 0,  stride: 1, phase: 0.00},
  {y: -248, dim: 0.42, startIdx: 5,  stride: 2, phase: 0.09},
  {y: -321, dim: 0.33, startIdx: 9,  stride: 1, phase: 0.18},
  {y: -394, dim: 0.25, startIdx: 13, stride: 3, phase: 0.27},
  {y:  175, dim: 0.52, startIdx: 3,  stride: 2, phase: 0.05},
  {y:  248, dim: 0.42, startIdx: 8,  stride: 1, phase: 0.14},
  {y:  321, dim: 0.33, startIdx: 12, stride: 2, phase: 0.23},
  {y:  394, dim: 0.25, startIdx: 16, stride: 1, phase: 0.32},
];

function* churn(row: Row): ThreadGenerator {
  yield* waitFor(row.phase);
  let t = row.phase;
  let k = row.startIdx;
  while (t < CHURN_DUR) {
    const frac = t / CHURN_DUR;
    const interval = 0.32 - 0.16 * frac;   // riffle speeds up: 0.32 → 0.16
    row.txt.text(POOL[((k % POOL.length) + POOL.length) % POOL.length]);
    row.txt.opacity(0.06);
    row.txt.position.y(row.baseY + 6);
    yield* all(
      row.txt.opacity(row.dim, 0.11, easeOutCubic),
      row.txt.position.y(row.baseY, 0.13, easeOutCubic),
    );
    yield* waitFor(Math.max(0.03, interval - 0.13));
    t += interval;
    k += row.stride;
  }
}

// ── Scene ──────────────────────────────────────────────────────────────────
export default makeScene2D(function* (view) {
  applyBackground(view);

  // Centre the hero block horizontally about x = 0.
  const heroLines = HERO.split('\n');
  const heroMaxW = Math.max(...heroLines.map(l => textWidth(l, F, HERO_FS)));
  const heroLeftEdge = -HERO_W / 2 + getCodePaddingX(HERO_FS);
  const heroX = -(heroLeftEdge + heroMaxW / 2);

  const hero = Manticore.create(HERO, {
    x: heroX, y: 0, width: HERO_W,
    fontSize: HERO_FS, lineHeight: HERO_LH, fontFamily: F,
    theme: DryFiltersV3CodeTheme, noClip: true,
    cardStyle: TRANSPARENT_CARD, glowAccent: false, customTypes: HERO_TYPES,
  });
  hero.mount(view);
  hero.colorize(HERO_RULES);
  hero.node.opacity(1);
  hero.node.scale(0.92);
  const heroLayer = hero.node;
  heroLayer.opacity(0);

  // Surrounding churn rows.
  const surround = createRef<Node>();
  view.add(<Node ref={surround} opacity={0} />);
  const rows: Row[] = ROW_SPECS.map((spec, i) => {
    const txt = new Txt({
      text: POOL[spec.startIdx % POOL.length],
      x: 0, y: spec.y,
      fontFamily: F, fontSize: CHURN_FS,
      fill: CHURN_INK, opacity: spec.dim,
    });
    surround().add(txt);
    return {txt, baseY: spec.y, dim: spec.dim, startIdx: spec.startIdx, stride: spec.stride, phase: spec.phase};
  });

  // ── Intro — the core arrives, the system settles faintly around it. ──────
  yield* all(
    heroLayer.opacity(1, 0.7, easeOutCubic),
    heroLayer.scale(1, 0.7, easeOutCubic),
    surround().opacity(1, 0.7, easeOutCubic),
  );
  yield* waitFor(0.5);

  // ── The timelapse — ~5s of the surrounding system churning through years,
  //    while the centre holds perfectly still. ──────────────────────────────
  yield* all(...rows.map(r => churn(r)));

  // ── Settle — the churn stops, the surroundings fade back, the flag remains.
  yield* waitFor(0.6);
  yield* all(...rows.map(r => r.txt.opacity(r.dim * 0.4, 0.8, easeInOutCubic)));
  yield* waitFor(1.0);
});
