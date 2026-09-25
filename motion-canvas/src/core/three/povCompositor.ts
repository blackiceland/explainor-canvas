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

  coc(lens: PovLens, d: number): number {
    return lens.K * Math.abs(1 / Math.max(d, 0.05) - 1 / lens.focus);
  }

  render(renderer: WebGLRenderer, camera: PerspectiveCamera, layers: PovLayer[], lens: PovLens,
    opts: {time: number; grain?: number; vignette?: number; exposure?: number[]}): HTMLCanvasElement {
    const {width: W, height: H, ctx, lctx, s} = this;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const view = new Vector3();
    layers.forEach((L, li) => {
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
    // виньетка — мягко, только углы
    const vig = opts.vignette ?? 0.35;
    if (vig > 0) {
      const gr = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.56);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, `rgba(0,0,0,${vig})`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
    }
    // зерно плёнки: overlay по серому 128 не меняет среднюю яркость
    const gamt = opts.grain ?? 0.07;
    if (gamt > 0) {
      ctx.globalAlpha = gamt;
      ctx.globalCompositeOperation = 'overlay';
      const f = Math.floor(opts.time * 24);
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
    return this.out;
  }
}
