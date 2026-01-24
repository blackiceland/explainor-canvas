import {Code, makeScene2D, Node} from '@motion-canvas/2d';
import {all, createRef, createSignal, easeInOutCubic, map, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Colors, Fonts, Timing} from '../core/theme';
import {SafeZone} from '../core/ScreenGrid';
import {textWidth} from '../core/utils/textMeasure';

type MergePair = {
  left: string;
  right: string;
};

function fitFontSize(
  text: string,
  maxWidthPx: number,
  fontFamily: string,
  maxFontSize: number,
  minFontSize: number,
  fontWeight: number = 600,
): number {
  const lines = text.split('\n');
  const maxW = Math.max(1, maxWidthPx);
  let lo = Math.max(1, Math.floor(minFontSize));
  let hi = Math.max(lo, Math.floor(maxFontSize));

  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    // Check if ALL lines fit with this font size
    const allFit = lines.every(
      line => textWidth(line, fontFamily, mid, fontWeight) <= maxW,
    );
    if (allFit) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return lo;
}

function maxLineWidth(
  text: string,
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
): number {
  const lines = text.split('\n');
  let max = 0;
  for (const line of lines) {
    max = Math.max(max, textWidth(line, fontFamily, fontSize, fontWeight));
  }
  return max;
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  const stage = createRef<Node>();
  view.add(<Node ref={stage} />);

  // Text signals
  const leftText = createSignal('');
  const rightText = createSignal('');

  const leftSize = createSignal(96);
  const rightSize = createSignal(96);

  const leftX = createSignal(0);
  const rightX = createSignal(0);

  const leftOn = createSignal(0);
  const rightOn = createSignal(0);

  const y = -40;
  const sideMargin = 56;
  const baseInk = '#F6E7D4'; // match chapter1IntroScene title color
  const bracketBlue = '#BFEAFF';
  const keywordPink = Colors.accent;

  const KEYWORDS = new Set([
    'if',
    'else',
    'return',
    'case',
    'default',
    'switch',
    'try',
    'catch',
    'finally',
    'throw',
    'new',
    'for',
    'while',
    'break',
    'continue',
  ]);

  const drawHooks = {
    token: (
      canvasCtx: CanvasRenderingContext2D,
      text: string,
      position: {x: number; y: number},
      color: string,
      selection: number,
    ) => {
      const raw = String(text ?? '');

      // Preserve default selection behavior (unselected is dimmer).
      const prevAlpha = canvasCtx.globalAlpha;
      canvasCtx.globalAlpha *= map(0.2, 1, selection);

      // Token-level hook can still receive multi-token chunks (e.g. "return foo();").
      // We split the chunk and draw sub-segments with their own colors.
      let x = position.x;
      const y = position.y;

      const flush = (seg: string, segColor: string) => {
        if (seg.length === 0) return;
        canvasCtx.fillStyle = segColor;
        canvasCtx.fillText(seg, x, y);
        x += canvasCtx.measureText(seg).width;
      };

      let i = 0;
      while (i < raw.length) {
        const ch = raw[i];

        // Curly braces only.
        if (ch === '{' || ch === '}') {
          flush(ch, bracketBlue);
          i += 1;
          continue;
        }

        // Keyword / identifier
        if (/[A-Za-z_]/.test(ch)) {
          let j = i + 1;
          while (j < raw.length && /[A-Za-z0-9_]/.test(raw[j])) j += 1;
          const word = raw.slice(i, j);
          flush(word, KEYWORDS.has(word) ? keywordPink : baseInk);
          i = j;
          continue;
        }

        // Everything else (whitespace, punctuation, numbers, quotes, etc.)
        let j = i + 1;
        while (j < raw.length) {
          const c = raw[j];
          if (c === '{' || c === '}') break;
          if (/[A-Za-z_]/.test(c)) break;
          j += 1;
        }
        flush(raw.slice(i, j), baseInk);
        i = j;
      }

      canvasCtx.globalAlpha = prevAlpha;
    },
  } satisfies Partial<{
    token: (
      canvasCtx: CanvasRenderingContext2D,
      text: string,
      position: {x: number; y: number},
      color: string,
      selection: number,
    ) => void;
  }>;

  stage().add(
    <>
      <Code
        code={() => leftText()}
        fontFamily={Fonts.code}
        fontSize={() => leftSize()}
        lineHeight={() => leftSize() * 1.35}
        opacity={() => leftOn()}
        x={() => leftX()}
        y={y}
        drawHooks={drawHooks}
      />
      <Code
        code={() => rightText()}
        fontFamily={Fonts.code}
        fontSize={() => rightSize()}
        lineHeight={() => rightSize() * 1.35}
        opacity={() => rightOn()}
        x={() => rightX()}
        y={y}
        drawHooks={drawHooks}
      />
    </>,
  );

  const halfWidth = (SafeZone.right - SafeZone.left) / 2;
  const sideMaxWidth = halfWidth - sideMargin * 2;

  const pairs: MergePair[] = [
    // First five iterations: strictly identical left/right.
    // (Different situations across iterations are fine; within one iteration it must be a clear duplicate.)
    // 1) Short (avoid any risk of cropping)
    {
      left: 'return round(total);',
      right: 'return round(total);',
    },
    // 2) Still short, different context
    {
      left: 'headers.set("X-Auth", token);',
      right: 'headers.set("X-Auth", token);',
    },
    // 3) Idempotency key (still short)
    {
      left: 'return key(id, n);',
      right: 'return key(id, n);',
    },
    // 4) Switch mapping (unique, not reused later)
    {
      left: 'case INVALID_CVV -> DECLINED;',
      right: 'case INVALID_CVV -> DECLINED;',
    },
    // 5) Multi-line duplicate
    {
      left: 'if (temporary) {\n  retry();\n}',
      right: 'if (temporary) {\n  retry();\n}',
    },
    // After the first five, we can show \"almost identical\" (max one meaningful difference).
    // 6) One-token difference (new snippet, not used above)
    {
      left: 'return round(fee);',
      right: 'return round(net);',
    },
    // 7) One-token drift (classic)
    {
      left: 'case INSUFFICIENT_FUNDS -> DECLINED;',
      right: 'case INSUFFICIENT_FUNDS -> DECLINED;',
    },
    // 8) Multi-line, one-token difference (unique; wasn't used in first five)
    {
      left: 'log.info("Charge {}", id);\nmetrics.inc("charge");',
      right: 'log.info("Refund {}", id);\nmetrics.inc("refund");',
    },
    // 9) Identical (unique)
    {
      left: 'tx.rollback();',
      right: 'tx.rollback();',
    },
    // 10) Multi-line duplicate (unique)
    {
      left: 'try {\n  charge();\n} catch (e) {\n  fail();\n}',
      right: 'try {\n  charge();\n} catch (e) {\n  fail();\n}',
    },
  ];

  function* playMerge(
    pair: MergePair,
    duration: number,
    hold: number,
    opts?: {
      /** Extra pause after fade-in, before the merge movement starts (seconds). */
      preMergeHold?: number;
      /** Override fade-in duration (seconds). */
      fadeIn?: number;
    },
  ) {
    leftText(pair.left);
    rightText(pair.right);

    // Fit both sides (handling newlines). Use the smaller size so they match visually.
    const fontFamily = Fonts.code;
    const fontWeight = 650;
    const leftFit = fitFontSize(pair.left, sideMaxWidth, fontFamily, 112, 44, fontWeight);
    const rightFit = fitFontSize(pair.right, sideMaxWidth, fontFamily, 112, 44, fontWeight);
    const fontSize = Math.min(leftFit, rightFit);
    leftSize(fontSize);
    rightSize(fontSize);

    // Start fully inside safe-zone, accounting for measured text width.
    const leftW = maxLineWidth(pair.left, fontFamily, fontSize, fontWeight);
    const rightW = maxLineWidth(pair.right, fontFamily, fontSize, fontWeight);
    leftX(SafeZone.left + sideMargin + leftW / 2);
    rightX(SafeZone.right - sideMargin - rightW / 2);
    leftOn(0);
    rightOn(0);

    const fadeIn = opts?.fadeIn ?? Math.max(0.08, duration * 0.22);
    const travel = duration;
    const fuse = Math.max(0.08, duration * 0.28);

    // Appear
    yield* all(leftOn(1, fadeIn, easeInOutCubic), rightOn(1, fadeIn, easeInOutCubic));

    // Pause before merge (only used for the very first line, per intro pacing).
    if (opts?.preMergeHold && opts.preMergeHold > 0) {
      yield* waitFor(opts.preMergeHold);
    }

    // Move to center and fully overlap (becomes one line visually).
    yield* all(leftX(0, travel, easeInOutCubic), rightX(0, travel, easeInOutCubic));

    yield* waitFor(hold);

    yield* all(leftOn(0, fuse, easeInOutCubic), rightOn(0, fuse, easeInOutCubic));
  }

  // Warmup: readable merges.
  let dur = 0.9;
  for (let i = 0; i < pairs.length; i++) {
    const hold = i < 3 ? 0.25 : 0.18;
    if (i === 0) {
      // First line: smoother reveal + a couple seconds before the first merge starts.
      yield* playMerge(pairs[i], dur, hold, {fadeIn: 0.9, preMergeHold: 2.0});
    } else {
      yield* playMerge(pairs[i], dur, hold);
    }
    dur *= 0.82;
    yield* waitFor(0.06);
  }

  // Time‑lapse: extremely fast, almost strobing merges.
  const timeLapsePairs: MergePair[] = [
    // Timelapse: every example must be unique (and not used in warmup).
    {left: 'if (dryRun) return;', right: 'if (dryRun) return;'},
    {left: 'throw new Error("denied");', right: 'throw new Error("denied");'},
    {left: 'result = map.get(id);', right: 'result = map.get(id);'},
    {left: 'count += items.length;', right: 'count += items.length;'},
    {left: 'tags.add("new");', right: 'tags.add("new");'},
    {left: 'id = nextId();', right: 'id = nextId();'},
    {left: 'now = Date.now();', right: 'now = Date.now();'},
    {left: 'ok = isValid(x);', right: 'ok = isValid(x);'},
    {left: 'n = Math.max(a, b);', right: 'n = Math.max(a, b);'},
    {left: 'return value;', right: 'return value;'},
    {left: 'sum = a + b;', right: 'sum = a + b;'},
    {left: 'seen.add(id);', right: 'seen.add(id);'},
    {left: 'limit = Math.min(x, y);', right: 'limit = Math.min(x, y);'},
    {left: 'cfg.set("on", true);', right: 'cfg.set("on", true);'},
    {left: 'return ok;', right: 'return ok;'},
    // Multi-line flashes (short, 2–4 lines)
    {left: 'if (flag) {\n  enable();\n}', right: 'if (flag) {\n  enable();\n}'},
    {left: 'try {\n  save();\n} finally {\n  flush();\n}', right: 'try {\n  save();\n} finally {\n  flush();\n}'},
    {left: 'switch (mode) {\n  default -> off();\n}', right: 'switch (mode) {\n  default -> off();\n}'},
    {left: 'if (empty) {\n  return;\n}', right: 'if (empty) {\n  return;\n}'},
    {left: 'try {\n  open();\n} finally {\n  close();\n}', right: 'try {\n  open();\n} finally {\n  close();\n}'},
    {left: 'switch (x) {\n  case 0 -> a();\n}', right: 'switch (x) {\n  case 0 -> a();\n}'},
    {left: 'if (ok) {\n  commit();\n}', right: 'if (ok) {\n  commit();\n}'},
    {left: 'try {\n  send();\n} catch (e) {\n  fail();\n}', right: 'try {\n  send();\n} catch (e) {\n  fail();\n}'},
  ];

  // Make it feel like a cinematic timelapse (very short holds, aggressive acceleration).
  // Slightly longer (a couple of seconds), still reads as timelapse.
  let fast = 0.14;
  for (const t of timeLapsePairs) {
    yield* playMerge(t, fast, 0.02);
    fast = Math.max(0.04, fast * 0.86);
  }

  yield* waitFor(Timing.normal);
});
