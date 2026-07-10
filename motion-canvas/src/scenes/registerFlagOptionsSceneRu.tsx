import {Node, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
  all,
  createRef,
  easeInOutCubic,
  easeInOutSine,
  makeRef,
  waitFor,
} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';
import {Manticore} from '../core/code/components/Manticore';
import {
  Canon,
  CanonCodeTheme,
  buildCanonRules,
  paintCanonParams,
  paintCanonMethodCalls,
} from '../core/code/model/paletteCanon';

const IMPORT = Canon.constant;              // тил — путь import
const SIGNUP = Canon.methodDef;             // rose — путь sign-up
const INK    = '#F4F1EB';
const INK70  = 'rgba(244,241,235,0.70)';
const DIMTXT = 'rgba(244,241,235,0.42)';
const DIMLINE = 0.2;                        // приглушённые строки

const L = [
  /* 0*/ '@Transactional',
  /* 1*/ 'fun register(',
  /* 2*/ '    command: RegisterCustomer,',
  /* 3*/ '    fromImport: Boolean,',
  /* 4*/ '): Customer {',
  /* 5*/ '    var email = command.email',
  /* 6*/ '',
  /* 7*/ '    if (email != null) {',
  /* 8*/ '        email = email.trim().lowercase()',
  /* 9*/ '    }',
  /*10*/ '',
  /*11*/ '    if (!fromImport && email == null) {',
  /*12*/ '        throw EmailRequired()',
  /*13*/ '    }',
  /*14*/ '',
  /*15*/ '    var existing: Customer? = null',
  /*16*/ '',
  /*17*/ '    if (email != null) {',
  /*18*/ '        existing = customers.findByEmail(email)',
  /*19*/ '    }',
  /*20*/ '',
  /*21*/ '    if (existing != null) {',
  /*22*/ '        if (fromImport) {',
  /*23*/ '            return existing',
  /*24*/ '        }',
  /*25*/ '',
  /*26*/ '        throw CustomerAlreadyExists(existing.id)',
  /*27*/ '    }',
  /*28*/ '',
  /*29*/ '    var source = CustomerSource.SIGN_UP',
  /*30*/ '    var verified = command.emailVerified',
  /*31*/ '    var status = CustomerStatus.PENDING',
  /*32*/ '',
  /*33*/ '    if (fromImport) {',
  /*34*/ '        source = CustomerSource.IMPORT',
  /*35*/ '        verified = true',
  /*36*/ '        status = CustomerStatus.ACTIVE',
  /*37*/ '    }',
  /*38*/ '',
  /*39*/ '    val customer = Customer(',
  /*40*/ '        email = email,',
  /*41*/ '        source = source,',
  /*42*/ '        verified = verified,',
  /*43*/ '        status = status,',
  /*44*/ '    )',
  /*45*/ '',
  /*46*/ '    val saved = customers.save(customer)',
  /*47*/ '',
  /*48*/ '    if (!fromImport) {',
  /*49*/ '        verification.start(saved.id)',
  /*50*/ '        outbox.add(CustomerRegistered(saved.id))',
  /*51*/ '        welcomeMessages.schedule(saved.id)',
  /*52*/ '    }',
  /*53*/ '',
  /*54*/ '    return saved',
  /*55*/ '}',
];

const TYPES = ['RegisterCustomer', 'Customer', 'Boolean', 'EmailRequired',
  'CustomerAlreadyExists', 'CustomerSource', 'CustomerStatus', 'CustomerRegistered'];
const RULES = [
  ...buildCanonRules({
    types: TYPES,
    methods: ['register', 'trim', 'lowercase', 'findByEmail', 'save', 'start', 'add', 'schedule'],
    vars: ['command', 'email', 'existing', 'source', 'verified', 'status', 'customer',
      'saved', 'customers', 'verification', 'outbox', 'welcomeMessages', 'fromImport',
      'id', 'emailVerified'],
  }),
  {match: /^@Transactional$/, color: Canon.keyword},
];

const CODE_X = -360;
const LH = 36;
const HALF = (L.length - 1) / 2;           // 27.5
// node.y, чтобы строка c оказалась в центре кадра
const PAN = (c: number): number => (HALF - c) * LH;

// Развилки: строки в фокусе, строка-условие, сторона, подпись.
const BEATS = [
  {focus: [11, 12, 13], fork: 11, center: 12, side: SIGNUP, label: 'sign-up · требует email'},
  {focus: [21, 22, 23, 24], fork: 22, center: 22, side: IMPORT, label: 'import · молча вернуть дубль'},
  {focus: [33, 34, 35, 36, 37], fork: 33, center: 35, side: IMPORT, label: 'import · другой source / status'},
  {focus: [48, 49, 50, 51, 52], fork: 48, center: 50, side: SIGNUP, label: 'sign-up · побочные эффекты'},
];

export default makeScene2D(function* (view) {
  applyBackground(view);

  const mc = Manticore.create(L.join('\n'), {
    x: CODE_X, y: 0, width: 1120,
    fontSize: 25, lineHeight: LH, fontFamily: Fonts.code,
    theme: CanonCodeTheme, noClip: true, glowAccent: false,
    cardStyle: {
      radius: 0, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)', strokeWidth: 0,
      edge: false, opacity: 0, shadowBlur: 0, shadowColor: 'rgba(0,0,0,0)',
      shadowOffsetX: 0, shadowOffsetY: 0,
    },
    customTypes: TYPES,
  });
  mc.mount(view);
  mc.colorize(RULES);
  paintCanonParams(mc);
  paintCanonMethodCalls(mc);

  view.add(
    <Txt x={0} y={-500} text={'FLAG ARGUMENT · fromImport: Boolean'}
         fontFamily={Fonts.primary} fontSize={22} letterSpacing={2} fill={DIMTXT} />,
  );

  // Правый бортик: 4 маркера-развилки (загораются по мере скролла).
  const mark: Rect[] = [];
  const markX = [600, 680, 760, 840];
  view.add(
    <Node>
      {markX.map((x, i) => (
        <Rect ref={makeRef(mark, i)} x={x} y={-340} width={30} height={30} radius={7}
              fill={'rgba(244,241,235,0.14)'} />
      ))}
    </Node>,
  );

  // Боковая подпись развилки (у центра кадра, справа от кода).
  const side = createRef<Txt>();
  view.add(
    <Txt ref={side} x={300} y={0} offset={[-1, 0]} text={''} fontFamily={Fonts.code}
         fontSize={27} letterSpacing={1} fill={INK} opacity={0} />,
  );
  const cap = createRef<Txt>();
  view.add(
    <Txt ref={cap} x={360} y={30} width={620} textAlign={'center'}
         text={'1 флаг → 4 развилки → 2 метода в одном'}
         fontFamily={Fonts.primary} fontSize={30} letterSpacing={1} fill={INK} opacity={0} />,
  );

  const dimExcept = (focus: number[], dur: number) =>
    L.map((_, i) => mc.getLine(i)!.node.opacity(focus.includes(i) ? 1 : DIMLINE, dur, easeInOutSine));

  // ── Intro: зум в начало метода, подсветка флаг-аргумента ──────────────
  mc.node.position.y(PAN(3));
  mc.node.scale(1.06);
  yield* mc.node.opacity(1, 0.7, easeInOutSine);
  yield* mc.node.scale(1, 0.7, easeInOutCubic);
  yield* waitFor(0.4);

  side().text('флаг-аргумент');
  side().fill(INK70);
  yield* all(
    ...dimExcept([1, 2, 3, 4], 0.6),
    mc.getLine(3)!.colorizeByRuleAnimated('fromImport', INK, 0.5),
    side().opacity(1, 0.5),
  );
  yield* waitFor(1.4);

  // ── Скролл к каждой развилке + подсветка ──────────────────────────────
  for (let b = 0; b < BEATS.length; b++) {
    const beat = BEATS[b];
    yield* all(
      mc.node.position.y(PAN(beat.center), 1.0, easeInOutCubic),
      ...dimExcept(beat.focus, 1.0),
      side().opacity(0, 0.4),
    );
    side().text(beat.label);
    side().fill(beat.side);
    yield* all(
      mc.getLine(beat.fork)!.colorizeByRuleAnimated('fromImport', beat.side, 0.4),
      mark[b].fill(beat.side, 0.4),
      mark[b].scale(1.18, 0.3, easeInOutCubic),
      side().opacity(1, 0.5),
    );
    yield* waitFor(1.7);
  }

  // ── Zoom-out: весь метод целиком, развилки покрашены — «два метода» ────
  yield* all(
    side().opacity(0, 0.4),
    mc.node.position.y(0, 1.2, easeInOutCubic),
    mc.node.scale(0.5, 1.2, easeInOutCubic),
    ...L.map((_, i) => mc.getLine(i)!.node.opacity(1, 1.0, easeInOutSine)),
  );
  yield* cap().opacity(1, 0.6);
  yield* waitFor(2.2);
});
