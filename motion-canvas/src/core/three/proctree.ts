// Thin wrapper around proctree.js (Paul Brunt, BSD license).
// proctree.js is an IIFE that attaches `Tree` to window/globalThis.
// We import it for its side effect, then re-export the constructor.

// @ts-expect-error — proctree-source.js has no TypeScript types
import {Tree as _Tree} from './proctree-source.js';

export type ProcTreeProperties = {
  clumpMax?: number;
  clumpMin?: number;
  lengthFalloffFactor?: number;
  lengthFalloffPower?: number;
  branchFactor?: number;
  radiusFalloffRate?: number;
  climbRate?: number;
  trunkKink?: number;
  maxRadius?: number;
  treeSteps?: number;
  taperRate?: number;
  twistRate?: number;
  segments?: number;
  levels?: number;
  sweepAmount?: number;
  initalBranchLength?: number;
  trunkLength?: number;
  dropAmount?: number;
  growAmount?: number;
  vMultiplier?: number;
  twigScale?: number;
  seed?: number;
};

export interface ProcTreeInstance {
  verts: number[][];      // [x, y, z][]
  faces: number[][];      // [a, b, c][]
  normals: number[][];    // [nx, ny, nz][]
  UV: number[][];         // [u, v][]
  vertsTwig: number[][];
  normalsTwig: number[][];
  facesTwig: number[][];
  uvsTwig: number[][];
}

type ProcTreeCtor = new (props: ProcTreeProperties) => ProcTreeInstance;

export const ProcTree = _Tree as ProcTreeCtor;
