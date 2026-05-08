import {makeScene2D} from '@motion-canvas/2d';
import {
  createSignal,
  easeInOutCubic,
  easeOutCubic,
  waitFor,
} from '@motion-canvas/core';
import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  DoubleSide,
} from 'three';
import {createThreeView} from '../core/three/ThreeCanvas';
import {ProcTree, type ProcTreeInstance} from '../core/three/proctree';
import {applyBackground} from '../core/utils';

const VIEW_W = 1920;
const VIEW_H = 1080;

// Build a Three.js BufferGeometry from one of proctree's mesh halves.
function buildGeometry(
  verts: number[][],
  normals: number[][],
  uvs: number[][],
  faces: number[][],
): BufferGeometry {
  const geom = new BufferGeometry();
  const positions = new Float32Array(verts.length * 3);
  const norms = new Float32Array(verts.length * 3);
  const uvArr = new Float32Array(verts.length * 2);
  for (let i = 0; i < verts.length; i++) {
    positions[i * 3 + 0] = verts[i][0];
    positions[i * 3 + 1] = verts[i][1];
    positions[i * 3 + 2] = verts[i][2];
    norms[i * 3 + 0] = normals[i][0];
    norms[i * 3 + 1] = normals[i][1];
    norms[i * 3 + 2] = normals[i][2];
    uvArr[i * 2 + 0] = uvs[i][0];
    uvArr[i * 2 + 1] = uvs[i][1];
  }
  const idx = new Uint32Array(faces.length * 3);
  for (let i = 0; i < faces.length; i++) {
    idx[i * 3 + 0] = faces[i][0];
    idx[i * 3 + 1] = faces[i][1];
    idx[i * 3 + 2] = faces[i][2];
  }
  geom.setAttribute('position', new BufferAttribute(positions, 3));
  geom.setAttribute('normal', new BufferAttribute(norms, 3));
  geom.setAttribute('uv', new BufferAttribute(uvArr, 2));
  geom.setIndex(new BufferAttribute(idx, 1));
  return geom;
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  const scene = new Scene();
  const camera = new PerspectiveCamera(34, VIEW_W / VIEW_H, 0.1, 200);
  camera.position.set(0, 5.5, 18);
  camera.lookAt(0, 4, 0);

  // ── Lighting ─────────────────────────────────────────────────────────
  scene.add(new AmbientLight(0xffefdd, 0.5));
  const sun = new DirectionalLight(0xfff0d8, 1.4);
  sun.position.set(6, 10, 4);
  scene.add(sun);
  const rim = new DirectionalLight(0x6680aa, 0.55);
  rim.position.set(-6, 4, -5);
  scene.add(rim);

  // ── Tree generation ──────────────────────────────────────────────────
  const tree: ProcTreeInstance = new ProcTree({
    seed: 42,
    segments: 12,
    levels: 5,
    maxRadius: 0.18,
    branchFactor: 2.5,
    radiusFalloffRate: 0.65,
    treeSteps: 8,
    taperRate: 0.94,
    twistRate: 6,
    trunkLength: 2.6,
    initalBranchLength: 0.85,
    clumpMax: 0.62,
    clumpMin: 0.42,
    sweepAmount: 0.04,
    twigScale: 0.55,
    vMultiplier: 0.85,
  });

  const trunkGeom = buildGeometry(tree.verts, tree.normals, tree.UV, tree.faces);
  const twigGeom  = buildGeometry(tree.vertsTwig, tree.normalsTwig, tree.uvsTwig, tree.facesTwig);

  const trunkMat = new MeshStandardMaterial({
    color: 0x6b4d35,
    roughness: 0.92,
    metalness: 0.0,
    flatShading: false,
  });
  const twigMat = new MeshStandardMaterial({
    color: 0x6b8a3e,
    roughness: 0.85,
    metalness: 0.0,
    side: DoubleSide,
    transparent: true,
    opacity: 0.55,
    flatShading: false,
  });

  const treeGroup = new Group();
  treeGroup.add(new Mesh(trunkGeom, trunkMat));
  treeGroup.add(new Mesh(twigGeom, twigMat));
  scene.add(treeGroup);

  // ── Animation signals ────────────────────────────────────────────────
  const growSig = createSignal(0);
  const orbitSig = createSignal(0);

  const threeView = createThreeView({
    width: VIEW_W,
    height: VIEW_H,
    scene,
    camera,
    onRender: (renderer, s, c) => {
      const g = growSig();
      treeGroup.scale.set(g, g, g);
      const angle = orbitSig();
      const radius = 11;
      camera.position.x = Math.sin(angle) * radius;
      camera.position.z = Math.cos(angle) * radius;
      camera.position.y = 4 + Math.cos(angle * 0.5) * 0.6;
      camera.lookAt(0, 3.6, 0);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(s, c);
    },
  });
  view.add(threeView.node);

  // ── Beats: grow first, then a slow orbit ─────────────────────────────
  yield* growSig(1, 3.2, easeOutCubic);
  yield* waitFor(0.4);
  yield* orbitSig(Math.PI * 0.45, 4.5, easeInOutCubic);
  yield* waitFor(1.5);
});
