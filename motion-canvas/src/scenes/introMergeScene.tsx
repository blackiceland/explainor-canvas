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

// ---------------------------------------------------------------------------
// Geometry / type
//
// One fixed size for the whole scene — the same 60 as duplicationHateIntroScene,
// on the same centre line (y = 0), so the confession and the timelapse read as
// one continuous thought. Per-pair fitting is gone: it made the type jump
// 44 → 101 from pair to pair, which reads as jitter, not rhythm.
//
// Authoring budget at FS 60 in a half-column: 19 characters per line.
// (sideMaxWidth 728px / (0.6em * 60) ≈ 20, minus headroom for font fallback.)
// ---------------------------------------------------------------------------

const FS = 60;
const WEIGHT = 650;
const BLOCK_Y = 0;
const SIDE_MARGIN = 56;
const HALF_WIDTH = (SafeZone.right - SafeZone.left) / 2;
const SIDE_MAX_WIDTH = HALF_WIDTH - SIDE_MARGIN * 2;

// ---------------------------------------------------------------------------
// Content rule: every pair must be a block you can NAME.
//
// If you cannot say which method gets extracted, nothing is being merged —
// two identical strings sliding over each other is a graphic effect, not a
// refactor. So: no bare statements (`return value;`, `sum = a + b;`,
// `tx.rollback();`), only 2–6 line blocks with an obvious extraction.
//
// Warmup 1–5: strictly identical left/right.
// Warmup 6–10: exactly ONE differing token, same character count on both sides
//              so only that token smears on overlap and the rest stays crisp.
// ---------------------------------------------------------------------------

const WARMUP_PAIRS: MergePair[] = [
  // 1) retryIfTemporary()
  {
    left: 'if (temporary) {\n  retry();\n}',
    right: 'if (temporary) {\n  retry();\n}',
  },
  // 2) normalize(s) — no braces, breaks up the rhythm
  {
    left: 's = trim(s);\ns = lower(s);',
    right: 's = trim(s);\ns = lower(s);',
  },
  // 3) orDefault(v)
  {
    left: 'if (v == null) {\n  v = DEFAULT;\n}',
    right: 'if (v == null) {\n  v = DEFAULT;\n}',
  },
  // 4) runOrFail()
  {
    left: 'try {\n  charge();\n} catch (e) {\n  fail();\n}',
    right: 'try {\n  charge();\n} catch (e) {\n  fail();\n}',
  },
  // 5) computeIfAbsent(k)
  {
    left: 't = tags.get(k);\nif (t == null) {\n  t = new Tag(k);\n  tags.put(k, t);\n}',
    right: 't = tags.get(k);\nif (t == null) {\n  t = new Tag(k);\n  tags.put(k, t);\n}',
  },
  // 6) noneIfEmpty(x) — rows / cols
  {
    left: 'if (empty(rows)) {\n  return NONE;\n}',
    right: 'if (empty(cols)) {\n  return NONE;\n}',
  },
  // 7) track(op, id) — save / send
  {
    left: 'audit("save", id);\nmetrics.inc(op);',
    right: 'audit("send", id);\nmetrics.inc(op);',
  },
  // 8) verify(body, sig) — sha / md5
  {
    left: 'h = sha(body);\nif (h != sig) {\n  return FORGED;\n}',
    right: 'h = md5(body);\nif (h != sig) {\n  return FORGED;\n}',
  },
  // 9) withStream(path) — src / dst
  {
    left: 's = open(src);\ncopy(s);\ns.close();',
    right: 's = open(dst);\ncopy(s);\ns.close();',
  },
  // 10) guarded(...) — commit / revert
  {
    left: 'lock.lock();\ntry {\n  commit();\n} finally {\n  lock.unlock();\n}',
    right: 'lock.lock();\ntry {\n  revert();\n} finally {\n  lock.unlock();\n}',
  },
];

// Timelapse: identical left/right (at strobe speed a drift is invisible, and
// identical keeps the overlap perfectly crisp). Every block unique, every block
// nameable, 3–5 lines so the silhouette stays legible at 0.04s.
const TIMELAPSE_PAIRS: MergePair[] = [
  // clamp(n)
  {left: 'if (n > MAX) {\n  n = MAX;\n}', right: 'if (n > MAX) {\n  n = MAX;\n}'},
  // visitAll(items)
  {left: 'for (T x : items) {\n  visit(x);\n}', right: 'for (T x : items) {\n  visit(x);\n}'},
  // assemble(head)
  {left: 'b = new Buf();\nb.add(head);\nreturn b.done();', right: 'b = new Buf();\nb.add(head);\nreturn b.done();'},
  // inScope(scope, body)
  {left: 'ctx.push(scope);\nbody.run();\nctx.pop();', right: 'ctx.push(scope);\nbody.run();\nctx.pop();'},
  // validate(req)
  {left: 'if (!ok(req)) {\n  return BAD;\n}', right: 'if (!ok(req)) {\n  return BAD;\n}'},
  // count(it)
  {left: 'n = 0;\nwhile (has(it)) {\n  n++;\n  next(it);\n}', right: 'n = 0;\nwhile (has(it)) {\n  n++;\n  next(it);\n}'},
  // swap(a, b)
  {left: 'tmp = a;\na = b;\nb = tmp;', right: 'tmp = a;\na = b;\nb = tmp;'},
  // requirePositive(v)
  {left: 'if (v < 0) {\n  throw new Bad(v);\n}', right: 'if (v < 0) {\n  throw new Bad(v);\n}'},
  // withConn(...)
  {left: 'c = conn.get();\nrun(c);\nc.close();', right: 'c = conn.get();\nrun(c);\nc.close();'},
  // skipIfSeen(id)
  {left: 'if (seen.has(id)) {\n  return;\n}', right: 'if (seen.has(id)) {\n  return;\n}'},
  // nowIfAbsent(t)
  {left: 'if (t == null) {\n  t = clock();\n}', right: 'if (t == null) {\n  t = clock();\n}'},
  // emit(head, body)
  {left: 'out.write(head);\nout.write(body);\nout.flush();', right: 'out.write(head);\nout.write(body);\nout.flush();'},
  // tryParse(s)
  {left: 'try {\n  parse(s);\n} catch (e) {\n  return null;\n}', right: 'try {\n  parse(s);\n} catch (e) {\n  return null;\n}'},
  // total(v)
  {left: 'sum = 0;\nfor (int x : v) {\n  sum += x;\n}', right: 'sum = 0;\nfor (int x : v) {\n  sum += x;\n}'},
  // submit(job)
  {left: 'q.add(job);\nif (!busy) {\n  drain(q);\n}', right: 'q.add(job);\nif (!busy) {\n  drain(q);\n}'},
  // skipIfOff()
  {left: 'if (mode == OFF) {\n  return SKIP;\n}', right: 'if (mode == OFF) {\n  return SKIP;\n}'},
  // getOrFallback(k)
  {left: 'x = raw.get(k);\nif (x == null) {\n  x = FALLBACK;\n}', right: 'x = raw.get(k);\nif (x == null) {\n  x = FALLBACK;\n}'},
  // guardDepth()
  {left: 'if (depth++ > 8) {\n  throw new Loop();\n}', right: 'if (depth++ > 8) {\n  throw new Loop();\n}'},
  // readInto(src)
  {left: 'buf.clear();\nfill(buf, src);\nreturn buf.get();', right: 'buf.clear();\nfill(buf, src);\nreturn buf.get();'},
  // flushIfDirty()
  {left: 'if (dirty) {\n  save(doc);\n  dirty = false;\n}', right: 'if (dirty) {\n  save(doc);\n  dirty = false;\n}'},
  // touchIfPresent(k)
  {left: 'e = map.get(k);\nif (e != null) {\n  e.touch();\n}', right: 'e = map.get(k);\nif (e != null) {\n  e.touch();\n}'},
  // draw(node)
  {left: 'w.begin();\nrender(node);\nw.end();', right: 'w.begin();\nrender(node);\nw.end();'},
  // timed(task)
  {left: 't0 = clock();\nrun(task);\ntook(t0);', right: 't0 = clock();\nrun(task);\ntook(t0);'},
];

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

function fitFontSize(
  text: string,
  maxWidthPx: number,
  fontFamily: string,
  maxFontSize: number,
  minFontSize: number,
  fontWeight: number = 600,
): number {
  const maxW = Math.max(1, maxWidthPx);
  let lo = Math.max(1, Math.floor(minFontSize));
  let hi = Math.max(lo, Math.floor(maxFontSize));

  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (maxLineWidth(text, fontFamily, mid, fontWeight) <= maxW) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return lo;
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  const stage = createRef<Node>();
  view.add(<Node ref={stage} />);

  // Text signals
  const leftText = createSignal('');
  const rightText = createSignal('');

  const leftX = createSignal(0);
  const rightX = createSignal(0);

  const leftOn = createSignal(0);
  const rightOn = createSignal(0);

  const baseInk = '#F6E7D4'; // match chapter1IntroScene title color
  const bracketBlue = '#BFEAFF';
  const keywordPink = Colors.accent;

  // Resolve ONE size for the whole scene. Everything above is authored to fit
  // at FS, so this is 60. If a snippet ever outgrows the column the entire
  // scene shrinks together — uniform, never per-pair jitter.
  const allPairs = [...WARMUP_PAIRS, ...TIMELAPSE_PAIRS];
  const fontSize = Math.min(
    FS,
    ...allPairs.flatMap(p => [
      fitFontSize(p.left, SIDE_MAX_WIDTH, Fonts.code, FS, 12, WEIGHT),
      fitFontSize(p.right, SIDE_MAX_WIDTH, Fonts.code, FS, 12, WEIGHT),
    ]),
  );
  const lineHeight = fontSize * 1.35;

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
        fontSize={fontSize}
        lineHeight={lineHeight}
        opacity={() => leftOn()}
        x={() => leftX()}
        y={BLOCK_Y}
        drawHooks={drawHooks}
      />
      <Code
        code={() => rightText()}
        fontFamily={Fonts.code}
        fontSize={fontSize}
        lineHeight={lineHeight}
        opacity={() => rightOn()}
        x={() => rightX()}
        y={BLOCK_Y}
        drawHooks={drawHooks}
      />
    </>,
  );

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

    // Start fully inside safe-zone, accounting for measured text width.
    const leftW = maxLineWidth(pair.left, Fonts.code, fontSize, WEIGHT);
    const rightW = maxLineWidth(pair.right, Fonts.code, fontSize, WEIGHT);
    leftX(SafeZone.left + SIDE_MARGIN + leftW / 2);
    rightX(SafeZone.right - SIDE_MARGIN - rightW / 2);
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

    // Move to center and fully overlap (becomes one block visually).
    yield* all(leftX(0, travel, easeInOutCubic), rightX(0, travel, easeInOutCubic));

    yield* waitFor(hold);

    yield* all(leftOn(0, fuse, easeInOutCubic), rightOn(0, fuse, easeInOutCubic));
  }

  // Warmup: readable merges.
  let dur = 0.9;
  for (let i = 0; i < WARMUP_PAIRS.length; i++) {
    const hold = i < 3 ? 0.25 : 0.18;
    if (i === 0) {
      // First block: smoother reveal + a couple seconds before the first merge starts.
      yield* playMerge(WARMUP_PAIRS[i], dur, hold, {fadeIn: 0.9, preMergeHold: 2.0});
    } else {
      yield* playMerge(WARMUP_PAIRS[i], dur, hold);
    }
    dur *= 0.82;
    yield* waitFor(0.06);
  }

  // Time-lapse: extremely fast, almost strobing merges.
  let fast = 0.14;
  for (const t of TIMELAPSE_PAIRS) {
    yield* playMerge(t, fast, 0.02);
    fast = Math.max(0.04, fast * 0.86);
  }

  yield* waitFor(Timing.normal);
});
