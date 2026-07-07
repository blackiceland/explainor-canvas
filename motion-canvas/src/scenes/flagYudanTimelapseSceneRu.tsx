import {blur, makeScene2D, Node} from '@motion-canvas/2d';
import {all, createRef, easeInCubic, easeInOutSine, easeOutCubic, linear, ThreadGenerator, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingX} from '../core/code/shared/TextMeasure';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ─────────────────────────────────────────────────────────────────────────
// YUDAN — full-size code states passing a stationary anchor like high-speed
// trains, with long-exposure directional trails.
//
// The camera is fixed. A sharp `if (fromImport) { … }` block is pinned dead
// centre on its own layer and never moves. Around it, full-size versions of
// register() are hurled horizontally through the frame — the old one flung
// left, the next arriving from the right — each dragging phase-lagged ghost
// copies behind it, so a line briefly exists in several places at once
// (bright now + fainter earlier + faintest far trail). Nothing shrinks; the
// only difference between the anchor and the rest is motion and sharpness.
// The passes accelerate, then stop dead on the final overgrown method, where
// every `fromImport` lights at once.
// ─────────────────────────────────────────────────────────────────────────

const VAR_LIGHT   = 'rgba(244,241,235,0.96)';
const TYPE_LILAC  = 'rgba(201,180,255,0.82)';
const METHOD_ROSE = '#FF8CA3';
const CONST_LILAC = 'rgba(201,180,255,0.80)';
const KEY_BLUE    = 'rgba(163,205,255,0.85)';
const AMBER       = '#F6C87E';
const AMBER_GLOW  = 'rgba(246,200,126,0.7)';

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

// The pinned anchor — the flag's decision, present unchanged in every version.
const ANCHOR = `    if (fromImport) {
        source = CustomerSource.IMPORT`;
const ANCHOR_LINE = '    if (fromImport) {';

// ── The full-size method, version by version (the trains) ──────────────────
const V1 = `@Transactional
fun register(command: RegisterCustomer, fromImport: Boolean): Customer {
    var source = CustomerSource.SIGN_UP

    if (fromImport) {
        source = CustomerSource.IMPORT
    }

    return customers.save(
        Customer(source)
    )
}`;

const V2 = `@Transactional
fun register(command: RegisterCustomer, fromImport: Boolean): Customer {
    var email = command.email

    if (!fromImport && email == null) {
        throw EmailRequired()
    }

    var source = CustomerSource.SIGN_UP

    if (fromImport) {
        source = CustomerSource.IMPORT
    }

    return customers.save(
        Customer(email, source)
    )
}`;

const V3 = `@Transactional
fun register(command: RegisterCustomer, fromImport: Boolean): Customer {
    var email = command.email

    if (!fromImport && email == null) {
        throw EmailRequired()
    }

    val existing = customers.findByEmail(email)

    if (existing != null && fromImport) {
        return existing
    }

    var source = CustomerSource.SIGN_UP

    if (fromImport) {
        source = CustomerSource.IMPORT
    }

    return customers.save(
        Customer(email, source)
    )
}`;

const V4 = `@Transactional
fun register(command: RegisterCustomer, fromImport: Boolean): Customer {
    var email = command.email

    if (!fromImport && email == null) {
        throw EmailRequired()
    }

    val existing = customers.findByEmail(email)

    if (existing != null && fromImport) {
        return existing
    }

    var source = CustomerSource.SIGN_UP
    var status = CustomerStatus.PENDING
    var plan = CustomerPlan.FREE

    if (fromImport) {
        source = CustomerSource.IMPORT
        status = CustomerStatus.ACTIVE
        plan = CustomerPlan.BUSINESS
    }

    return customers.save(
        Customer(email, source, status, plan)
    )
}`;

const V5 = `@Transactional
fun register(command: RegisterCustomer, fromImport: Boolean): Customer {
    var email = command.email

    if (email != null) {
        email = email.trim().lowercase()
    }

    if (!fromImport && email == null) {
        throw EmailRequired()
    }

    val existing = customers.findByEmail(email)

    if (existing != null && fromImport) {
        return existing
    }

    var source = CustomerSource.SIGN_UP
    var status = CustomerStatus.PENDING
    var plan = CustomerPlan.FREE

    if (fromImport) {
        source = CustomerSource.IMPORT
        status = CustomerStatus.ACTIVE
        plan = CustomerPlan.BUSINESS
    }

    return customers.save(
        Customer(email, source, status, plan)
    )
}`;

const V6 = `@Transactional
fun register(command: RegisterCustomer, fromImport: Boolean): Customer {
    var email = command.email

    if (email != null) {
        email = email.trim().lowercase()
    }

    if (!fromImport && email == null) {
        throw EmailRequired()
    }

    val existing = customers.findByEmail(email)

    if (existing != null && fromImport) {
        return existing
    }

    var source = CustomerSource.SIGN_UP
    var status = CustomerStatus.PENDING
    var plan = CustomerPlan.FREE

    if (fromImport) {
        source = CustomerSource.IMPORT
        status = CustomerStatus.ACTIVE
        plan = CustomerPlan.BUSINESS
    }

    val customer = customers.save(
        Customer(email, source, status, plan)
    )

    if (!fromImport) {
        verification.start(customer.id)
        welcomeMessages.schedule(customer.id)
    }

    return customer
}`;

const CODES = [V1, V2, V3, V4, V5, V6];

// ── Geometry ───────────────────────────────────────────────────────────────
const FS   = 28;
const LH   = 36;
const W     = 1650;
const PAD_X = getCodePaddingX(FS);
const TARGET_LEFT = -330;                 // screen x of the code's left margin
const REST_X = TARGET_LEFT + W / 2 - PAD_X;
const OFF    = 1550;                       // how far a train flies off-frame
const FINAL_BUDGET = 1010;                 // vertical room for the final pull-back

// Where the anchor line sits inside `code`, so we can pin it to screen y = 0.
const anchorIndex = (code: string): number => code.split('\n').indexOf(ANCHOR_LINE);
// Container y that places the anchor line at local y = 0 (top-anchored on it).
const codeY = (code: string): number => {
  const n = code.split('\n').length;
  return ((n - 1) / 2 - anchorIndex(code)) * LH;
};

// ── Scene ──────────────────────────────────────────────────────────────────
export default makeScene2D(function* (view) {
  applyBackground(view);

  const flow = createRef<Node>();
  view.add(<Node ref={flow} />);
  const stream = createRef<Node>();
  flow().add(<Node ref={stream} />);   // trains + ghosts live here, below the anchor

  interface Version { mc: Manticore; code: string; y: number; }

  // The two stable anchor lines are pinned by the overlay, so the passing
  // trains must NOT carry them through the centre — hide them in every copy.
  const hideAnchorLines = (mc: Manticore, code: string): void => {
    const a = code.split('\n').indexOf(ANCHOR_LINE);
    mc.getLine(a)?.node.opacity(0);
    mc.getLine(a + 1)?.node.opacity(0);
  };

  const buildVersion = (code: string): Version => {
    const y = codeY(code);
    const mc = Manticore.create(code, {
      x: REST_X, y, width: W,
      fontSize: FS, lineHeight: LH, fontFamily: Fonts.code,
      theme: DryFiltersV3CodeTheme, noClip: true,
      cardStyle: TRANSPARENT_CARD, glowAccent: false, customTypes: CUSTOM_TYPES,
    });
    mc.mount(stream());
    mc.colorize(RULES);
    mc.node.opacity(0);
    hideAnchorLines(mc, code);
    return {mc, code, y};
  };

  // A faint, softly-blurred copy used as one temporal position of a trail.
  const buildGhost = (code: string): Manticore => {
    const mc = Manticore.create(code, {
      x: REST_X, y: codeY(code), width: W,
      fontSize: FS, lineHeight: LH, fontFamily: Fonts.code,
      theme: DryFiltersV3CodeTheme, noClip: true,
      cardStyle: TRANSPARENT_CARD, glowAccent: false, customTypes: CUSTOM_TYPES,
    });
    mc.mount(stream());
    mc.colorize(RULES);
    mc.node.opacity(0);
    hideAnchorLines(mc, code);
    mc.node.cache(true);
    mc.node.cachePadding(60);
    mc.node.filters([blur(5)]);   // small, uniform — the DIRECTION comes from the offset copies
    return mc;
  };

  const versions = CODES.map(buildVersion);

  // The pinned sharp anchor, on top of the stream, dead centre, never moves.
  const anchor = Manticore.create(ANCHOR, {
    x: REST_X, y: LH / 2, width: W,
    fontSize: FS, lineHeight: LH, fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme, noClip: true,
    cardStyle: TRANSPARENT_CARD, glowAccent: false, customTypes: CUSTOM_TYPES,
  });
  anchor.mount(flow());     // mounted after `stream` → renders above the trains
  anchor.colorize(RULES);
  anchor.node.opacity(0);

  // ── One pass — old train flung left, next train arriving from the right,
  //    each dragging phase-lagged ghost trails. The anchor holds sharp. ──────
  function* pass(oldV: Version, nextV: Version, dur: number): ThreadGenerator {
    const oldGhosts = [buildGhost(oldV.code), buildGhost(oldV.code)];
    const newGhosts = [buildGhost(nextV.code), buildGhost(nextV.code)];

    // Seed positions/opacities.
    nextV.mc.node.x(REST_X + OFF);
    nextV.mc.node.opacity(0);
    const gOp = [0.42, 0.22];
    oldGhosts.forEach((g, j) => { g.node.x(REST_X); g.node.y(oldV.y); g.node.opacity(gOp[j]); });
    newGhosts.forEach((g, j) => { g.node.x(REST_X + OFF); g.node.y(nextV.y); g.node.opacity(gOp[j]); });

    yield* all(
      // OLD — flung left, fading.
      oldV.mc.node.x(REST_X - OFF, dur, easeInCubic),
      oldV.mc.node.opacity(0, dur * 0.9, easeInCubic),
      // OLD ghosts — slower ⇒ they lag to the right, smearing back along the path.
      ...oldGhosts.flatMap((g, j) => {
        const d = dur * (1 + 0.30 * (j + 1));
        return [g.node.x(REST_X - OFF, d, easeInCubic), g.node.opacity(0, d, linear)];
      }),

      // NEW — hurled in from the right to rest, materialising as it arrives.
      nextV.mc.node.x(REST_X, dur, easeOutCubic),
      nextV.mc.node.opacity(1, dur * 0.7, easeOutCubic),
      // NEW ghosts — lag to the right behind the arriving train, then vanish.
      ...newGhosts.flatMap((g, j) => {
        const d = dur * (1 + 0.30 * (j + 1));
        return [g.node.x(REST_X, d, easeOutCubic), g.node.opacity(0, d, linear)];
      }),
    );

    oldV.mc.node.remove();
    [...oldGhosts, ...newGhosts].forEach(g => g.node.remove());
  }

  // ── Arrival — the first version and the anchor settle in, readable. ───────
  versions[0].mc.node.opacity(0);
  versions[0].mc.node.x(REST_X + OFF);
  yield* all(
    versions[0].mc.node.x(REST_X, 0.7, easeOutCubic),
    versions[0].mc.node.opacity(1, 0.6, easeOutCubic),
    anchor.node.opacity(1, 0.6, easeOutCubic),
  );
  yield* waitFor(2.0);

  // ── The passes — sparse at first, then faster and faster. ─────────────────
  const STEPS = [
    {dur: 0.50, hold: 1.40},
    {dur: 0.40, hold: 0.85},
    {dur: 0.30, hold: 0.50},
    {dur: 0.22, hold: 0.30},
    {dur: 0.16, hold: 0.00},   // last, fastest — into the dead stop
  ];
  for (let i = 0; i < STEPS.length; i++) {
    yield* pass(versions[i], versions[i + 1], STEPS[i].dur);
    if (STEPS[i].hold > 0) yield* waitFor(STEPS[i].hold);
  }

  // ── Dead stop. Silence on the overgrown final method. ─────────────────────
  const final = versions[versions.length - 1];
  yield* waitFor(0.9);

  // The final version owns its anchor lines again; the overlay hands off and
  // fades. A slight pull-back — only as far as needed to fit the longer method
  // — centred on the whole method so the signature isn't clipped.
  const aFin = final.code.split('\n').indexOf(ANCHOR_LINE);
  final.mc.getLine(aFin)?.node.opacity(1);
  final.mc.getLine(aFin + 1)?.node.opacity(1);

  const finalScale = Math.min(1, FINAL_BUDGET / ((final.code.split('\n').length - 1) * LH));
  const finalFlowY = -final.y * finalScale;
  yield* all(
    anchor.node.opacity(0, 0.5, easeInOutSine),
    flow().scale(finalScale, 1.1, easeInOutSine),
    flow().position.y(finalFlowY, 1.1, easeInOutSine),
  );
  yield* waitFor(0.6);

  // Every `fromImport` occurrence, lit top-to-bottom then held together.
  const flagTokens = final.code
    .split('\n')
    .map((line, i) => (line.includes('fromImport') ? final.mc.getLine(i) : null))
    .map(cl => cl?.tokens.find(td => td.text === 'fromImport')?.ref())
    .filter((t): t is NonNullable<typeof t> => !!t);

  for (const t of flagTokens) {
    yield* all(
      t.fill(AMBER, 0.26, easeInOutSine),
      t.shadowColor(AMBER_GLOW, 0.26),
      t.shadowBlur(14, 0.26),
    );
    yield* waitFor(0.12);
  }

  yield* waitFor(0.5);
  yield* all(...flagTokens.map(t => t.shadowBlur(22, 0.55, easeInOutSine)));
  yield* all(...flagTokens.map(t => t.shadowBlur(13, 0.7, easeInOutSine)));
  yield* waitFor(3.6);

  yield* flow().opacity(0, 1.0, easeInOutSine);
  yield* waitFor(0.3);
});
