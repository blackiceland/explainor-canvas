import {makeScene2D, Txt} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

type P3 = {x: number; y: number; z: number};

function fibonacciSphere(count: number): P3[] {
  const pts: P3[] = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    pts.push({x: Math.cos(theta) * r, y, z: Math.sin(theta) * r});
  }
  return pts;
}

export default makeScene2D(function* (view) {
  applyBackground(view);

  const points = fibonacciSphere(420);
  const refs = points.map(() => createRef<Txt>());
  const glyphs = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

  view.add(
    <>
      {points.map((_, i) => (
        <Txt
          ref={refs[i]}
          text={glyphs[i % glyphs.length]}
          fontFamily={Fonts.code}
          fontSize={16}
          fontWeight={600}
          fill={'rgba(244,241,235,0.86)'}
          x={0}
          y={0}
          opacity={0}
        />
      ))}
    </>,
  );

  const radius = 260;
  const fov = 620;
  const cx = 0;
  const cy = 0;

  let yaw = 0;
  let pitch = -0.2;
  const dt = 1 / 60;
  const total = 11.5;
  const steps = Math.floor(total / dt);

  const setFrame = () => {
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    const order = points.map((_, i) => i);
    order.sort((a, b) => points[a].z - points[b].z);

    for (const i of order) {
      const p = points[i];

      // Yaw
      const x1 = p.x * cosY - p.z * sinY;
      const z1 = p.x * sinY + p.z * cosY;
      const y1 = p.y;

      // Pitch
      const y2 = y1 * cosP - z1 * sinP;
      const z2 = y1 * sinP + z1 * cosP;
      const x2 = x1;

      const zWorld = z2 * radius;
      const scale = fov / (fov + zWorld + radius * 0.8);
      const x = cx + x2 * radius * scale;
      const y = cy + y2 * radius * scale;
      const alpha = Math.max(0.10, Math.min(1, 0.18 + (z2 + 1) * 0.42));
      const size = 8 + scale * 18;

      const t = refs[i]();
      t.position([x, y]);
      t.fontSize(size);
      t.opacity(alpha);
    }
  };

  for (let i = 0; i < steps; i++) {
    yaw += 0.018;
    pitch += 0.0012;
    setFrame();
    yield* waitFor(dt);
  }
});

