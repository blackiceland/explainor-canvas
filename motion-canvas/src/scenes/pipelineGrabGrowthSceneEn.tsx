import {Circle, Gradient, makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {
  all, createRef, createSignal, easeInOutSine, Vector2, waitFor,
} from '@motion-canvas/core';
import {Fonts, Screen} from '../core/theme';

// ── Domains (the "pipeline" rendered as plain words) ──────────────────
const STEPS = ['move', 'grab', 'lift', 'move', 'release'] as const;

// Hand-picked "random looking" positions inside a safe frame.
// Kept far enough apart that no two words can overlap and the spotlight
// can fully illuminate one without leaking into another.
const POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [-560, -300],   // move
  [ 380, -210],   // grab
  [-180,   30],   // lift
  [ 540,  170],   // move
  [-450,  330],   // release
];

// ── Layout ────────────────────────────────────────────────────────────
const FONT_SIZE = 64;
const LETTER_SPACING = 2;

// Warm beige of a fully-lit word — the chapter-title colour from
// problemsYouDontHaveSubtitlesSceneEn (rgba(232,207,174)). Words still
// ramp from a near-black floor (unlit) up to this beige as the
// flashlight reaches them; only the lit target changed from pure white.
const LIT_R = 232;
const LIT_G = 207;
const LIT_B = 174;
const DARK_FLOOR = 8;

// ── Light physics ─────────────────────────────────────────────────────
// How far light "reaches" before brightness fully falls off.
const LIGHT_REACH = 210;
// Visible spotlight radius — small, tight cone.
const SPOT_R = 240;
// Hard cap on cast-shadow length. ~0.4 × FONT_SIZE keeps the shadow
// visually attached to the letters (not a flying detached blob).
const SHADOW_MAX = 26;

export default makeScene2D(function* (view) {
  // ─── Pitch-black stage ──────────────────────────────────────────────
  view.add(<Rect width={Screen.width} height={Screen.height} fill="#000000" />);

  // ─── Light source ───────────────────────────────────────────────────
  // Two layers:
  //   • baseX/baseY  — the *intended* aim point (what tweens move).
  //   • tremorX/Y    — continuous hand jitter from layered sines.
  // The effective light position queried by everything else is the sum
  // of the two, so the lamp never sits perfectly still.
  const baseX = createSignal(-Screen.width * 0.55);
  const baseY = createSignal(POSITIONS[0][1] - 220);

  // Layered low-frequency sines → organic jitter ±~6 px on each axis.
  // Three octaves with co-prime-ish frequencies and offset phases so
  // the pattern never visibly loops.
  const tremorX = (): number => {
    const t = view.globalTime();
    return (
      Math.sin(t * 1.9 + 0.3) * 3.5 +
      Math.sin(t * 4.3 + 1.4) * 1.8 +
      Math.sin(t * 7.6 + 2.7) * 0.9
    );
  };
  const tremorY = (): number => {
    const t = view.globalTime();
    return (
      Math.cos(t * 2.1 + 0.7) * 3.5 +
      Math.cos(t * 4.6 + 1.8) * 1.7 +
      Math.cos(t * 8.1 + 0.3) * 0.8
    );
  };

  // Effective light position. Used by all reactive consumers below.
  const lightX = (): number => baseX() + tremorX();
  const lightY = (): number => baseY() + tremorY();

  // Raw distance from light to a word.
  const distFor = (wx: number, wy: number): number => {
    const dx = wx - lightX();
    const dy = wy - lightY();
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Smoothstep falloff in [0,1] for a word at (wx, wy).
  const brightnessFor = (wx: number, wy: number): number => {
    const t = Math.max(0, Math.min(1, 1 - distFor(wx, wy) / LIGHT_REACH));
    return t * t * (3 - 2 * t);                                // smoothstep
  };

  // ─── Spotlight cone ─────────────────────────────────────────────────
  // Drawn FIRST so the words (and their shadows) sit on top of the
  // pool of light. A black drop-shadow only reads against a lit
  // background, never against pure black.
  //
  // Pure white, sharp hot core, fast falloff — reads as a flashlight
  // beam rather than a soft "stage light". Center alpha is kept around
  // ~0.55 so the lit area becomes a mid-grey, leaving room for the
  // white text to still pop *and* for black shadows to stay visible.
  view.add(
    <Circle
      x={() => lightX()}
      y={() => lightY()}
      width={SPOT_R * 2}
      height={SPOT_R * 2}
      compositeOperation="screen"
      fill={
        new Gradient({
          type: 'radial',
          from: new Vector2(0, 0),
          to: new Vector2(0, 0),
          fromRadius: 0,
          toRadius: SPOT_R,
          stops: [
            {offset: 0.00, color: 'rgba(255,255,255,0.58)'},
            {offset: 0.18, color: 'rgba(255,255,255,0.42)'},
            {offset: 0.42, color: 'rgba(255,255,255,0.14)'},
            {offset: 0.75, color: 'rgba(255,255,255,0.025)'},
            {offset: 1.00, color: 'rgba(255,255,255,0.00)'},
          ],
        })
      }
    />,
  );

  // ─── Words (drawn AFTER the spotlight so shadows render onto it) ────
  const words = createRef<Node>();
  view.add(<Node ref={words} />);

  for (let i = 0; i < STEPS.length; i++) {
    const [wx, wy] = POSITIONS[i];

    words().add(
      <Txt
        text={STEPS[i]}
        x={wx}
        y={wy}
        fontFamily={Fonts.primary}
        fontWeight={700}
        fontSize={FONT_SIZE}
        letterSpacing={LETTER_SPACING}
        // Brightness ramps from "barely there" to warm beige as light arrives.
        fill={() => {
          const b = brightnessFor(wx, wy);
          const cr = Math.round(DARK_FLOOR + b * (LIT_R - DARK_FLOOR));
          const cg = Math.round(DARK_FLOOR + b * (LIT_G - DARK_FLOOR));
          const cb = Math.round(DARK_FLOOR + b * (LIT_B - DARK_FLOOR));
          return `rgb(${cr},${cg},${cb})`;
        }}
        // Shadow only exists where there is actual light to be blocked.
        // Fades cleanly with brightness so unlit words never "ghost" a
        // stray dark blob behind them.
        shadowColor={() => {
          const b = brightnessFor(wx, wy);
          return `rgba(0,0,0,${b * 0.85})`;
        }}
        // Slightly softer when the light is grazing (low brightness),
        // tighter when the light is right on the word.
        shadowBlur={() => {
          const b = brightnessFor(wx, wy);
          return 6 + (1 - b) * 10;
        }}
        // Physically-correct cast shadow:
        //   • direction = light → word (away from the source)
        //   • length    ∝ distance from light (light far ⇒ long grazing
        //                shadow; light directly on word ⇒ short stub)
        //   • capped at SHADOW_MAX so the blob never detaches from
        //     the letters
        //   • zero when there is no light, so the shadow vanishes
        //     instead of snapping to a stale offset.
        shadowOffset={() => {
          const b = brightnessFor(wx, wy);
          if (b <= 0) return [0, 0] as [number, number];
          const dx = wx - lightX();
          const dy = wy - lightY();
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 0.001) return [0, 0] as [number, number];
          const len = Math.min(d * 0.32, SHADOW_MAX);
          return [(dx / d) * len, (dy / d) * len] as [number, number];
        }}
      />,
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // Choreography of the light
  // ═══════════════════════════════════════════════════════════════════
  //
  // Goal: looks like a person aiming a flashlight, not a programmed
  // gantry. Three sources of natural variation are layered:
  //
  //   1. Tremor (above) — continuous wobble while the lamp is "still".
  //   2. Mismatched X / Y tween durations — straight diagonal motion
  //      becomes a soft curve, because each axis arrives at a slightly
  //      different time.
  //   3. Seeded PRNG — dwell times, tween durations and per-target
  //      aim jitter all wiggle in plausible ranges. Seeded so renders
  //      stay reproducible.

  // Tiny deterministic PRNG (mulberry32-ish). Seeded with a constant.
  let seed = 0xC0FFEE;
  const rnd = (): number => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rrange = (a: number, b: number): number => a + (b - a) * rnd();

  // Each "aim" lands a few pixels off the geometric centre of the word
  // — humans don't snap to coordinates.
  const jitterTarget = (p: readonly [number, number]): [number, number] => [
    p[0] + rrange(-14, 14),
    p[1] + rrange(-11, 11),
  ];

  // Hold on pure darkness so the eye adapts.
  yield* waitFor(0.5);

  // Slide in to the first word. X and Y deliberately have different
  // durations so the path arcs in instead of running on a straight rail.
  {
    const [tx, ty] = jitterTarget(POSITIONS[0]);
    yield* all(
      baseX(tx, rrange(1.15, 1.45), easeInOutSine),
      baseY(ty, rrange(1.30, 1.60), easeInOutSine),
    );
  }
  yield* waitFor(rrange(0.65, 0.95));

  // Hop to each subsequent word, pausing on each. Same trick: X and Y
  // get independent durations, so each leg of the path curves slightly.
  for (let i = 1; i < STEPS.length; i++) {
    const [tx, ty] = jitterTarget(POSITIONS[i]);
    const dx = rrange(0.72, 1.05);
    const dy = rrange(0.82, 1.18);
    yield* all(
      baseX(tx, dx, easeInOutSine),
      baseY(ty, dy, easeInOutSine),
    );
    yield* waitFor(rrange(0.55, 0.95));
  }

  // Linger on the final word.
  yield* waitFor(rrange(0.45, 0.7));

  // Pull the light off-stage to the right, fading everything to black.
  const last = POSITIONS[POSITIONS.length - 1];
  yield* all(
    baseX(Screen.width * 0.65, rrange(1.30, 1.55), easeInOutSine),
    baseY(last[1] + rrange(160, 240), rrange(1.45, 1.70), easeInOutSine),
  );

  yield* waitFor(0.4);
});
