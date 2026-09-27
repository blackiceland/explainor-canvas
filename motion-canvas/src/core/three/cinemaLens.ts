import {
  DepthTexture,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedIntType,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';

// ── Объектив для движущейся камеры: расфокус по глубине КАЖДОГО пикселя ─────
// povCompositor размывает слои целиком — это годится, пока камера стоит и
// предметы не заходят друг за друга. Когда камера облетает человека, слой
// «ближе» становится «дальше» посреди кадра, и слои начинают перекрывать друг
// друга неправильно. Здесь мир снимается один раз в HDR с картой глубины, и
// размытие считает шейдер: кружок нерезкости c = K·|1/d − 1/s| (d — глубина
// пикселя, s — фокус, K — px 1080p на диоптрию), как у настоящего объектива.
//
// Размытие — «сбор» по золотой спирали (Gustafsson, «Bokeh depth of field in a
// single pass»): каждый отсчёт вносит вклад, если ЕГО кружок накрывает наш
// пиксель. Поэтому передний план расплывается поверх резкого, а задний не
// «наползает» на резкое лицо. Яркие точки в HDR сами становятся дисками боке —
// рисовать их отдельно не нужно.
//
// ⚠️ Размытие считается в половинном разрешении (дёшево), а резкое — в полном:
// итог смешивается по «сколько размытия пришло в пиксель», а не только по
// собственному кружку, иначе у резкого края остаётся ступенька.

const QUAD = new PlaneGeometry(2, 2);
const ORTHO = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const DEPTH = /* glsl */ `
#include <packing>
uniform sampler2D tDepth;
uniform float near, far, focus, K, scale, maxR;
float dist(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, near, far); }
// радиус кружка, px полного кадра
float cocR(float d) { return min(0.5 * K * abs(1.0 / max(d, 0.02) - 1.0 / focus) * scale, maxR); }
`;

const GATHER = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 px;        // 1 / размер полного кадра
uniform float stepPx;   // шаг спирали, px
varying vec2 vUv;
${DEPTH}
const float GOLDEN = 2.39996323;
void main() {
  float d0 = dist(vUv);
  float r0 = cocR(d0);
  vec3 col = texture2D(tColor, vUv).rgb;
  float tot = 1.0, came = 0.0;
  float radius = stepPx;
  float ang = 0.0;
  for (int i = 0; i < 900; i++) {
    if (radius >= maxR) break;
    vec2 uv = vUv + vec2(cos(ang), sin(ang)) * px * radius;
    vec3 c = texture2D(tColor, uv).rgb;
    float d = dist(uv);
    float r = cocR(d);
    // задний план не заходит на передний дальше, чем тот размыт сам
    if (d > d0) r = min(r, r0 * 2.0);
    float m = smoothstep(radius - 0.5, radius + 0.5, r);
    col += mix(col / tot, c, m);
    tot += 1.0;
    came = max(came, m * r);
    ang += GOLDEN;
    radius += stepPx / radius;
  }
  gl_FragColor = vec4(col / tot, max(r0, came));
}
`;

const FINISH = /* glsl */ `
uniform sampler2D tColor, tBlur;
uniform float time, grain, vignette, aspect;
varying vec2 vUv;
float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
void main() {
  vec3 sharp = texture2D(tColor, vUv).rgb;
  vec4 blur = texture2D(tBlur, vUv);
  vec3 c = mix(sharp, blur.rgb, smoothstep(0.6, 2.2, blur.a));
  // виньетка — только углы, как у реального объектива
  vec2 q = (vUv - 0.5) * vec2(aspect, 1.0);
  c *= 1.0 - vignette * smoothstep(0.45, 1.05, length(q));
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // зерно плёнки — после тона, в видимой яркости; средняя яркость не меняется
  float n = hash(vUv * vec2(1931.0, 1087.0) + fract(time * 24.0) * 17.0) - 0.5;
  float l = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
  gl_FragColor.rgb += n * grain * (0.35 + 0.65 * (1.0 - l)) ;
}
`;

export interface CinemaLensSettings {
  /** Дистанция фокуса, м. */
  focus: number;
  /** Кружок нерезкости: px 1080p на диоптрию (чем больше, тем «светосильнее»). */
  K: number;
  /** Предел радиуса размытия, px 1080p. */
  maxR?: number;
  exposure?: number;
  grain?: number;
  vignette?: number;
  time: number;
}

export class CinemaLens {
  private rt: WebGLRenderTarget | null = null;
  private half: WebGLRenderTarget | null = null;
  // ⚠️ В одном кадре бывают снимки разного размера (лицо W, стол W/2): без кэша
  // буферы пересоздавались бы на каждом снимке.
  private readonly cache = new Map<string, {rt: WebGLRenderTarget; half: WebGLRenderTarget}>();
  private readonly gather: ShaderMaterial;
  private readonly finish: ShaderMaterial;
  private readonly quad = new Mesh(QUAD);
  private readonly post = new Scene();

  constructor(readonly renderer: WebGLRenderer) {
    this.post.add(this.quad);
    this.quad.frustumCulled = false;
    const depthU = {tDepth: {value: null}, near: {value: 0.1}, far: {value: 100}, focus: {value: 1}, K: {value: 30}, scale: {value: 1}, maxR: {value: 40}};
    this.gather = new ShaderMaterial({
      vertexShader: VERT, fragmentShader: GATHER, depthTest: false, depthWrite: false, toneMapped: false,
      uniforms: {...depthU, tColor: {value: null}, px: {value: new Vector2()}, stepPx: {value: 2}},
    });
    this.finish = new ShaderMaterial({
      vertexShader: VERT, fragmentShader: FINISH, depthTest: false, depthWrite: false, toneMapped: true,
      uniforms: {tColor: {value: null}, tBlur: {value: null}, time: {value: 0}, grain: {value: 0.04}, vignette: {value: 0.3}, aspect: {value: 16 / 9}},
    });
  }

  private targets(W: number, H: number) {
    const key = W + 'x' + H;
    let t = this.cache.get(key);
    if (t) {
      this.cache.delete(key);                    // свежий — в конец очереди
    } else {
      const depthTexture = new DepthTexture(W, H, UnsignedIntType);
      depthTexture.minFilter = depthTexture.magFilter = NearestFilter;
      t = {
        rt: new WebGLRenderTarget(W, H, {type: HalfFloatType, format: RGBAFormat, depthTexture, samples: 4, minFilter: LinearFilter, magFilter: LinearFilter}),
        half: new WebGLRenderTarget(Math.ceil(W / 2), Math.ceil(H / 2), {type: HalfFloatType, format: RGBAFormat, minFilter: LinearFilter, magFilter: LinearFilter}),
      };
      if (this.cache.size >= 4) {
        const [oldKey, old] = this.cache.entries().next().value!;
        old.rt.dispose(); old.half.dispose();
        this.cache.delete(oldKey);
      }
    }
    this.cache.set(key, t);
    this.rt = t.rt;
    this.half = t.half;
  }

  /** Снять сцену и отдать готовый кадр (холст рендерера). */
  render(scene: Scene, camera: PerspectiveCamera, W: number, H: number, s: CinemaLensSettings): HTMLCanvasElement {
    const r = this.renderer;
    this.targets(W, H);
    r.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    r.toneMappingExposure = s.exposure ?? 1;

    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 1);
    r.clear();
    r.render(scene, camera);

    const scale = H / 1080;
    const g = this.gather.uniforms;
    g.tColor.value = this.rt!.texture;
    g.tDepth.value = this.rt!.depthTexture;
    g.near.value = camera.near;
    g.far.value = camera.far;
    g.focus.value = s.focus;
    g.K.value = s.K;
    g.scale.value = scale;
    g.maxR.value = (s.maxR ?? 38) * scale;
    g.px.value.set(1 / W, 1 / H);
    // шаг спирали растёт с кадром: число отсчётов не зависит от разрешения
    g.stepPx.value = 1.6 * scale;
    this.quad.material = this.gather;
    r.setRenderTarget(this.half);
    r.render(this.post, ORTHO);

    const f = this.finish.uniforms;
    f.tColor.value = this.rt!.texture;
    f.tBlur.value = this.half!.texture;
    f.time.value = s.time;
    f.grain.value = s.grain ?? 0.035;
    f.vignette.value = s.vignette ?? 0.32;
    f.aspect.value = W / H;
    this.quad.material = this.finish;
    r.setRenderTarget(null);
    r.render(this.post, ORTHO);
    return r.domElement;
  }
}
