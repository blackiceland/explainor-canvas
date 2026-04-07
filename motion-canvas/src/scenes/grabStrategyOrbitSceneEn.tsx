import {makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {all, chain, createRef, easeOutCubic, waitFor} from '@motion-canvas/core';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts, Screen} from '../core/theme';

// ── Source code of the three Strategy implementations ────────────────
const STANDARD_GRAB = `public class StandardGrab implements GrabStrategy {

    public void grab(Cube cube) {
        approach(cube.position);
        close(Force.MEDIUM);
    }
}`;

const SOFT_GRAB = `public class SoftGrab implements GrabStrategy {

    public void grab(Cube cube) {
        approachSlowly(cube.position);
        close(Force.LIGHT);
        waitForSensor();
        adjustToFeedback();
    }
}`;

const FIRM_GRAB = `public class FirmGrab implements GrabStrategy {

    public void grab(Cube cube) {
        preAlign(cube);
        close(Force.MAXIMUM);
        lockWrist();
    }
}`;

const SOURCES = [STANDARD_GRAB, SOFT_GRAB, FIRM_GRAB];

// ── Syntax colors ────────────────────────────────────────────────────
const VAR_LIGHT = 'rgba(244, 241, 235, 0.96)';
const TYPE_CLEAN = 'rgba(220, 215, 255, 0.80)';
const METHOD_COLOR = DryFiltersV3CodeTheme.method;
const KW_COLOR = DryFiltersV3CodeTheme.keyword;

const COLOR_RULES: ColorRule[] = [
  {match: /^public$/,       color: KW_COLOR},
  {match: /^class$/,        color: KW_COLOR},
  {match: /^void$/,         color: KW_COLOR},
  {match: /^implements$/,   color: KW_COLOR},
  {match: /^Cube$/,         color: TYPE_CLEAN},
  {match: /^Force$/,        color: TYPE_CLEAN},
  {match: /^GrabStrategy$/, color: TYPE_CLEAN},
  {match: /^StandardGrab$/, color: TYPE_CLEAN},
  {match: /^SoftGrab$/,     color: TYPE_CLEAN},
  {match: /^FirmGrab$/,     color: TYPE_CLEAN},
  {match: 'cube',           color: VAR_LIGHT},
  {match: 'position',       color: VAR_LIGHT},
  {match: 'grab',             color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'approach',         color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'approachSlowly',   color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'preAlign',         color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'close',            color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'lockWrist',        color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'waitForSensor',    color: METHOD_COLOR, onlyTypes: ['method']},
  {match: 'adjustToFeedback', color: METHOD_COLOR, onlyTypes: ['method']},
];

// Fully transparent card so the code "floats" on raw black.
const CARD_STYLE = {
  radius: 16,
  fill: 'rgba(0,0,0,0)',
  stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0,
  shadowColor: 'rgba(0,0,0,0)',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  edge: false,
} as const;

// ── Layout / motion ──────────────────────────────────────────────────
const CODE_FONT_SIZE = 20;
const CODE_BLOCK_WIDTH = 760;

// Elliptical orbit — wider than tall so the 1920×1080 canvas is used
// fully without code blocks running off the top/bottom edges.
const ORBIT_RX = 600;
const ORBIT_RY = 380;

// Angular velocity (rad/s). One full rotation ≈ 31.4s — slow drift.
const OMEGA = 0.20;

// Three blocks evenly spaced around the orbit, starting positions
// pinned so block 0 is at the top.
const PHASES = [
  -Math.PI / 2,
  -Math.PI / 2 + (2 * Math.PI) / 3,
  -Math.PI / 2 + (4 * Math.PI) / 3,
];

export default makeScene2D(function* (view) {
  view.add(<Rect width={Screen.width} height={Screen.height} fill="#000000" />);

  // ─── Center anchor: the word the strategies pretend to be about ───
  view.add(
    <Txt
      text="grab"
      fontFamily={Fonts.primary}
      fontWeight={700}
      fontSize={160}
      letterSpacing={2}
      fill="#FFFFFF"
    />,
  );

  // ─── Orbiting code blocks ─────────────────────────────────────────
  const wrappers = SOURCES.map(() => createRef<Node>());

  for (let i = 0; i < SOURCES.length; i++) {
    view.add(<Node ref={wrappers[i]} opacity={0} />);

    const mc = Manticore.create(SOURCES[i], {
      x: 0,
      y: 0,
      width: CODE_BLOCK_WIDTH,
      fontSize: CODE_FONT_SIZE,
      fontFamily: Fonts.code,
      theme: DryFiltersV3CodeTheme,
      cardStyle: CARD_STYLE,
      glowAccent: false,
      noClip: true,
    });
    mc.mount(wrappers[i]());
    mc.colorize(COLOR_RULES);
    // Wrapper controls visibility; Manticore's own container stays opaque.
    mc.node.opacity(1);

    // Reactive orbit driven by globalTime so the motion never stops.
    const phase = PHASES[i];
    wrappers[i]().x(() => Math.cos(phase + view.globalTime() * OMEGA) * ORBIT_RX);
    wrappers[i]().y(() => Math.sin(phase + view.globalTime() * OMEGA) * ORBIT_RY);
  }

  // ─── Smooth, staggered fade-in ────────────────────────────────────
  yield* waitFor(0.3);
  yield* all(
    ...wrappers.map((w, i) =>
      chain(waitFor(i * 0.35), w().opacity(1, 1.0, easeOutCubic)),
    ),
  );

  // Let the orbit drift for a while.
  yield* waitFor(14);
});
