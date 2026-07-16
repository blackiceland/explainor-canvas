import {makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {all, chain, createRef, easeOutCubic, waitFor} from '@motion-canvas/core';
import {
  EdgesGeometry,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene as ThreeScene,
  SphereGeometry,
} from 'three';
import {LineSegments2} from 'three/examples/jsm/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/examples/jsm/lines/LineMaterial.js';
import {ColorRule, Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts, Screen} from '../core/theme';
import {createThreeView} from '../core/three/ThreeCanvas';

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

const ORBIT_RX = 600;
const ORBIT_RY = 380;
const OMEGA = 0.20;

const PHASES = [
  -Math.PI / 2,
  -Math.PI / 2 + (2 * Math.PI) / 3,
  -Math.PI / 2 + (4 * Math.PI) / 3,
];

// ── Globe wireframe ─────────────────────────────────────────────────
const GLOBE_R = 200;
const GLOBE_VP = 700;
const GLOBE_OMEGA = 0.12;
// Must mirror createThreeView's default `quality` (cfg.quality ?? 2): the
// fat-line material measures `linewidth` in pixels of the render buffer,
// which is GLOBE_VP * quality on each side.
const GLOBE_QUALITY = 2;
// Line thickness in render-buffer px. The buffer is scaled back down ×1/quality
// on screen, so the on-screen width is roughly GLOBE_LINE_WIDTH / quality.
const GLOBE_LINE_WIDTH = 4;

function buildGlobe(): Mesh {
  const geom = new SphereGeometry(GLOBE_R, 24, 16);
  const mat = new MeshBasicMaterial({color: 0x000000, transparent: true, opacity: 0});
  const sphere = new Mesh(geom, mat);

  // WebGL ignores LineBasicMaterial.linewidth (always draws a ~1px hairline),
  // which at this viewport's ×0.5 downscale became a barely-visible sub-pixel
  // line. Use the examples/jsm "fat line" pipeline for real, anti-aliased
  // screen-space thickness. Built from the same EdgesGeometry so the wireframe
  // topology (lat/long grid) is identical — only thicker and brighter.
  const edges = new EdgesGeometry(geom, 1);
  const lineGeom = new LineSegmentsGeometry().fromEdgesGeometry(edges);
  const lineMat = new LineMaterial({
    color: 0xffffff,
    linewidth: GLOBE_LINE_WIDTH,
    transparent: true,
    opacity: 0.95,
  });
  lineMat.resolution.set(GLOBE_VP * GLOBE_QUALITY, GLOBE_VP * GLOBE_QUALITY);
  const wire = new LineSegments2(lineGeom, lineMat);
  sphere.add(wire);
  return sphere;
}

export default makeScene2D(function* (view) {
  view.add(<Rect width={Screen.width} height={Screen.height} fill="#000000" />);

  // ─── 3D wireframe globe ───────────────────────────────────────────
  const scene3 = new ThreeScene();
  const cam = new PerspectiveCamera(50, 1, 1, 2000);
  cam.position.set(0, 0, 600);
  cam.lookAt(0, 0, 0);

  const globe = buildGlobe();
  scene3.add(globe);

  const globeView = createThreeView({
    width: GLOBE_VP,
    height: GLOBE_VP,
    scene: scene3,
    camera: cam,
    onRender: (renderer, s, c) => {
      globe.rotation.y = view.globalTime() * GLOBE_OMEGA;
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(s, c);
    },
  });
  globeView.node.opacity(0);
  view.add(globeView.node);

  // ─── Center anchor: "grab" inside the globe ───────────────────────
  const grabRef = createRef<Txt>();
  view.add(
    <Txt
      ref={grabRef}
      text="grab"
      fontFamily={Fonts.primary}
      fontWeight={700}
      fontSize={72}
      letterSpacing={2}
      // Warm beige of problemsYouDontHaveSubtitlesSceneEn, not pure white.
      fill="rgba(232, 207, 174, 0.96)"
      opacity={0}
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
    mc.node.opacity(1);

    const phase = PHASES[i];
    wrappers[i]().x(() => Math.cos(phase + view.globalTime() * OMEGA) * ORBIT_RX);
    wrappers[i]().y(() => Math.sin(phase + view.globalTime() * OMEGA) * ORBIT_RY);
  }

  // ─── Fade in: globe + text, then code blocks stagger in ──────────
  yield* all(
    globeView.node.opacity(1, 0.8, easeOutCubic),
    grabRef().opacity(1, 0.8, easeOutCubic),
  );
  yield* waitFor(0.3);
  yield* all(
    ...wrappers.map((w, i) =>
      chain(waitFor(i * 0.35), w().opacity(1, 1.0, easeOutCubic)),
    ),
  );

  // Let the orbit drift for a while.
  yield* waitFor(14);
});
