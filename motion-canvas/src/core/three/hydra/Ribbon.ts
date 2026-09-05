// Hydra / Ribbon — нити постоянной экранной ширины и искры на их концах.
//
// ⚠️ Нить — СПЛОШНАЯ ЛЕНТА, а не LineSegments2. Толстая линия из отдельных
// отрезков рисуется квадами с круглыми торцами; на аддитивном блендинге торцы
// соседних отрезков складываются, и на каждом стыке садится бусина — нить
// читается пунктиром. Лента с общими вершинами стыков не имеет вовсе, ширину
// в пикселях и мягкий край даёт вершинный шейдер.

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Mesh,
  Points,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';

/** Дуга между двумя точками; lift — подъём в долях длины хорды. */
export function arc(a: Vector3, b: Vector3, segs: number, lift: number): Vector3[] {
  const len = a.distanceTo(b);
  const h = len * lift;
  const pts: Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push(new Vector3(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t + Math.sin(Math.PI * t) * h,
      a.z + (b.z - a.z) * t,
    ));
  }
  return pts;
}

export interface RibbonOptions {
  /** Размер буфера рендера — ширина считается в его пикселях. */
  res: Vector2;
  /** Полуширина нити в пикселях буфера. */
  halfWidth?: number;
  /** Добавка полуширины у постоянной нити (hold = 1). */
  holdWidth?: number;
  /** Цвет мерцающей нити. */
  colorA?: string;
  /** Цвет постоянной нити (hold = 1). */
  colorB?: string;
  /** Множитель яркости постоянной: (1 + hold * holdBoost). */
  holdBoost?: number;
  /** Затухание к концам в долях длины: нить не обрывается о якорь. */
  fade?: number;
}

export class Ribbons {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;
  readonly count: number;
  private readonly vv: number;
  private readonly alpha: Float32Array;
  private readonly hold: Float32Array;
  private readonly geometry: BufferGeometry;

  constructor(polylines: Vector3[][], opts: RibbonOptions) {
    if (polylines.length === 0) throw new Error('Ribbons: нет ни одной нити');
    const vn = polylines[0].length;
    for (const p of polylines) {
      if (p.length !== vn) throw new Error('Ribbons: все нити обязаны иметь одно число точек');
    }
    this.count = polylines.length;
    this.vv = vn * 2;

    const total = this.count * this.vv;
    const pos = new Float32Array(total * 3);
    const tan = new Float32Array(total * 3);
    const side = new Float32Array(total);
    const param = new Float32Array(total);
    this.alpha = new Float32Array(total);
    this.hold = new Float32Array(total);
    const idx: number[] = [];

    for (let li = 0; li < this.count; li++) {
      const pts = polylines[li];
      for (let i = 0; i < vn; i++) {
        const prev = pts[Math.max(0, i - 1)];
        const next = pts[Math.min(vn - 1, i + 1)];
        const t = next.clone().sub(prev).normalize().multiplyScalar(5);
        for (let sd = 0; sd < 2; sd++) {
          const v = li * this.vv + i * 2 + sd;
          pos[v * 3] = pts[i].x; pos[v * 3 + 1] = pts[i].y; pos[v * 3 + 2] = pts[i].z;
          tan[v * 3] = t.x; tan[v * 3 + 1] = t.y; tan[v * 3 + 2] = t.z;
          side[v] = sd === 0 ? -1 : 1;
          param[v] = i / (vn - 1);
        }
        if (i < vn - 1) {
          const b = li * this.vv + i * 2;
          idx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
        }
      }
    }

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new Float32BufferAttribute(pos, 3));
    this.geometry.setAttribute('aTangent', new Float32BufferAttribute(tan, 3));
    this.geometry.setAttribute('aSide', new Float32BufferAttribute(side, 1));
    this.geometry.setAttribute('aParam', new Float32BufferAttribute(param, 1));
    // ⚠️ Динамические атрибуты — через BufferAttribute, а не
    // Float32BufferAttribute: последний КОПИРУЕТ массив, и set() писал бы в
    // отвязанную копию — нити молча не загорались бы.
    this.geometry.setAttribute('aAlpha', new BufferAttribute(this.alpha, 1).setUsage(DynamicDrawUsage));
    this.geometry.setAttribute('aHold', new BufferAttribute(this.hold, 1).setUsage(DynamicDrawUsage));
    this.geometry.setIndex(idx);

    const fade = opts.fade ?? 0.07;
    this.material = new ShaderMaterial({
      uniforms: {
        uRes: {value: opts.res},
        uW: {value: opts.halfWidth ?? 1.6},
        uHoldW: {value: opts.holdWidth ?? 0},
        uColorA: {value: new Color(opts.colorA ?? '#ffffff').convertSRGBToLinear()},
        uColorB: {value: new Color(opts.colorB ?? opts.colorA ?? '#ffffff').convertSRGBToLinear()},
        uHoldBoost: {value: opts.holdBoost ?? 0},
        uFade: {value: fade},
      },
      vertexShader: `
        attribute vec3 aTangent;
        attribute float aSide;
        attribute float aParam;
        attribute float aAlpha;
        attribute float aHold;
        uniform vec2 uRes;
        uniform float uW;
        uniform float uHoldW;
        uniform float uFade;
        varying float vSide;
        varying float vAlpha;
        varying float vHold;
        void main() {
          vec4 c0 = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vec4 c1 = projectionMatrix * modelViewMatrix * vec4(position + aTangent, 1.0);
          vec2 d = normalize((c1.xy / c1.w - c0.xy / c0.w) * uRes);
          vec2 n = vec2(-d.y, d.x);
          c0.xy += n * aSide * (uW + aHold * uHoldW) / uRes * 2.0 * c0.w;
          gl_Position = c0;
          vSide = aSide;
          vAlpha = aAlpha * smoothstep(0.0, uFade, aParam) * (1.0 - smoothstep(1.0 - uFade, 1.0, aParam));
          vHold = aHold;
        }
      `,
      fragmentShader: `
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform float uHoldBoost;
        varying float vSide;
        varying float vAlpha;
        varying float vHold;
        void main() {
          if (vAlpha < 0.003) discard;
          float edge = 1.0 - smoothstep(0.25, 1.0, abs(vSide));
          gl_FragColor = vec4(mix(uColorA, uColorB, vHold) * (1.0 + vHold * uHoldBoost), edge * vAlpha);
        }
      `,
      transparent: true,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
  }

  set(i: number, alpha: number, hold: number): void {
    const s = i * this.vv;
    this.alpha.fill(alpha, s, s + this.vv);
    this.hold.fill(hold, s, s + this.vv);
  }

  commit(): void {
    this.geometry.getAttribute('aAlpha').needsUpdate = true;
    this.geometry.getAttribute('aHold').needsUpdate = true;
  }
}

export interface EndSparksOptions {
  /** Размер в пикселях буфера (при refDist — на расстоянии refDist). */
  px: number;
  /** Если задано, размер масштабируется по перспективе: px · refDist / d. */
  refDist?: number;
  minPx?: number;
  maxPx?: number;
  color?: string;
  brightness?: number;
}

/**
 * Концевые узлы: на вспышке загораются оба конца, а не только дуга между
 * ними — «две точки на разных краях поля вспыхивают одновременно».
 */
export class EndSparks {
  readonly points: Points;
  readonly count: number;
  private readonly alpha: Float32Array;
  private readonly geometry: BufferGeometry;

  constructor(polylines: Vector3[][], opts: EndSparksOptions) {
    this.count = polylines.length;
    const pos: number[] = [];
    for (const p of polylines) {
      const a = p[0], b = p[p.length - 1];
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    this.alpha = new Float32Array(this.count * 2);
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new Float32BufferAttribute(pos, 3));
    this.geometry.setAttribute('aAlpha', new BufferAttribute(this.alpha, 1).setUsage(DynamicDrawUsage));

    const col = new Color(opts.color ?? '#ffffff').convertSRGBToLinear().multiplyScalar(opts.brightness ?? 1);
    const mat = new ShaderMaterial({
      uniforms: {
        uPx: {value: opts.px},
        uRef: {value: opts.refDist ?? 0},
        uMin: {value: opts.minPx ?? 1},
        uMax: {value: opts.maxPx ?? 64},
        uColor: {value: col},
      },
      vertexShader: `
        attribute float aAlpha;
        uniform float uPx;
        uniform float uRef;
        uniform float uMin;
        uniform float uMax;
        varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          vA = aAlpha;
          float s = uRef > 0.0 ? uPx * (uRef / max(-mv.z, 1.0)) : uPx;
          gl_PointSize = clamp(s, uMin, uMax);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vA;
        void main() {
          if (vA < 0.004) discard;
          vec2 q = gl_PointCoord - 0.5;
          float r = length(q) * 2.0;
          if (r > 1.0) discard;
          float core = 1.0 - smoothstep(0.6, 1.0, r);
          gl_FragColor = vec4(uColor, core * vA);
        }
      `,
      transparent: true,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });

    this.points = new Points(this.geometry, mat);
    this.points.frustumCulled = false;
  }

  set(i: number, alpha: number): void {
    this.alpha[i * 2] = alpha;
    this.alpha[i * 2 + 1] = alpha;
  }

  commit(): void {
    this.geometry.getAttribute('aAlpha').needsUpdate = true;
  }
}
