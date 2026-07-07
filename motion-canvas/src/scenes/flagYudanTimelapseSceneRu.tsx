import {blur, makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {all, chain, createRef, createSignal, easeInCubic, easeOutCubic, linear, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingX} from '../core/code/shared/TextMeasure';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ─────────────────────────────────────────────────────────────────────────
// YUDAN — base principle.
//   A small piece of code — the `if (fromImport)` block — is the ANCHOR:
//   fixed, sharp, dead centre, never moving. A few lines above and below it
//   do the time-lapse HORIZONTALLY, "like trains", LINE BY LINE (not as a
//   block): the old line slides out to the left, a new one slides in from
//   the right, each row on its own beat. The flag holds; the system streams.
// ─────────────────────────────────────────────────────────────────────────

const VAR_LIGHT   = 'rgba(244,241,235,0.96)';
const TYPE_LILAC  = 'rgba(201,180,255,0.82)';
const METHOD_ROSE = '#FF8CA3';
const CONST_LILAC = 'rgba(201,180,255,0.80)';
const KEY_BLUE    = 'rgba(163,205,255,0.85)';

const CUSTOM_TYPES = [
  'RegisterCustomer', 'Customer', 'CustomerSource', 'CustomerStatus', 'CustomerPlan', 'Boolean', 'EmailRequired',
];
const METHODS = ['register', 'save', 'findByEmail', 'trim', 'lowercase', 'start', 'schedule'];

const RULES: ColorRule[] = [
  {match: /^[a-z][a-zA-Z0-9_]*$/, color: VAR_LIGHT},
  {match: /^[A-Z][a-zA-Z0-9]*$/, color: TYPE_LILAC, onlyTypes: ['type'] as const},
  {match: new RegExp('^(' + CUSTOM_TYPES.join('|') + ')$'), color: TYPE_LILAC},
  {match: /^[a-z][a-zA-Z0-9_]*$/, color: METHOD_ROSE, onlyTypes: ['method'] as const},
  {match: new RegExp('^(' + METHODS.join('|') + ')$'), color: METHOD_ROSE},
  {match: /^[A-Z][A-Z0-9_]+$/, color: CONST_LILAC},
  {match: /^(class|object|fun|val|var|private|public|internal|return|if|else|is|in|when|for|while|throw|null|true|false)$/, color: KEY_BLUE},
  {match: /^@\w+$/, color: KEY_BLUE},
];

const TRANSPARENT_CARD = {
  radius: 0, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)', strokeWidth: 0,
  edge: false, opacity: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0,
} as const;

// The fixed anchor — a small block, dead centre.
const ANCHOR_CODE = `    if (fromImport) {
        source = CustomerSource.IMPORT
    }`;

// The surrounding lines the trains cycle through — the method's history.
const POOL = [
  '    var email = command.email',
  '    if (!fromImport && email == null) {',
  '        throw EmailRequired()',
  '    val existing = customers.findByEmail(email)',
  '    if (existing != null && fromImport) {',
  '        return existing',
  '    var status = CustomerStatus.PENDING',
  '    var plan = CustomerPlan.FREE',
  '        status = CustomerStatus.ACTIVE',
  '        plan = CustomerPlan.BUSINESS',
  '    val customer = customers.save(customer)',
  '    if (!fromImport) {',
  '        verification.start(customer.id)',
  '        welcomeMessages.schedule(customer.id)',
  '    var source = CustomerSource.SIGN_UP',
  '        email = email.trim().lowercase()',
];

// ── Geometry ───────────────────────────────────────────────────────────────
const FS = 26;
const LH = 38;
const W  = 1500;
const PAD_X = getCodePaddingX(FS);
const LINE_X = -400;                 // left edge of every line
const CONTENT_OFF = W / 2 - PAD_X;   // so text's left edge lands at the node's x
const OFF = 1550;                    // a train's off-screen entry/exit distance
const BLUR_MOVE = 8;                 // slow-shutter drag on a train in motion (0 at rest)
const N_TRAIL = 7;                   // dense horizontal comb → long-exposure streak
const TOTAL = 9.0;

// Rows above and below the 3-line anchor block (which occupies y = -LH, 0, +LH).
const ROWS = [
  {y: -4 * LH, start: 0,  hold: 0.62, dur: 0.30, phase: 0.00},
  {y: -3 * LH, start: 6,  hold: 0.74, dur: 0.32, phase: 0.20},
  {y: -2 * LH, start: 11, hold: 0.55, dur: 0.28, phase: 0.10},
  {y:  2 * LH, start: 3,  hold: 0.68, dur: 0.31, phase: 0.28},
  {y:  3 * LH, start: 9,  hold: 0.58, dur: 0.29, phase: 0.14},
  {y:  4 * LH, start: 14, hold: 0.72, dur: 0.30, phase: 0.34},
];

interface LineObj { node: Node; text: string; blur?: ReturnType<typeof createSignal<number>>; }
interface Row { y: number; start: number; hold: number; dur: number; phase: number; line?: LineObj; idx: number; }

// ── Scene ──────────────────────────────────────────────────────────────────
export default makeScene2D(function* (view) {
  applyBackground(view);

  const ghostLayer = createRef<Node>();
  const lineLayer  = createRef<Node>();
  const topLayer   = createRef<Node>();
  view.add(<Node ref={ghostLayer} />);
  view.add(<Node ref={lineLayer} />);
  view.add(<Node ref={topLayer} />);

  const buildLine = (text: string, x: number, y: number, layer: Node, withBlur = false): LineObj => {
    const mc = Manticore.create(text, {
      x, y, width: W,
      fontSize: FS, lineHeight: LH, fontFamily: Fonts.code,
      theme: DryFiltersV3CodeTheme, noClip: true,
      cardStyle: TRANSPARENT_CARD, glowAccent: false, customTypes: CUSTOM_TYPES,
      contentOffsetX: CONTENT_OFF,
    });
    mc.mount(layer);
    mc.colorize(RULES);
    mc.node.opacity(1);
    let b: ReturnType<typeof createSignal<number>> | undefined;
    if (withBlur) {
      b = createSignal(0);   // sharp at rest; smears while it travels
      mc.node.cache(true);
      mc.node.cachePadding(70);
      mc.node.filters(() => [blur(b!())]);
    }
    return {node: mc.node, text, blur: b};
  };

  // ── The anchor — fixed, sharp, above everything. ──────────────────────────
  const anchor = Manticore.create(ANCHOR_CODE, {
    x: LINE_X, y: 0, width: W,
    fontSize: FS, lineHeight: LH, fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme, noClip: true,
    cardStyle: TRANSPARENT_CARD, glowAccent: false, customTypes: CUSTOM_TYPES,
    contentOffsetX: CONTENT_OFF,
  });
  anchor.mount(topLayer());
  anchor.colorize(RULES);
  anchor.node.opacity(0);

  // ── Establish — the anchor and the first line of each row, sharp. ─────────
  const rows: Row[] = ROWS.map(r => ({...r, idx: r.start}));
  for (const r of rows) {
    r.line = buildLine(POOL[r.idx % POOL.length], LINE_X, r.y, lineLayer(), true);
    r.line.node.opacity(0);
  }
  yield* all(
    anchor.node.opacity(1, 0.5, easeOutCubic),
    ...rows.map(r => r.line!.node.opacity(1, 0.5, easeOutCubic)),
  );

  // ── One horizontal swap on a row: old slides out left, new slides in from
  //    the right — each with a short ghost trail. ─────────────────────────────
  function* swap(r: Row, dur: number): ThreadGenerator {
    const old = r.line!;
    r.idx += 1;
    const next = buildLine(POOL[r.idx % POOL.length], LINE_X + OFF, r.y, lineLayer(), true);
    r.line = next;
    next.blur?.(BLUR_MOVE);   // enters as a smear, resolves to sharp at rest

    const ghosts: Txt[] = [];
    const anims: ThreadGenerator[] = [
      // OLD — accelerates out to the left, smearing (blur up), fading.
      old.node.position.x(LINE_X - OFF, dur, easeInCubic),
      old.node.opacity(0, dur * 0.92, easeInCubic),
      // NEW — flies in from the right and settles razor-sharp (blur → 0).
      next.node.position.x(LINE_X, dur, easeOutCubic),
      next.blur!(0, dur, easeOutCubic),
    ];
    if (old.blur) anims.push(old.blur(BLUR_MOVE, dur * 0.6, easeInCubic));

    // A dense horizontal comb trailing each train — the long-exposure streak.
    for (let k = 1; k <= N_TRAIL; k++) {
      const op = 0.3 / (k * 0.9 + 0.6);
      const go = new Txt({x: LINE_X, y: r.y, text: old.text, offset: [-1, 0], fontFamily: Fonts.code, fontSize: FS, fill: `rgba(244,241,235,${op})`});
      const gn = new Txt({x: LINE_X + OFF, y: r.y, text: next.text, offset: [-1, 0], fontFamily: Fonts.code, fontSize: FS, fill: `rgba(244,241,235,${op})`});
      ghostLayer().add(go);
      ghostLayer().add(gn);
      ghosts.push(go, gn);
      anims.push(chain(waitFor(k * 0.014), all(go.position.x(LINE_X - OFF, dur, easeInCubic), go.opacity(0, dur, linear))));
      anims.push(chain(waitFor(k * 0.014), all(gn.position.x(LINE_X, dur, easeOutCubic), gn.opacity(0, dur, linear))));
    }

    yield* all(...anims);
    old.node.remove();
    ghosts.forEach(g => g.remove());
  }

  // ── Each row runs its own train on its own beat — asynchronous, speeding up.
  function* runRow(r: Row): ThreadGenerator {
    yield* waitFor(r.phase);
    let t = r.phase;
    let hold = r.hold;
    let dur = r.dur;
    while (t + hold + dur < TOTAL) {
      yield* waitFor(hold);
      yield* swap(r, dur);
      t += hold + dur;
      hold = Math.max(0.26, hold * 0.9);   // the years pass faster
      dur = Math.max(0.2, dur * 0.94);
    }
  }

  yield* all(...rows.map(r => runRow(r)));
  yield* waitFor(0.5);
});
