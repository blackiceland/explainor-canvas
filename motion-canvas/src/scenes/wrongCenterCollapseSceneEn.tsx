import {makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {
  all,
  createRef,
  createSignal,
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
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
import {Fonts, Screen} from '../core/theme';
import {createThreeView} from '../core/three/ThreeCanvas';

// ── Globe ──────────────────────────────────────────────────────────────
const GLOBE_R = 200;
const GLOBE_VP = 700;
const GLOBE_OMEGA = 0.12;

function buildGlobe() {
  const geom = new SphereGeometry(GLOBE_R, 24, 16);
  const sphereMat = new MeshBasicMaterial({color: 0x000000, transparent: true, opacity: 0});
  const sphere = new Mesh(geom, sphereMat);
  const lineMat = new LineBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.9});
  const edges = new LineSegments(new EdgesGeometry(geom, 1), lineMat);
  sphere.add(edges);
  return {sphere, lineMat};
}

// ═════════════════════════════════════════════════════════════════════════
export default makeScene2D(function* (view) {
  view.add(<Rect width={Screen.width} height={Screen.height} fill="#000000" />);

  // ── Signals driving the collapse ────────────────────────────────────
  const redness = createSignal(0);
  const omegaBoost = createSignal(0);
  const globeOpacity = createSignal(1);
  const grabScale = createSignal(1);

  // ── 3D wireframe globe ──────────────────────────────────────────────
  const scene3 = new ThreeScene();
  const cam = new PerspectiveCamera(50, 1, 1, 2000);
  cam.position.set(0, 0, 600);
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
      lineMat.opacity = 0.9 * globeOpacity();

      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(s, c);
    },
  });
  globeView.node.opacity(0);
  view.add(globeView.node);

  // ── Center anchor: "grab" ───────────────────────────────────────────
  const grabRef = createRef<Txt>();
  view.add(
    <Txt
      ref={grabRef}
      text="grab"
      fontFamily={Fonts.primary}
      fontWeight={700}
      fontSize={72}
      letterSpacing={2}
      fill="#FFFFFF"
      opacity={0}
    />,
  );
  grabRef().scale(() => grabScale());

  // ═════════════════════════════════════════════════════════════════════
  // Act 1 — intro: the wrong center revealed
  // ═════════════════════════════════════════════════════════════════════
  yield* all(
    globeView.node.opacity(1, 0.9, easeOutCubic),
    grabRef().opacity(1, 0.9, easeOutCubic),
  );
  yield* waitFor(1.6);

  // ═════════════════════════════════════════════════════════════════════
  // Act 2 — quiet collapse: redness + orbit slip, then fade to black
  // ═════════════════════════════════════════════════════════════════════
  yield* all(
    redness(1, 1.5, easeInOutCubic),
    omegaBoost(4, 1.5, easeInCubic),
    grabRef().fill('#FF3A2E', 1.3, easeInOutCubic),
    grabScale(1.5, 1.2, easeInOutCubic),
  );

  yield* all(
    globeOpacity(0, 1.4, easeInCubic),
    grabRef().opacity(0, 1.2, easeInOutCubic),
  );

  yield* waitFor(0.4);
});
