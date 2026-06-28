import {makeScene2D} from '@motion-canvas/2d';
import {Circle, Gradient, blur} from '@motion-canvas/2d';
import {all, createRef, createSignal, easeInOutSine, Vector2, waitFor} from '@motion-canvas/core';
import {CodeLine} from '../core/code/components/CodeLine';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';
import {
  CODE_RULES,
  CUSTOM_TYPES,
  TRANSPARENT_CARD,
  METHOD_COLOR,
  FUN_BLUE,
  TYPE_CLEAN,
  PARAM_DARK,
  NAMES_Y,
  SPOT_R,
} from './fiveFacesBooleanV2Setup';

// ─────────────────────────────────────────────────────────────────────────
// A standalone thesis scene, not one of the five faces. It carries the
// spotlight ("фонарь") out of the SAFETY ending as a transition, lands it on
// the hero — the sendMessage signature — and then walks the SAME innocent call
// through the three ways a Boolean betrays it (computed wrong, swapped,
// silently re-defaulted), the half-cure (named args), and the real cure
// (named types). The whole point is that the call keeps looking correct, so a
// single call Manticore MORPHS through every disguise rather than being
// swapped for a fresh one.
// ─────────────────────────────────────────────────────────────────────────

// ── The hero: the final signature, two of its params still Boolean ──────
const SIG = `fun sendMessage(
    user: User,
    text: String,
    urgent: Boolean,
    silent: Boolean = false,
)`;

// Beat 3: someone flips the default. Only the last line changes.
const SIG_DEFAULT_TRUE = `fun sendMessage(
    user: User,
    text: String,
    urgent: Boolean,
    silent: Boolean = true,
)`;

// The cure: each decision gets a name and its own type.
const SIG_ENUM = `fun sendMessage(
    user: User,
    text: String,
    urgency: Urgency,
    notificationMode: NotificationMode,
)`;

// ── The one call, in every disguise ─────────────────────────────────────
// Beat 1 — the value is computed; nobody types true by hand.
const CALL_COMPUTED = `sendMessage(
    user,
    text,
    user.plan == "premium",
)`;
// premium → pro (the tariff was renamed)
const CALL_COMPUTED_PRO = `sendMessage(
    user,
    text,
    user.plan == "pro",
)`;
// …so the expression is now always false. urgent silently became false.
const CALL_COMPUTED_FALSE = `sendMessage(
    user,
    text,
    false,
)`;

// Beat 2 — several booleans; which is which. Compact, so the swap is invisible.
const CALL_SWAP_A = `sendMessage(user, text, true, false)`;
const CALL_SWAP_B = `sendMessage(user, text, false, true)`;

// Beat 3 — the value isn't even there; the call relies on the default.
const CALL_DEFAULT = `sendMessage(user, text, true)`;

// Half-cure — named args. Fixes the swap; does nothing for the other two.
const CALL_NAMED = `sendMessage(
    user = user,
    text = text,
    urgent = true,
    silent = false,
)`;

// Cure — the values are named decisions now, each from its own type.
const CALL_ENUM = `sendMessage(
    user,
    text,
    urgency = Urgency.URGENT,
    notificationMode = NotificationMode.SOUND,
)`;

// ── The named types the cure introduces ─────────────────────────────────
const ENUMS = `enum class Urgency {
    REGULAR,
    URGENT,
}

enum class NotificationMode {
    SOUND,
    SILENT,
}`;

// ── Colouring ───────────────────────────────────────────────────────────
const SCENE_TYPES = [...CUSTOM_TYPES, 'Urgency', 'NotificationMode', 'String'];
const SCENE_RULES: ColorRule[] = [
  ...CODE_RULES,
  {match: /^enum$/, color: FUN_BLUE},
  // sendMessage isn't in the shared method list; force the method colour.
  {match: /^sendMessage$/, color: METHOD_COLOR},
  // These types aren't in the shared CUSTOM_TYPES the tokenizer was built with,
  // so pin them to the type colour by text.
  {match: /^(Urgency|NotificationMode|String)$/, color: TYPE_CLEAN},
];

// Call-site named arguments (the identifier on the LHS of `=`) take the slate
// param colour — same idiom as the shared paintNamedParams, with this scene's
// own parameter names.
const CALL_NAMED_LIST = ['user', 'text', 'urgent', 'silent', 'urgency', 'notificationMode'];
const paintCallNamedLine = (line: CodeLine): void => {
  const toks = line.tokens;
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    if (!CALL_NAMED_LIST.includes(tok.text)) continue;
    let p = i - 1;
    while (p >= 0 && toks[p].text.trim() === '') p--;
    const prev = p >= 0 ? toks[p].text.trim() : '';
    if (prev === 'val' || prev === 'var') continue;
    let n = i + 1;
    while (n < toks.length && toks[n].text.trim() === '') n++;
    if (n < toks.length && toks[n].text.trim() === '=') {
      tok.ref().fill(PARAM_DARK);
    }
  }
};
const paintCallNamed = (code: Manticore): void => {
  for (let i = 0; i < code.lineCount; i++) {
    const line = code.getLine(i);
    if (line) paintCallNamedLine(line);
  }
};

// ── Layout ──────────────────────────────────────────────────────────────
const FS = 30;
const LH = 44;
const COL_W = 660;

// Problem section: signature top, the one call below, both centred.
const CENTER_X = 40;
const SIG_Y    = -150;
const CALL_Y   = 150;

// Cure section: re-laid into two columns — named types on the left, the API
// (signature + honest call) on the right.
const LEFT_X  = -430;
const RIGHT_X = 320;
const ENUM_Y  = 0;
const SIG_R_Y = -150;
const CALL_R_Y = 150;

// codaY-style helper: container y that centres a noClip block at `center`.
const blockY = (src: string, center: number): number => center;

// ── Scene ────────────────────────────────────────────────────────────────
export default makeScene2D(function* (view) {
  applyBackground(view);

  // ── Spotlight — same radial `screen` glow as the five-faces stage, so it
  // reads as the SAME light that just closed the SAFETY scene. Parked where
  // SAFETY left it (centre of the names row), it glides down onto the hero.
  const lightX = createSignal(0);
  const lightY = createSignal(NAMES_Y - 6);   // -456, the SAFETY parking spot

  const spot = createRef<Circle>();
  view.add(
    <Circle
      ref={spot}
      x={() => lightX()}
      y={() => lightY()}
      width={SPOT_R * 2}
      height={SPOT_R * 2}
      compositeOperation={'screen'}
      fill={new Gradient({
        type: 'radial',
        from: new Vector2(0, 0),
        to: new Vector2(0, 0),
        fromRadius: 0,
        toRadius: SPOT_R,
        stops: [
          {offset: 0.00, color: 'rgba(244, 241, 235, 0.55)'},
          {offset: 0.28, color: 'rgba(244, 241, 235, 0.22)'},
          {offset: 0.62, color: 'rgba(244, 241, 235, 0.05)'},
          {offset: 1.00, color: 'rgba(0, 0, 0, 0)'},
        ],
      })}
    />,
  );

  // ── Signature (the hero) ──────────────────────────────────────────────
  const sig = Manticore.create(SIG, {
    x: CENTER_X,
    y: SIG_Y,
    width: COL_W,
    fontSize: FS,
    lineHeight: LH,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    noClip: true,
    cardStyle: TRANSPARENT_CARD,
    glowAccent: false,
    customTypes: SCENE_TYPES,
  });
  sig.mount(view);
  sig.colorize(SCENE_RULES);
  sig.node.opacity(0);
  const sigBlur = createSignal(10);
  sig.node.cache(true);
  sig.node.cachePadding(60);
  sig.node.filters(() => [blur(sigBlur())]);

  // ── The one call ──────────────────────────────────────────────────────
  const call = Manticore.create(CALL_COMPUTED, {
    x: CENTER_X,
    y: CALL_Y,
    width: COL_W,
    fontSize: FS,
    lineHeight: LH,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    noClip: true,
    cardStyle: TRANSPARENT_CARD,
    glowAccent: false,
    customTypes: SCENE_TYPES,
  });
  call.mount(view);
  call.colorize(SCENE_RULES);
  call.node.opacity(0);
  const callBlur = createSignal(10);
  call.node.cache(true);
  call.node.cachePadding(60);
  call.node.filters(() => [blur(callBlur())]);

  const morphOpts = {
    removeDuration: 0.22,
    moveDuration: 0.34,
    charDelay: 0.012,
    addStyle: 'typewriter' as const,
    scrollStrategy: 'block' as const,
  };

  // Re-apply colour + re-centre after a morph (the standard settle).
  const settle = (mc: Manticore, named = false): void => {
    mc.colorize(SCENE_RULES);
    if (named) paintCallNamed(mc);
    mc.recenterContent();
  };

  // Mark a token rose on a given line — the canon "this is the dangerous bit".
  function* markDanger(mc: Manticore, lineIdx: number, token: string, dur = 0.4) {
    const line = mc.getLine(lineIdx);
    if (!line) return;
    yield* all(...line.colorizeByRuleAnimated(token, METHOD_COLOR, dur));
  }

  // ── HERO: the light finds the signature ───────────────────────────────
  yield* waitFor(0.4);
  yield* all(
    lightY(SIG_Y + 10, 1.1, easeInOutSine),
    sig.node.opacity(1, 0.9, easeInOutSine),
    sigBlur(0, 0.9, easeInOutSine),
  );
  // VO: «Финальная версия. Сигнатура.»
  yield* waitFor(2.6);

  // ── BEAT 1: the value is computed ─────────────────────────────────────
  // The light slides down to the call site and reveals it.
  yield* all(
    lightY(CALL_Y, 0.9, easeInOutSine),
    call.node.opacity(1, 0.8, easeInOutSine),
    callBlur(0, 0.8, easeInOutSine),
  );
  // VO: «Обычно никто не пишет true руками. Значение вычисляется.»
  yield* waitFor(3.2);

  // The tariff is renamed: "premium" → "pro".
  yield* call.morphTo(CALL_COMPUTED_PRO, morphOpts);
  settle(call);
  // VO: «Тариф переименовали из premium в pro…»
  yield* waitFor(2.4);

  // …so the whole expression now collapses to a constant false.
  yield* call.morphTo(CALL_COMPUTED_FALSE, morphOpts);
  settle(call);
  yield* markDanger(call, 3, 'false', 0.45);   // urgent silently became false
  // VO: «…условие всегда возвращает false. Сообщение больше не срочное,
  //      но вызов выглядит совершенно нормально.»
  yield* waitFor(3.4);

  // ── BEAT 2: two booleans, swapped ─────────────────────────────────────
  // Collapse to the compact call where two booleans sit side by side.
  yield* call.morphTo(CALL_SWAP_A, morphOpts);
  settle(call);
  // VO: «А когда булеанов несколько, появляется другая проблема. Какой из них
  //      отвечает за срочность, а какой — за звук.»
  yield* waitFor(3.6);

  // The values are swapped. The shape is identical — that is the whole danger.
  yield* call.morphTo(CALL_SWAP_B, morphOpts);
  settle(call);
  yield* markDanger(call, 0, 'true', 0.4);
  // VO: «Значения поменяли местами, компилятор ничего не заметил. Срочное
  //      сообщение ушло беззвучно.»
  yield* waitFor(3.6);

  // ── BEAT 3: an unexpected default ─────────────────────────────────────
  // The call drops the last argument — it leans on the default now.
  yield* call.morphTo(CALL_DEFAULT, morphOpts);
  settle(call);
  // VO: «Иногда ошибочного значения вообще нет. Параметр просто не передали.»
  yield* waitFor(3.0);

  // The danger moves far from the call: the SIGNATURE's default is flipped.
  // The call doesn't change at all — its behaviour does.
  yield* all(
    lightY(SIG_Y + 10, 0.7, easeInOutSine),
  );
  yield* sig.morphTo(SIG_DEFAULT_TRUE, morphOpts);
  sig.colorize(SCENE_RULES);
  sig.recenterContent();
  yield* markDanger(sig, 4, 'true', 0.45);
  // VO: «Кто-то изменил дефолт silent с false на true, и старый вызов молча
  //      поменял поведение. Вызов остаётся прежним.»
  yield* waitFor(3.6);

  // ── CONNECTOR: to the compiler, any Boolean is a valid value ──────────
  // Glow both Boolean types in the signature — the type accepts anything.
  yield* all(
    ...(sig.getLine(3)?.colorizeByRuleAnimated('Boolean', METHOD_COLOR, 0.5) ?? []),
    ...(sig.getLine(4)?.colorizeByRuleAnimated('Boolean', METHOD_COLOR, 0.5) ?? []),
  );
  // VO: «Значение вычислилось неверно. Два параметра перепутали. Дефолт
  //      изменился. И каждый раз вызов выглядит корректно, потому что для
  //      компилятора любой Boolean — допустимое значение.»
  yield* waitFor(4.4);
  // Release the marks back to the type colour.
  yield* all(
    ...(sig.getLine(3)?.colorizeByRuleAnimated('Boolean', TYPE_CLEAN, 0.5) ?? []),
    ...(sig.getLine(4)?.colorizeByRuleAnimated('Boolean', TYPE_CLEAN, 0.5) ?? []),
  );

  // ── HALF-CURE: named arguments ────────────────────────────────────────
  yield* all(
    lightY(CALL_Y, 0.7, easeInOutSine),
  );
  yield* call.morphTo(CALL_NAMED, {...morphOpts, recolorLine: paintCallNamedLine});
  settle(call, true);
  // VO: «В Kotlin именованные аргументы защищают от перестановки и делают
  //      вызов понятнее. Но они не проверят, правильно ли вычислено значение,
  //      и не спасут от скрытого дефолта.»
  yield* waitFor(4.2);

  // ── CURE: name the decision, give it a type ───────────────────────────
  // Re-lay into two columns: slide the API to the right, opening the left for
  // the named types.
  yield* all(
    sig.node.position.x(RIGHT_X, 0.9, easeInOutSine),
    sig.node.position.y(SIG_R_Y, 0.9, easeInOutSine),
    call.node.position.x(RIGHT_X, 0.9, easeInOutSine),
    call.node.position.y(CALL_R_Y, 0.9, easeInOutSine),
    lightX(LEFT_X, 0.9, easeInOutSine),
    lightY(ENUM_Y, 0.9, easeInOutSine),
  );

  // The two named types develop in as one (focus-pull), on the left.
  const enums = Manticore.create(ENUMS, {
    x: LEFT_X,
    y: blockY(ENUMS, ENUM_Y),
    width: COL_W,
    fontSize: FS,
    lineHeight: LH,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    noClip: true,
    cardStyle: TRANSPARENT_CARD,
    glowAccent: false,
    customTypes: SCENE_TYPES,
  });
  enums.mount(view);
  enums.colorize(SCENE_RULES);
  enums.node.opacity(0);
  const enumBlur = createSignal(10);
  enums.node.cache(true);
  enums.node.cachePadding(60);
  enums.node.filters(() => [blur(enumBlur())]);

  yield* all(
    enums.node.opacity(1, 0.8, easeInOutSine),
    enumBlur(0, 0.8, easeInOutSine),
  );
  // VO: «Если параметр представляет важное решение, не прячь его за true или
  //      false. Дай этому решению имя и собственный тип.»
  yield* waitFor(3.4);

  // The signature adopts the named types — booleans gone.
  yield* all(
    lightX(RIGHT_X, 0.8, easeInOutSine),
    lightY(SIG_R_Y + 10, 0.8, easeInOutSine),
  );
  yield* sig.morphTo(SIG_ENUM, morphOpts);
  sig.colorize(SCENE_RULES);
  sig.recenterContent();
  yield* waitFor(2.2);

  // And the call names its decisions — Urgency.URGENT, NotificationMode.SOUND.
  // These can't be swapped (distinct types), can't be silently re-defaulted,
  // and read themselves out loud.
  yield* all(
    lightY(CALL_R_Y, 0.8, easeInOutSine),
  );
  yield* call.morphTo(CALL_ENUM, {...morphOpts, recolorLine: paintCallNamedLine});
  settle(call, true);
  yield* waitFor(2.6);

  // ── Final tableau — the фонарь reads the solution left → right, then holds
  // on the named values: the decision now has a name.
  yield* lightX(LEFT_X, 1.0, easeInOutSine);
  yield* waitFor(1.0);
  yield* lightX(RIGHT_X, 1.4, easeInOutSine);
  yield* waitFor(2.6);

  // Close.
  yield* all(
    sig.node.opacity(0, 0.8, easeInOutSine),
    call.node.opacity(0, 0.8, easeInOutSine),
    enums.node.opacity(0, 0.8, easeInOutSine),
    spot().opacity(0, 0.8, easeInOutSine),
  );
  yield* waitFor(0.6);
});
