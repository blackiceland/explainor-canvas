import {Node, Rect, Txt, blur, makeScene2D} from '@motion-canvas/2d';
import {
    ThreadGenerator,
    all,
    createRef,
    createSignal,
    easeInCubic,
    easeInOutCubic,
    easeOutCubic,
    waitFor,
} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {SyntaxTheme} from '../core/code/model/SyntaxTheme';

const F_MONO  = '"JetBrains Mono", "Monaspace Argon", monospace';
const F_SERIF = 'Newsreader, EB Garamond, serif';

const VIEW_W = 1080;
const VIEW_H = 1920;

const BG       = '#151A28';
const INK      = '#E7E1D6';
const KEY      = '#CAB4EA';
const DOMAIN   = '#8AC7EF';
const STRING   = '#A8CF98';
const PUNC     = '#D2D8E2';
const OPERATOR = '#8F9AAA';
const QUIET    = 'rgba(231, 225, 214, 0.50)';
const ACCENT   = '#E8C656';

const CODE_X = 20;

const THEME: SyntaxTheme = {
    keyword:     INK,
    type:        DOMAIN,
    string:      STRING,
    number:      INK,
    operator:    OPERATOR,
    punctuation: PUNC,
    method:      INK,
    comment:     QUIET,
    annotation:  INK,
    constant:    DOMAIN,
    plain:       INK,
};

const RULES: ColorRule[] = [
    {match: /^(function|const|let|var|return|if|else|await|async|throw|new)$/, color: KEY},
    {match: /^(sendMessage|render|send|track|canReceiveMarketing|persistOtp|auditOtpSent)$/, color: DOMAIN},
    {match: /^(quietHours|frequencyCap)$/, color: DOMAIN},
];

const FLAT_CARD = {
    radius: 0,
    fill: 'rgba(0,0,0,0)',
    stroke: 'rgba(0,0,0,0)',
    strokeWidth: 0,
    shadowColor: 'rgba(0,0,0,0)',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    edge: false,
} as const;

// ── Code states ─────────────────────────────────────────────────────

const S1_CLEAN = `function sendMessage(user, template, payload) {
  const message = render(template, payload)
  const delivery = send(user.phone, message)
  track(user, message, delivery)

  return delivery
}`;

const S2_KIND = `function sendMessage(user, kind, template, payload) {
  const message = render(template, payload)
  const delivery = send(user.phone, message)
  track(user, message, delivery)

  return delivery
}`;

const S3_FIRST_GUARD = `function sendMessage(user, kind, template, payload) {
  if (kind === "marketing" && !canReceiveMarketing(user)) return

  const message = render(template, payload)
  const delivery = send(user.phone, message)
  track(user, message, delivery)

  return delivery
}`;

const S4_THREE_GUARDS = `function sendMessage(user, kind, template, payload) {
  if (kind === "marketing" && !canReceiveMarketing(user)) return
  if (kind === "marketing" && quietHours.active(user)) return
  if (kind === "marketing" && frequencyCap.exceeded(user)) return

  const message = render(template, payload)
  const delivery = send(user.phone, message)
  track(user, message, delivery)

  return delivery
}`;

const S5_PRE_SECURITY = `function sendMessage(user, kind, template, payload) {
  if (kind === "marketing" && !canReceiveMarketing(user)) return
  if (kind === "marketing" && quietHours.active(user)) return
  if (kind === "marketing" && frequencyCap.exceeded(user)) return

  if (kind === "security") {
    persistOtp(user, payload.code, "5m")
  }

  const message = render(template, payload)
  const delivery = send(user.phone, message)
  track(user, message, delivery)

  return delivery
}`;

const S6_TEMPLATE_BRANCH = `function sendMessage(user, kind, payload) {
  if (kind === "marketing" && !canReceiveMarketing(user)) return
  if (kind === "marketing" && quietHours.active(user)) return
  if (kind === "marketing" && frequencyCap.exceeded(user)) return

  if (kind === "security") {
    persistOtp(user, payload.code, "5m")
  }

  const template =
    kind === "security" ? "login.code" : "cart.reminder"

  const message = render(template, payload)
  const delivery = send(user.phone, message)
  track(user, message, delivery)

  return delivery
}`;

const S7_POST_SECURITY = `function sendMessage(user, kind, payload) {
  if (kind === "marketing" && !canReceiveMarketing(user)) return
  if (kind === "marketing" && quietHours.active(user)) return
  if (kind === "marketing" && frequencyCap.exceeded(user)) return

  if (kind === "security") {
    persistOtp(user, payload.code, "5m")
  }

  const template =
    kind === "security" ? "login.code" : "cart.reminder"

  const message = render(template, payload)
  const delivery = send(user.phone, message)

  if (kind === "security") {
    auditOtpSent(user, delivery)
  }

  track(user, message, delivery)
  return delivery
}`;

function applyGlow(block: Manticore): void {
    const glowMap: Record<string, string> = {
        [KEY]:    'rgba(202, 180, 234, 0.13)',
        [DOMAIN]: 'rgba(138, 199, 239, 0.13)',
        [STRING]: 'rgba(168, 207, 152, 0.13)',
    };
    for (let i = 0; i < block.lineCount; i++) {
        const line = block.getLine(i);
        if (!line) continue;
        for (const tokenData of line.tokens) {
            const node = tokenData.ref();
            const fill = String(node.fill());
            const glow = glowMap[fill];
            if (glow) {
                node.shadowColor(glow);
                node.shadowBlur(8);
                node.shadowOffset([0, 0]);
            } else {
                node.shadowColor('rgba(0, 0, 0, 0.30)');
                node.shadowBlur(6);
                node.shadowOffset([0, 1]);
            }
        }
    }
}

function bumpWeight(block: Manticore, weight: number): void {
    for (let i = 0; i < block.lineCount; i++) {
        const line = block.getLine(i);
        if (!line) continue;
        for (const tokenData of line.tokens) {
            tokenData.ref().fontWeight(weight);
        }
    }
}

function* awaitFontsReady(): ThreadGenerator {
    if (typeof document === 'undefined') return;
    try {
        document.fonts.load(`400 28px "JetBrains Mono"`);
        document.fonts.load(`500 28px "JetBrains Mono"`);
        document.fonts.load(`400 72px "Newsreader"`);
    } catch {}
    for (let i = 0; i < 60; i++) {
        if (document.fonts.check(`400 28px "JetBrains Mono"`)) return;
        yield* waitFor(0.05);
    }
}

export default makeScene2D(function* (view) {
    yield* awaitFontsReady();

    view.add(<Rect width={VIEW_W} height={VIEW_H} fill={BG} />);

    const FS = 28;
    const LH = 38;

    const code = Manticore.create(S1_CLEAN, {
        x: CODE_X, y: 0,
        width: 1080,
        fontSize: FS, lineHeight: LH,
        fontFamily: F_MONO,
        theme: THEME,
        cardStyle: FLAT_CARD,
        glowAccent: false,
        noClip: true,
    });
    code.mount(view);
    bumpWeight(code, 500);
    code.colorize(RULES);
    applyGlow(code);

    // ── Soft reveal from left ───────────────────────────────────────
    const SHIFT = 10;
    const blurSig = createSignal(8);
    code.node.filters(() => [blur(blurSig())]);
    code.node.opacity(0);
    code.node.x(CODE_X - SHIFT);

    yield* all(
        code.node.opacity(1, 0.7, easeOutCubic),
        blurSig(0, 0.7, easeOutCubic),
        code.node.x(CODE_X, 0.7, easeOutCubic),
    );
    code.node.filters([]);
    yield* waitFor(1.5);

    // ── S2: kind parameter ──────────────────────────────────────────
    yield* code.morphTo(S2_KIND, {
        addStyle: 'typewriter', charDelay: 0.015, lineDelay: 0.03,
        moveDuration: 0.3, removeDuration: 0.2,
    });
    code.colorize(RULES);
    applyGlow(code);
    yield* waitFor(1.2);

    // ── S3: first marketing guard ───────────────────────────────────
    yield* code.morphTo(S3_FIRST_GUARD, {
        addStyle: 'typewriter', charDelay: 0.015, lineDelay: 0.03,
        moveDuration: 0.3, removeDuration: 0.2,
    });
    code.colorize(RULES);
    applyGlow(code);
    yield* waitFor(1.2);

    // ── S4: three guards ────────────────────────────────────────────
    yield* code.morphTo(S4_THREE_GUARDS, {
        addStyle: 'typewriter', charDelay: 0.015, lineDelay: 0.03,
        moveDuration: 0.3, removeDuration: 0.2,
    });
    code.colorize(RULES);
    applyGlow(code);
    yield* waitFor(1.5);

    // ── S5: security pre-send block ─────────────────────────────────
    yield* code.morphTo(S5_PRE_SECURITY, {
        addStyle: 'typewriter', charDelay: 0.015, lineDelay: 0.03,
        moveDuration: 0.3, removeDuration: 0.2,
    });
    code.colorize(RULES);
    applyGlow(code);
    yield* waitFor(1.2);

    // ── S6: template becomes conditional ────────────────────────────
    yield* code.morphTo(S6_TEMPLATE_BRANCH, {
        addStyle: 'typewriter', charDelay: 0.015, lineDelay: 0.03,
        moveDuration: 0.3, removeDuration: 0.2,
    });
    code.colorize(RULES);
    applyGlow(code);
    yield* waitFor(1.2);

    // ── S7: post-send security audit ────────────────────────────────
    yield* code.morphTo(S7_POST_SECURITY, {
        addStyle: 'typewriter', charDelay: 0.015, lineDelay: 0.03,
        moveDuration: 0.3, removeDuration: 0.2,
    });
    code.colorize(RULES);
    applyGlow(code);
    yield* waitFor(3.0);

    yield* waitFor(1.0);
});
