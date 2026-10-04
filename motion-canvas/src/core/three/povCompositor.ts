import {Color, PerspectiveCamera, Scene, Vector3, WebGLRenderer} from 'three';

// ── Сборка POV-кадра: слои по глубине, расфокус объектива, боке, зерно ─────
// Один WebGL-рендер не даёт расфокуса, поэтому мир снят слоями (дальний план,
// средний, ближний дождь, рука с телефоном), и каждый слой размыт по своей
// дистанции: кружок нерезкости c = K·|1/d − 1/s| (пиксели кадра 1080p, d —
// дистанция слоя, s — дистанция фокуса). Перевод фокуса — это движение s,
// а не «размытие одного и проявление другого».
//
// Гауссово размытие даёт мягкие пятна, а объектив рисует ДИСКИ: у светящихся
// точек (головы фонарей, окна) поверх слоя кладётся диск диаметра c с чуть
// светлее краем. Диск не рисуется, пока точка почти в фокусе.

export interface PovLayer {
  scene: Scene;
  /** Дистанция, по которой считается размытие слоя, м. */
  depth: number;
  /** Точки боке, которые рисуются сразу после этого слоя. */
  bokeh?: {pos: Vector3; color: Color; power: number}[];
  /** Предельное размытие слоя, пиксели 1080p (ближний дождь не должен исчезать). */
  maxCoc?: number;
}

export interface PovLens {
  /** Дистанция фокуса, м. */
  focus: number;
  /** Масштаб кружка нерезкости, пиксели 1080p на диоптрию. */
  K: number;
}

export class PovCompositor {
  readonly out: HTMLCanvasElement;
  private readonly layer: HTMLCanvasElement;
  private readonly grain: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly lctx: CanvasRenderingContext2D;
  /** Пикселей выхода на пиксель 1080p. */
  readonly s: number;

  constructor(readonly width: number, readonly height: number) {
    this.s = height / 1080;
    const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    this.out = mk(width, height);
    this.layer = mk(width, height);
    this.ctx = this.out.getContext('2d')!;
    this.lctx = this.layer.getContext('2d')!;
    // зерно: одна большая плитка шума, каждый кадр со своим сдвигом
    this.grain = mk(512, 512);
    const g = this.grain.getContext('2d')!;
    const img = g.createImageData(512, 512);
    let a = 12345;
    for (let i = 0; i < 512 * 512; i++) {
      a = (a * 1664525 + 1013904223) >>> 0;
      const v = 128 + ((a >>> 24) - 128) * 0.9;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }

  private graphiteCanvas: HTMLCanvasElement | null = null;
  private graphiteSolid: HTMLCanvasElement | null = null;
  /** Графит applyBackground с горизонтальной прозрачностью: плотный слева
   *  (до 0.40W), долго тает к 0.90W (smootherstep — пологие концы, края
   *  перехода не читаются). Строится один раз на размер кадра; вместе с ним —
   *  тот же графит сплошной (graphiteSolid): им кадр уходит в графит целиком.
   *  ⚠️ Автор: «переход должен быть более плавный» — первая проба таяла за
   *  0.50W → 0.66W (~300 px) и читалась полосой. На правом крае кода (~950 px)
   *  графит всё ещё ~95 %: код читается на чистом фоне.
   *  ⚠️ Автор: «градиент распадается на переходе графита в видео» — это
   *  бандинг: вертикаль графита — всего ~7 ступенек яркости на весь кадр, а
   *  маска прозрачности квантовалась в 8 бит поверх тёмной картинки. Поэтому
   *  холст считается ПОПИКСЕЛЬНО: цвет и альфа — в дробях, к ним шум меньше
   *  ступеньки, и только потом округление. Шум детерминированный (LCG) —
   *  кадры одинаковые от прогона к прогону. */
  private graphite(): HTMLCanvasElement {
    if (this.graphiteCanvas) return this.graphiteCanvas;
    const {width: W, height: H} = this;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    const img = g.createImageData(W, H);
    const d = img.data;
    const sc = document.createElement('canvas');
    sc.width = W; sc.height = H;
    const sg = sc.getContext('2d')!;
    const simg = sg.createImageData(W, H);
    const sd = simg.data;
    const top = [0x0B, 0x0C, 0x10], bot = [0x12, 0x14, 0x1A];      // Colors.background
    const warm = [246, 231, 212];                                    // тёплое пятно applyBackground
    const sx = W * 0.62, sy = H * 0.38, R = W * 0.95;
    const x0 = W * 0.40, x1 = W * 0.90;
    let seed = 20260929;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    // треугольный шум (разность двух равномерных): ровнее белого, без «соли»
    const tri = () => rnd() - rnd();
    for (let y = 0; y < H; y++) {
      const v = y / (H - 1);
      const base = [0, 1, 2].map(k => top[k] + (bot[k] - top[k]) * v);
      for (let x = 0; x < W; x++) {
        const u = x <= x0 ? 0 : x >= x1 ? 1 : (x - x0) / (x1 - x0);
        const alpha = 1 - u * u * u * (u * (u * 6 - 15) + 10);
        const i = (y * W + x) * 4;
        const dist = Math.hypot(x - sx, y - sy);
        const sa = dist >= R ? 0 : 0.045 * (1 - dist / R);
        for (let k = 0; k < 3; k++) {
          const col = base[k] * (1 - sa) + warm[k] * sa;
          d[i + k] = sd[i + k] = Math.max(0, Math.min(255, Math.round(col + tri())));
        }
        sd[i + 3] = 255;
        d[i + 3] = alpha <= 0 ? 0 : Math.max(0, Math.min(255, Math.round(alpha * 255 + tri())));
      }
    }
    g.putImageData(img, 0, 0);
    sg.putImageData(simg, 0, 0);
    this.graphiteCanvas = c;
    this.graphiteSolid = sc;
    return c;
  }

  private shiftMask: HTMLCanvasElement | null = null;
  private shiftOut: HTMLCanvasElement | null = null;
  /** Графит, сдвинутый вправо на долю ширины `shift`: цвета остаются на своих
   *  местах (вертикаль и тёплое пятно не едут), сдвигается только прозрачность
   *  — левее сдвига графит сплошной. Маска — альфа того же дизеренного
   *  холста graphite(), поэтому полос нет и на ходу. */
  private shiftedGraphite(shift: number): HTMLCanvasElement {
    const {width: W, height: H} = this;
    const fade = this.graphite();
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const mask = this.shiftMask ??= mk();
    const out = this.shiftOut ??= mk();
    const dx = shift * W;
    const m = mask.getContext('2d')!;
    m.clearRect(0, 0, W, H);
    m.fillStyle = '#fff';
    m.fillRect(0, 0, Math.ceil(dx), H);
    m.drawImage(fade, dx, 0);
    const o = out.getContext('2d')!;
    o.globalCompositeOperation = 'source-over';
    o.clearRect(0, 0, W, H);
    o.drawImage(this.graphiteSolid!, 0, 0);
    o.globalCompositeOperation = 'destination-in';
    o.drawImage(mask, 0, 0);
    o.globalCompositeOperation = 'source-over';
    return out;
  }

  private gradeLut: {curve: Float32Array; sw: Float32Array; hw: Float32Array} | null = null;
  /** Кинограйд начала POV (автор, 04.10: «синематик цветовую гамму в начале,
   *  подходящую»). Ночь, дождь, натриевые фонари — классический раскол тил /
   *  янтарь: тени уходят в холодный тил, света (фонари, кожа, боке) — в тёплый
   *  янтарь; мягкая S-кривая добавляет плотности, насыщенность чуть ниже —
   *  цвет «плёночный», не кислотный. amount 0..1 — доля грейда (к коду он
   *  уходит: графит и экран телефона — в своих каноничных цветах). */
  private applyGrade(amount: number): void {
    if (!this.gradeLut) {
      const curve = new Float32Array(256), sw = new Float32Array(256), hw = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = i / 255;
        curve[i] = 255 * (x - 0.16 * Math.sin(2 * Math.PI * x) / (2 * Math.PI));
        sw[i] = (1 - x) ** 2.0;
        hw[i] = x ** 1.6;
      }
      this.gradeLut = {curve, sw, hw};
    }
    const {curve, sw, hw} = this.gradeLut;
    const img = this.ctx.getImageData(0, 0, this.width, this.height);
    const d = img.data;
    const SAT = 0.9;
    const TR = -9, TG = 3, TB = 13;        // тил в тенях
    const WR = 16, WG = 6, WB = -12;       // янтарь в светах
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const L = (54 * r + 183 * g + 19 * b) >> 8;
      const s = sw[L], h = hw[L];
      const R0 = curve[r], G0 = curve[g], B0 = curve[b];
      const Lc = 0.2126 * R0 + 0.7152 * G0 + 0.0722 * B0;
      const R = Lc + SAT * (R0 - Lc) + s * TR + h * WR;
      const G = Lc + SAT * (G0 - Lc) + s * TG + h * WG;
      const B = Lc + SAT * (B0 - Lc) + s * TB + h * WB;
      d[i] = r + amount * (R - r);
      d[i + 1] = g + amount * (G - g);
      d[i + 2] = b + amount * (B - b);
    }
    this.ctx.putImageData(img, 0, 0);
  }

  private drawGrain(time: number, amount: number): void {
    const {ctx, width: W, height: H, s} = this;
    ctx.globalAlpha = amount;
    ctx.globalCompositeOperation = 'overlay';
    const f = Math.floor(time * 24);
    const ox = (f * 197) % 512, oy = (f * 331) % 512;
    const pat = ctx.createPattern(this.grain, 'repeat')!;
    ctx.save();
    ctx.translate(-ox, -oy);
    ctx.scale(s, s);
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W / s + 1024, H / s + 1024);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  coc(lens: PovLens, d: number): number {
    return lens.K * Math.abs(1 / Math.max(d, 0.05) - 1 / lens.focus);
  }

  render(renderer: WebGLRenderer, camera: PerspectiveCamera, layers: PovLayer[], lens: PovLens,
    opts: {time: number; grain?: number; vignette?: number; exposure?: number[];
      shade?: number; shift?: number; cover?: number; grade?: number}): HTMLCanvasElement {
    const {width: W, height: H, ctx, lctx, s} = this;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    // Графит слева — под код, когда телефон уходит вправо (duplicationStreetPovSceneEn).
    // Автор: «код на нашем графите с плавным переходом в картинку справа». Это
    // РОВНО applyBackground всех код-сцен ролика (вертикаль #0B0C10 → #12141A +
    // еле тёплое пятно света), плотный до правого края кода и тающий к
    // телефону. Кладётся ПОД последний слой (рука с телефоном) — рука его не
    // получает. Зерно ложится поверх и дизерит переход: полос нет.
    // ⚠️ Вуаль поверх руки и улицы («всё кроме телефона почти в графите»)
    // автор пробовал и отверг (02.10) — не возвращать.
    // `shift` — графит едет вправо (доля ширины) и выталкивает руку с
    // телефоном за кадр; `cover` = 1 — кадр целиком в графите.
    const shade = Math.min(1, opts.shade ?? 0);
    const shift = Math.max(0, opts.shift ?? 0);
    const cover = Math.max(0, Math.min(1, opts.cover ?? 0));
    const gamt = opts.grain ?? 0.07;
    // Кадр целиком в графите — мир под ним не виден: не рендерим его.
    if (cover >= 1) {
      ctx.globalAlpha = 1;
      this.graphite();
      ctx.drawImage(this.graphiteSolid!, 0, 0);
      if (gamt > 0) this.drawGrain(opts.time, gamt);
      return this.out;
    }
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const view = new Vector3();
    layers.forEach((L, li) => {
      if (shade > 0 && li === layers.length - 1) {
        ctx.globalAlpha = shade;
        ctx.drawImage(shift > 0 ? this.shiftedGraphite(shift) : this.graphite(), 0, 0);
        ctx.globalAlpha = 1;
      }
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      if (opts.exposure) renderer.toneMappingExposure = opts.exposure[li] ?? 1;
      renderer.render(L.scene, camera);
      lctx.clearRect(0, 0, W, H);
      lctx.drawImage(renderer.domElement, 0, 0, W, H);
      const c = Math.min(this.coc(lens, L.depth), L.maxCoc ?? Infinity);
      const sigma = c / 2.83 * s;
      ctx.filter = sigma > 0.35 ? `blur(${sigma.toFixed(2)}px)` : 'none';
      ctx.drawImage(this.layer, 0, 0);
      ctx.filter = 'none';
      // диски боке
      if (L.bokeh?.length) {
        ctx.globalCompositeOperation = 'lighter';
        for (const b of L.bokeh) {
          view.copy(b.pos).applyMatrix4(camera.matrixWorldInverse);
          const d = -view.z;
          if (d <= 0.1) continue;
          const cc = this.coc(lens, d);
          const r = cc / 2 * s;
          if (r < 2.2 * s) continue;
          const p = b.pos.clone().project(camera);
          const x = (p.x * 0.5 + 0.5) * W, y = (-p.y * 0.5 + 0.5) * H;
          if (x < -r || x > W + r || y < -r || y > H + r) continue;
          // энергия точки размазана по диску: чем больше диск, тем он тусклее
          const a = Math.min(0.85, b.power * 26 / Math.max(6, cc)) * Math.min(1, (r / s - 2.2) / 3);
          const col = `${Math.round(b.color.r * 255)},${Math.round(b.color.g * 255)},${Math.round(b.color.b * 255)}`;
          const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, `rgba(${col},${a * 0.72})`);
          gr.addColorStop(0.82, `rgba(${col},${a * 0.8})`);
          gr.addColorStop(0.93, `rgba(${col},${a})`);
          gr.addColorStop(1, `rgba(${col},0)`);
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    });
    // виньетка — мягко, только углы; под графитом слабее — там канон applyBackground
    const vig = (opts.vignette ?? 0.35) * (1 - 0.6 * shade);
    if (vig > 0) {
      const gr = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.56);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, `rgba(0,0,0,${vig})`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
    }
    // кинограйд (начало POV): до графита и зерна — зерно ложится уже на грейд
    const grade = Math.max(0, Math.min(1, opts.grade ?? 0));
    if (grade > 0) this.applyGrade(grade);
    // кадр уходит в графит целиком — тем же графитом, что под кодом
    if (cover > 0) {
      this.graphite();
      ctx.globalAlpha = cover;
      ctx.drawImage(this.graphiteSolid!, 0, 0);
      ctx.globalAlpha = 1;
    }
    // зерно плёнки: overlay по серому 128 не меняет среднюю яркость
    if (gamt > 0) this.drawGrain(opts.time, gamt);
    return this.out;
  }
}
