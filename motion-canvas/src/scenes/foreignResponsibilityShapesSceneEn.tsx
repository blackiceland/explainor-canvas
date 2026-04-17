import {Circle, makeScene2D, Node, Rect, Txt} from '@motion-canvas/2d';
import {
  all,
  chain,
  createRef,
  createSignal,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  linear,
  waitFor,
} from '@motion-canvas/core';
import {
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene as ThreeScene,
  SphereGeometry,
} from 'three';
import {Fonts} from '../core/theme';
import {createThreeView} from '../core/three/ThreeCanvas';
import {applyBackground} from '../core/utils';

// ── Palette ───────────────────────────────────────────────────────
const GRAB_COLOR    = 'rgba(100, 180, 255, 0.85)';
const GRAB_BORDER   = 'rgba(100, 180, 255, 0.35)';
const FOREIGN_COLOR = '#FF9F43';
const RULES_COLOR   = '#FF4757';
const TEXT_DIM      = 'rgba(244, 241, 235, 0.35)';

// ── Layout ────────────────────────────────────────────────────────
const MEMBRANE_R = 320;
const DOT_R = 22;

// Sphere silhouette must visually equal MEMBRANE_R.
// Perspective silhouette radius = R·f / sqrt(z²−R²), so the naive z=f result
// from the simple projection is too close. Solved exactly with f≈1180, R=320,
// target 320: z≈1222. Extra margin keeps the sphere a touch smaller than the
// circle so the swap reads as a clean fit, not a pop.
const GLOBE_R = 320;
const GLOBE_VP = 1100;
const GLOBE_CAM_Z = 1240;
const GLOBE_OMEGA = 0.12;

const OPS_FONT = 20;
const CENTER_FONT = 140;

// Ops packed so red diamonds never overlap blue dots or orange squares
// inside the unchanged R=320 circle.
const OWN_OPS = [
  {label: 'approach',  x: -92, y: -58},
  {label: 'close',     x:  92, y: -58},
  {label: 'lockWrist', x:   0, y:  86},
];

const FOREIGN_OPS = [
  {label: 'MotionProfile', x: -130, y: 40,  startX: -620, startY: -130},
  {label: 'Orientation',   x:  120, y: 30,  startX:  580, startY:  -96},
];

const RULES_OPS = [
  {label: 'isDelicate()',    x: -180, y: -115, startX: -740, startY: -320},
  {label: 'hasLooseParts()', x:   30, y:  180, startX:  650, startY:  320},
  {label: 'requiresFixed()', x:  180, y: -115, startX:  740, startY: -260},
];

function buildGlobe() {
  const geom = new SphereGeometry(GLOBE_R, 32, 20);
  const sphereMat = new MeshBasicMaterial({color: 0x000000, transparent: true, opacity: 0});
  const sphere = new Mesh(geom, sphereMat);
  const lineMat = new LineBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.9});
  const edges = new LineSegments(new EdgesGeometry(geom, 1), lineMat);
  sphere.add(edges);
  return {sphere, lineMat};
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  const root = createRef<Node>();
  view.add(<Node ref={root} />);

  // ── Signals driving sphere state ────────────────────────────────
  const redness = createSignal(0);
  const omegaBoost = createSignal(0);

  // ── 3D wireframe globe ──────────────────────────────────────────
  const scene3 = new ThreeScene();
  const cam = new PerspectiveCamera(50, 1, 1, 4000);
  cam.position.set(0, 0, GLOBE_CAM_Z);
  cam.lookAt(0, 0, 0);

  const {sphere: globe, lineMat} = buildGlobe();
  scene3.add(globe);

  const globeView = createThreeView({
    width: GLOBE_VP,
    height: GLOBE_VP,
    scene: scene3,
    camera: cam,
    onRender: (renderer, s, c) => {
      const t = view.globalTime();
      globe.rotation.y = t * GLOBE_OMEGA * (1 + omegaBoost());

      const r = redness();
      lineMat.color.setRGB(1, 1 - r * 0.75, 1 - r * 0.92);

      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(s, c);
    },
  });
  globeView.node.opacity(0);
  root().add(globeView.node);

  // ── Center "grab" text (sphere phase only, dissolves on transition)
  const grabCenter = createRef<Txt>();
  const grabCenterScale = createSignal(1);
  root().add(
    <Txt
      ref={grabCenter}
      text="grab"
      fontFamily={Fonts.primary}
      fontWeight={700}
      fontSize={CENTER_FONT}
      letterSpacing={3}
      fill="#FFFFFF"
      opacity={0}
    />,
  );
  grabCenter().scale(() => grabCenterScale());

  // ── Membrane circle (hidden until transition) ───────────────────
  const membrane = createRef<Circle>();
  root().add(
    <Circle
      ref={membrane}
      width={MEMBRANE_R * 2}
      height={MEMBRANE_R * 2}
      stroke={GRAB_BORDER}
      lineWidth={3}
      fill={'rgba(100, 180, 255, 0.04)'}
      opacity={0}
    />,
  );

  // ── Foreign output shapes (orange squares, axis-aligned) ────────
  // Rendered first so red diamonds layer above without occluding blue dots.
  const foreignRefs = FOREIGN_OPS.map(() => createRef<Rect>());
  const foreignLabels = FOREIGN_OPS.map(() => createRef<Txt>());
  for (let i = 0; i < FOREIGN_OPS.length; i++) {
    const op = FOREIGN_OPS[i];
    root().add(
      <Rect
        ref={foreignRefs[i]}
        x={op.startX} y={op.startY}
        width={36} height={36}
        fill={FOREIGN_COLOR}
        radius={4}
        opacity={0}
      />,
    );
    root().add(
      <Txt
        ref={foreignLabels[i]}
        text={op.label}
        x={op.startX} y={op.startY + 40}
        fontFamily={Fonts.code}
        fontSize={OPS_FONT}
        fill={FOREIGN_COLOR}
        opacity={0}
      />,
    );
  }

  // ── Own operations (blue dots) — layered ABOVE foreign squares ─
  const ownDots = OWN_OPS.map(() => createRef<Circle>());
  const ownLabels = OWN_OPS.map(() => createRef<Txt>());
  for (let i = 0; i < OWN_OPS.length; i++) {
    const op = OWN_OPS[i];
    root().add(
      <Circle
        ref={ownDots[i]}
        x={op.x} y={op.y}
        width={DOT_R * 2} height={DOT_R * 2}
        fill={GRAB_COLOR}
        opacity={0}
      />,
    );
    root().add(
      <Txt
        ref={ownLabels[i]}
        text={op.label}
        x={op.x} y={op.y + DOT_R + 22}
        fontFamily={Fonts.code}
        fontSize={OPS_FONT}
        fill={TEXT_DIM}
        opacity={0}
      />,
    );
  }

  // ── Foreign rule shapes (red diamonds) — placed in outer ring so
  //    they don't overlap blue dots or orange squares on arrival.
  const rulesRefs = RULES_OPS.map(() => createRef<Rect>());
  const rulesLabels = RULES_OPS.map(() => createRef<Txt>());
  for (let i = 0; i < RULES_OPS.length; i++) {
    const op = RULES_OPS[i];
    root().add(
      <Rect
        ref={rulesRefs[i]}
        x={op.startX} y={op.startY}
        width={46} height={46}
        fill={RULES_COLOR}
        radius={3}
        opacity={0}
        rotation={45}
      />,
    );
    root().add(
      <Txt
        ref={rulesLabels[i]}
        text={op.label}
        x={op.startX} y={op.startY + 48}
        fontFamily={Fonts.code}
        fontSize={OPS_FONT}
        fill={RULES_COLOR}
        opacity={0}
      />,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // Act 0 — sphere prelude: rotating globe with "grab" center
  // ═══════════════════════════════════════════════════════════════
  yield* all(
    globeView.node.opacity(1, 0.9, easeOutCubic),
    grabCenter().opacity(1, 0.9, easeOutCubic),
  );
  yield* waitFor(1.4);

  yield* all(
    redness(1, 1.3, easeInOutCubic),
    omegaBoost(3, 1.3, easeInCubic),
    grabCenter().fill('#FF3A2E', 1.1, easeInOutCubic),
    grabCenterScale(1.25, 1.0, easeInOutCubic),
  );
  yield* waitFor(0.5);

  // ═══════════════════════════════════════════════════════════════
  // Act 0b — seamless transition: sphere silhouette becomes membrane,
  //          center "grab" text dissolves in place
  // ═══════════════════════════════════════════════════════════════
  yield* all(
    globeView.node.opacity(0, 0.9, easeInCubic),
    omegaBoost(0, 0.9, easeInOutCubic),
    redness(0, 0.9, easeInOutCubic),
    grabCenter().opacity(0, 0.8, easeInCubic),
    membrane().opacity(1, 0.9, easeOutCubic),
  );

  // ═══════════════════════════════════════════════════════════════
  // Act 1 — own operations appear inside membrane
  // ═══════════════════════════════════════════════════════════════
  yield* all(
    ...ownDots.map((d, i) =>
      chain(waitFor(i * 0.15), all(
        d().opacity(1, 0.4, easeOutCubic),
        ownLabels[i]().opacity(1, 0.4, easeOutCubic),
      )),
    ),
  );
  yield* waitFor(1.3);

  // ═══════════════════════════════════════════════════════════════
  // Act 2 — foreign outputs appear outside, drift into membrane
  // ═══════════════════════════════════════════════════════════════
  yield* all(
    ...foreignRefs.map((r, i) => chain(
      waitFor(i * 0.2),
      all(
        r().opacity(1, 0.4, easeOutCubic),
        foreignLabels[i]().opacity(1, 0.4, easeOutCubic),
      ),
    )),
  );
  yield* waitFor(0.6);

  yield* all(
    ...foreignRefs.map((r, i) => all(
      r().x(FOREIGN_OPS[i].x, 1.2, easeInOutCubic),
      r().y(FOREIGN_OPS[i].y, 1.2, easeInOutCubic),
    )),
    ...foreignLabels.map((l, i) => all(
      l().x(FOREIGN_OPS[i].x, 1.2, easeInOutCubic),
      l().y(FOREIGN_OPS[i].y + 40, 1.2, easeInOutCubic),
      l().opacity(0, 0.5, easeInCubic),
    )),
  );

  yield* all(
    membrane().stroke(FOREIGN_COLOR, 0.6, easeInOutCubic),
    membrane().lineWidth(5, 0.6, easeInOutCubic),
  );
  yield* all(
    membrane().stroke(GRAB_BORDER, 0.9, easeInOutCubic),
    membrane().lineWidth(3, 0.9, easeInOutCubic),
  );

  yield* waitFor(1.1);

  // ═══════════════════════════════════════════════════════════════
  // Act 3 — foreign rules appear and invade (non-overlapping targets)
  // ═══════════════════════════════════════════════════════════════
  yield* all(
    ...rulesRefs.map((r, i) => chain(
      waitFor(i * 0.2),
      all(
        r().opacity(1, 0.4, easeOutCubic),
        rulesLabels[i]().opacity(1, 0.4, easeOutCubic),
      ),
    )),
  );
  yield* waitFor(0.6);

  yield* all(
    ...rulesRefs.map((r, i) => all(
      r().x(RULES_OPS[i].x, 1.0, easeInOutCubic),
      r().y(RULES_OPS[i].y, 1.0, easeInOutCubic),
    )),
    ...rulesLabels.map((l, i) => all(
      l().x(RULES_OPS[i].x, 1.0, easeInOutCubic),
      l().y(RULES_OPS[i].y + 48, 1.0, easeInOutCubic),
      l().opacity(0, 0.4, easeInCubic),
    )),
    membrane().stroke(RULES_COLOR, 0.8, easeInOutCubic),
    membrane().lineWidth(4, 0.8, easeInOutCubic),
  );

  yield* membrane().lineWidth(6, 0.1, linear);
  yield* membrane().lineWidth(4, 0.2, easeOutCubic);

  yield* waitFor(1.3);

  // ═══════════════════════════════════════════════════════════════
  // Act 4 — settle: membrane stays deformed, fill tints red
  // ═══════════════════════════════════════════════════════════════
  yield* membrane().fill('rgba(255, 71, 87, 0.08)', 0.6, easeInOutCubic);
  yield* waitFor(1.4);

  // ═══════════════════════════════════════════════════════════════
  // Act 5 — fade
  // ═══════════════════════════════════════════════════════════════
  yield* root().opacity(0, 0.9, easeInCubic);
  yield* waitFor(0.3);
});
