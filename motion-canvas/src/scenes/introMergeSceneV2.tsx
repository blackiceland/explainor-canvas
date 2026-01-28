import {Code, makeScene2D, Node, Rect} from '@motion-canvas/2d';
import {all, createRef, createSignal, easeInOutCubic, map, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Colors, Fonts, Screen, Timing} from '../core/theme';
import {SafeZone} from '../core/ScreenGrid';
import {textWidth} from '../core/utils/textMeasure';

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
    const allFit = lines.every(line => textWidth(line, fontFamily, mid, fontWeight) <= maxW);
    if (allFit) lo = mid;
    else hi = mid - 1;
  }

  return lo;
}

function blockHeight(text: string, fontSize: number): number {
  const lines = Math.max(1, text.split('\n').length);
  return lines * fontSize * 1.3;
}

export default makeScene2D(function* (view) {
  applyBackground(view);
  view.add(
    <Rect width={Screen.width} height={Screen.height} fill={'rgba(168,217,255,0.03)'} />,
  );

  const stage = createRef<Node>();
  view.add(<Node ref={stage} />);

  const topText = createSignal('');
  const bottomText = createSignal('');

  const fontSizeSig = createSignal(92);

  const topY = createSignal(0);
  const bottomY = createSignal(0);

  const topOn = createSignal(0);
  const bottomOn = createSignal(0);

  const baseInk = '#F6E7D4';
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
      const prevAlpha = canvasCtx.globalAlpha;
      canvasCtx.globalAlpha *= map(0.2, 1, selection);

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

        if (ch === '{' || ch === '}') {
          flush(ch, bracketBlue);
          i += 1;
          continue;
        }

        if (/[A-Za-z_]/.test(ch)) {
          let j = i + 1;
          while (j < raw.length && /[A-Za-z0-9_]/.test(raw[j])) j += 1;
          const word = raw.slice(i, j);
          flush(word, KEYWORDS.has(word) ? keywordPink : baseInk);
          i = j;
          continue;
        }

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
        code={() => topText()}
        fontFamily={Fonts.code}
        fontSize={() => fontSizeSig()}
        lineHeight={() => fontSizeSig() * 1.3}
        opacity={() => topOn()}
        x={0}
        y={() => topY()}
        drawHooks={drawHooks}
      />
      <Code
        code={() => bottomText()}
        fontFamily={Fonts.code}
        fontSize={() => fontSizeSig()}
        lineHeight={() => fontSizeSig() * 1.3}
        opacity={() => bottomOn()}
        x={0}
        y={() => bottomY()}
        drawHooks={drawHooks}
      />
    </>,
  );

  const sideMargin = 120;
  const maxWidth = (SafeZone.right - SafeZone.left) - sideMargin * 2;
  const fontFamily = Fonts.code;
  const fontWeight = 650;

  const examples: string[] = [
    'return round(total);',
    'headers.set("X-Auth", token);',
    'return key(id, n);',
    'case INVALID_CVV -> DECLINED;',
    'if (temporary) {\n  retry();\n}',
    'log.info("Charge {}", id);\nmetrics.inc("charge");',
    'tx.rollback();',
    'try { publish(); } catch (e) { rollback(); }',
  ];

  function* playMerge(text: string, duration: number, hold: number, opts?: {preMergeHold?: number; fadeIn?: number}) {
    topText(text);
    bottomText(text);

    const fs = fitFontSize(text, maxWidth, fontFamily, 104, 40, fontWeight);
    fontSizeSig(fs);

    const h = blockHeight(text, fs);
    const edgeMargin = 88;
    const innerGap = 240;
    const maxD = Math.max(0, SafeZone.bottom - edgeMargin - h / 2);
    const d = Math.min(maxD, (h + innerGap) / 2);
    topY(-d);
    bottomY(d);

    topOn(0);
    bottomOn(0);

    const fadeIn = opts?.fadeIn ?? Math.max(0.08, duration * 0.22);
    const travel = duration;
    const fuse = Math.max(0.08, duration * 0.28);

    yield* all(topOn(1, fadeIn, easeInOutCubic), bottomOn(1, fadeIn, easeInOutCubic));

    if (opts?.preMergeHold && opts.preMergeHold > 0) yield* waitFor(opts.preMergeHold);

    yield* all(topY(0, travel, easeInOutCubic), bottomY(0, travel, easeInOutCubic));

    yield* waitFor(hold);

    yield* all(topOn(0, fuse, easeInOutCubic), bottomOn(0, fuse, easeInOutCubic));
  }

  let dur = 0.82;
  for (let i = 0; i < examples.length; i++) {
    const hold = i < 3 ? 0.2 : 0.14;
    if (i === 0) yield* playMerge(examples[i], dur, hold, {fadeIn: 0.7, preMergeHold: 1.2});
    else yield* playMerge(examples[i], dur, hold);
    dur *= 0.88;
    yield* waitFor(0.05);
  }

  const timeLapse: string[] = [
    'if (dryRun) return;',
    'throw new Error("denied");',
    'result = map.get(id);',
    'count += items.length;',
    'tags.add("new");',
    'id = nextId();',
    'now = Date.now();',
    'ok = isValid(x);',
    'n = Math.max(a, b);',
    'return value;',
    'sum = a + b;',
    'seen.add(id);',
    'limit = Math.min(x, y);',
    'cfg.set("on", true);',
    'return ok;',
    'if (flag) {\n  enable();\n}',
    'try {\n  save();\n} finally {\n  flush();\n}',
    'switch (mode) {\n  default -> off();\n}',
    'if (empty) {\n  return;\n}',
    'try {\n  open();\n} finally {\n  close();\n}',
    'switch (x) {\n  case 0 -> a();\n}',
    'if (ok) {\n  commit();\n}',
    'try {\n  send();\n} catch (e) {\n  fail();\n}',
    'cache.set(key, value);',
    'cache.delete(key);',
    'return hash(input);',
    'id = parseInt(raw, 10);',
    'timeout = 250;',
    'queue.push(job);',
    'queue.shift();',
    'value ??= fallback;',
    'return ok && ready;',
    'map.set(id, item);',
    'map.delete(id);',
    'signal.abort();',
    'if (!authorized) {\n  deny();\n}',
  ];

  let fast = Math.max(0.22, dur * 0.72);
  for (let i = 0; i < timeLapse.length; i++) {
    yield* playMerge(timeLapse[i], fast, 0.012);
    const k = i < 8 ? 0.96 : 0.93;
    fast = Math.max(0.055, fast * k);
  }

  yield* waitFor(3);
});


