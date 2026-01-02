import {Node} from '@motion-canvas/2d';
import {BBox} from '@motion-canvas/core';
import {Screen} from '../theme';

/**
 * Compute a world-space bounding box for any node using Motion Canvas' own cacheBBox.
 * This is stable for debug overlays and layout instrumentation.
 */
export function worldBBox(node: Node): BBox {
  const corners = node.cacheBBox().transformCorners(node.localToWorld());
  const boxA = BBox.fromPoints(...corners);
  const boxB = new BBox(boxA.x - Screen.width / 2, boxA.y - Screen.height / 2, boxA.width, boxA.height);

  // Prefer the bbox variant whose center is closer to the node's own position().
  const pos = (node as any).position?.();
  if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
    const dA = (boxA.center.x - pos.x) ** 2 + (boxA.center.y - pos.y) ** 2;
    const dB = (boxB.center.x - pos.x) ** 2 + (boxB.center.y - pos.y) ** 2;
    return dB < dA ? boxB : boxA;
  }

  // Fallback: auto-detect screen space (0..W / 0..H).
  const looksLikeScreenSpace =
    boxA.left >= -1 &&
    boxA.top >= -1 &&
    boxA.right <= Screen.width + 1 &&
    boxA.bottom <= Screen.height + 1;

  return looksLikeScreenSpace ? boxB : boxA;
}


