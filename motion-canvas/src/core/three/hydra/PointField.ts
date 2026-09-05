// Hydra / PointField — поле плотности: поверхность, показанная только точками.
//
// ⚠️ Главный механизм — НАКОПЛЕНИЕ, а не освещение. Ни окклюдеров, ни depth-
// теста: луч взгляда проходит поверхность насквозь и складывает все складки,
// что попались по пути. Альфа одной точки ничтожна — равнина в три-четыре
// слоя остаётся серой, смятый массив в сорок слоёв уходит в белый. Яркость
// здесь есть буквально плотность вещества вдоль луча. Стоит включить
// окклюзию — и поле мгновенно станет матовым 3D-рельефом.
//
// Из этого следует остальное:
//   • Ни грамма bloom. Достоверность стиля держится на том, что точка жёсткая
//     и в два пикселя; свечение размазывает её и уводит в экранную заставку.
//   • Монохром. Иерархия целиком на плотности; второй цвет её подменяет.
//   • Размер точки постоянный на экране, не по перспективе: это точка графика,
//     а не объект в пространстве. Отъезд камеры сам добавляет точек в кадр.
//
// Что поле НЕ умеет: простое выпуклое тело. Куб или шар луч пересекает дважды —
// получается ровное серое пятно с яркой каймой. Поле говорит «сколько», а не
// «что».

import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
} from 'three';
import type {Rng} from './noise';

export interface PointFieldBuffers {
  /** n × 3 */
  position: Float32Array;
  /** n — расстояние до якоря раскрытия */
  dist: Float32Array;
  /** n — 1 у геройского узла */
  hero: Float32Array;
}

export interface PointFieldOptions {
  /** Размер точки в пикселях БУФЕРА рендера. */
  px?: number;
  /** Размер геройской точки; меняется по ходу сцены через setHeroPx. */
  heroPx?: number;
  /** Вклад ОДНОЙ точки. Белый набирается слоями, не яркостью. */
  alpha?: number;
  heroAlpha?: number;
  color?: string;
}

export class PointField {
  readonly points: Points;
  readonly material: ShaderMaterial;
  readonly geometry: BufferGeometry;

  constructor(buf: PointFieldBuffers, opts: PointFieldOptions = {}) {
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new Float32BufferAttribute(buf.position, 3));
    this.geometry.setAttribute('aDist', new Float32BufferAttribute(buf.dist, 1));
    this.geometry.setAttribute('aHero', new Float32BufferAttribute(buf.hero, 1));

    this.material = new ShaderMaterial({
      uniforms: {
        uRevealR: {value: -1e9},
        uEdge: {value: 60},
        uPx: {value: opts.px ?? 2.2},
        uHeroPx: {value: opts.heroPx ?? 30},
        uAlpha: {value: opts.alpha ?? 0.16},
        uHeroAlpha: {value: opts.heroAlpha ?? 0.95},
        uGain: {value: 1},
        uColor: {value: new Color(opts.color ?? '#ffffff').convertSRGBToLinear()},
      },
      vertexShader: `
        attribute float aDist;
        attribute float aHero;
        uniform float uRevealR;
        uniform float uEdge;
        uniform float uPx;
        uniform float uHeroPx;
        varying float vVis;
        varying float vHero;
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vVis = aHero > 0.5 ? 1.0 : 1.0 - smoothstep(uRevealR, uRevealR + uEdge, aDist);
          vHero = aHero;
          gl_PointSize = mix(uPx, uHeroPx, aHero);
        }
      `,
      fragmentShader: `
        uniform float uAlpha;
        uniform float uHeroAlpha;
        uniform float uGain;
        uniform vec3 uColor;
        varying float vVis;
        varying float vHero;
        void main() {
          if (vVis < 0.004) discard;
          vec2 q = gl_PointCoord - 0.5;
          float r = length(q) * 2.0;
          if (r > 1.0) discard;
          // Жёсткий круг со сглаженной кромкой в один пиксель. Никаких
          // ореолов: мягкий спад превращает поле в дымку и убивает счётность.
          float core = 1.0 - smoothstep(0.72, 1.0, r);
          float a = mix(uAlpha * uGain, uHeroAlpha, vHero);
          gl_FragColor = vec4(uColor, core * a * vVis);
        }
      `,
      transparent: true,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });

    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  /** Фронт раскрытия: видны точки с dist < radius, кромка шириной edge. */
  setReveal(radius: number, edge: number): void {
    this.material.uniforms.uRevealR.value = radius;
    this.material.uniforms.uEdge.value = edge;
  }

  setGain(gain: number): void {
    this.material.uniforms.uGain.value = gain;
  }

  setHeroPx(px: number): void {
    this.material.uniforms.uHeroPx.value = px;
  }

  /**
   * ⚠️ Экспозиция. Число слоёв на луче растёт вместе с отходом камеры: вблизи
   * поверхность пересекается один раз, и при финальной альфе поле почти
   * невидимо; вдали — десятки раз. Без компенсации начало сцены — чёрный кадр
   * с одной точкой. Это не физика, а выдержка: картинка здесь график, а не
   * съёмка, и выдержку график иметь вправе.
   */
  static exposure(refLen: number, len: number, max = 4.5, k = 0.35): number {
    return Math.min(max, Math.pow(refLen / Math.max(len, 1e-3), k));
  }
}

// ── Сэмплеры ──────────────────────────────────────────────────────────────

export interface HeightfieldSpec {
  width: number;
  depth: number;
  nx: number;
  nz: number;
  height: (x: number, z: number) => number;
  /**
   * Джиттер в долях ячейки. Строгая решётка при фронтальном взгляде даёт
   * муар; 0.6 — ряд ещё читается прядью, а сетка уже не видна. Больше — ряды
   * перемешиваются в снег.
   */
  jitter?: number;
  /** Геройский узел: добавляется отдельной точкой, от него считается dist. */
  hero?: {x: number; z: number};
  rnd: Rng;
}

export interface HeightfieldBuffers extends PointFieldBuffers {
  /** Высота геройского узла (или 0, если героя нет). */
  heroY: number;
  /** Индекс геройской точки в буфере (или -1). */
  heroIndex: number;
}

/**
 * Поле высот на решётке nx × nz. Поле шире кадра делается сознательно: равнина
 * обязана уходить за обе кромки, иначе в кадр попадает граница и всё
 * превращается в объект на столе.
 */
export function sampleHeightfield(spec: HeightfieldSpec): HeightfieldBuffers {
  const {width, depth, nx, nz, height, rnd} = spec;
  const jitter = spec.jitter ?? 0.6;
  const hasHero = !!spec.hero;
  const n = nx * nz + (hasHero ? 1 : 0);

  const position = new Float32Array(n * 3);
  const dist = new Float32Array(n);
  const hero = new Float32Array(n);

  const hx = spec.hero?.x ?? 0;
  const hz = spec.hero?.z ?? 0;
  const hy = hasHero ? height(hx, hz) : 0;

  const cx = width / nx, cz = depth / nz;
  let k = 0;
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = (ix / (nx - 1) - 0.5) * width + (rnd() - 0.5) * cx * jitter;
      const z = (iz / (nz - 1) - 0.5) * depth + (rnd() - 0.5) * cz * jitter;
      const y = height(x, z);
      position[k * 3] = x; position[k * 3 + 1] = y; position[k * 3 + 2] = z;
      dist[k] = Math.hypot(x - hx, y - hy, z - hz);
      k++;
    }
  }

  let heroIndex = -1;
  if (hasHero) {
    position[k * 3] = hx; position[k * 3 + 1] = hy; position[k * 3 + 2] = hz;
    dist[k] = 0;
    hero[k] = 1;
    heroIndex = k;
  }

  return {position, dist, hero, heroY: hy, heroIndex};
}
