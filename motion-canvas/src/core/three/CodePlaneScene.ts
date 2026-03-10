import {
  CanvasTexture,
  DoubleSide,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
} from 'three';
import {tokenizeLine} from '../code/model/Tokenizer';
import {getTokenColor, SyntaxTheme} from '../code/model/SyntaxTheme';

export interface CodePlaneConfig {
  planeWidth: number;
  planeHeight: number;
  cameraFov: number;
  cameraZ?: number;
  aspect?: number;
}

const DEFAULTS: Omit<CodePlaneConfig, 'cameraZ' | 'aspect'> = {
  planeWidth: 6,
  planeHeight: 10,
  cameraFov: 50,
};

export function createCodePlaneScene(cfg: Partial<CodePlaneConfig> = {}) {
  const c = {...DEFAULTS, ...cfg};

  const fovRad = (c.cameraFov * Math.PI) / 180;
  const cameraZ = c.cameraZ ?? (c.planeHeight / 2) / Math.tan(fovRad / 2);
  const aspect = c.aspect ?? c.planeWidth / c.planeHeight;

  const scene = new Scene();

  const camera = new PerspectiveCamera(c.cameraFov, aspect, 0.1, 100);
  camera.position.set(0, 0, cameraZ);

  const geometry = new PlaneGeometry(c.planeWidth, c.planeHeight);
  const texture = new CanvasTexture(document.createElement('canvas'));
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;

  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: DoubleSide,
  });

  const plane = new Mesh(geometry, material);
  scene.add(plane);

  return {scene, camera, plane, texture, material, geometry};
}

export interface RenderCodeOptions {
  dimmedLines?: Set<number>;
  dimmedAlpha?: number;
  /** Подсвечивать только имена методов и их аргументы в скобках; остальное затемнять */
  highlightMethodCalls?: boolean;
}

export function renderCodeToCanvas(
  lines: string[],
  theme: SyntaxTheme,
  fontFamily: string,
  fontSize: number,
  customTypes: string[],
  canvasWidth: number,
  bgColor: string = '#1a1a2e',
  opts: RenderCodeOptions = {},
): HTMLCanvasElement {
  const lineH = Math.round(fontSize * 1.62);
  const paddingX = 24;
  const paddingY = 16;
  const totalH = lines.length * lineH + paddingY * 2;
  const dimmed = opts.dimmedLines;
  const dimAlpha = opts.dimmedAlpha ?? 0.10;

  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth * dpr;
  canvas.height = totalH * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvasWidth, totalH);

  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'middle';

  const hlMethods = opts.highlightMethodCalls ?? false;
  const CTRL = new Set(['if', 'else', 'while', 'for', 'switch', 'catch', 'try', 'throw', 'throws', 'new', 'return', 'synchronized', 'assert']);
  let carryDepth = 0; // незакрытые скобки метода с предыдущей строки

  for (let i = 0; i < lines.length; i++) {
    const tokens = tokenizeLine(lines[i], customTypes);
    let x = paddingX;
    const y = paddingY + i * lineH + lineH / 2;

    const lineDimmed = dimmed && dimmed.has(i);

    if (hlMethods && !lineDimmed) {
      const bright: boolean[] = new Array(tokens.length).fill(false);

      // Если с предыдущей строки остались незакрытые скобки — вся строка продолжение аргументов
      let depth = carryDepth;
      if (depth > 0) {
        for (let t = 0; t < tokens.length; t++) {
          bright[t] = true;
          if (tokens[t].text === '(') depth++;
          if (tokens[t].text === ')') { depth--; if (depth <= 0) break; }
        }
      }

      for (let t = 0; t < tokens.length; t++) {
        const tok = tokens[t];
        if (tok.text.trim().length === 0) continue;
        if (CTRL.has(tok.text)) continue;

        let nextIdx = -1;
        for (let j = t + 1; j < tokens.length; j++) {
          if (tokens[j].text.trim().length > 0) { nextIdx = j; break; }
        }
        if (nextIdx < 0) continue;

        let prevIdx = -1;
        for (let j = t - 1; j >= 0; j--) {
          if (tokens[j].text.trim().length > 0) { prevIdx = j; break; }
        }
        if (prevIdx >= 0 && tokens[prevIdx].text === 'new') continue;

        const isName = tokens[nextIdx].text === '(' &&
          (tok.type === 'method' || tok.type === 'plain');
        if (!isName) continue;

        bright[t] = true;
        let d = 0;
        for (let j = nextIdx; j < tokens.length; j++) {
          if (tokens[j].text === '(') d++;
          bright[j] = true;
          if (tokens[j].text === ')') { d--; if (d <= 0) break; }
        }
      }

      // Для определений методов: подсвечиваем модификаторы и тип возврата до имени
      const isDefinition = /^\s*(public|private|protected)\s+/.test(lines[i]);
      if (isDefinition) {
        for (let t = 0; t < tokens.length; t++) {
          if (bright[t]) break;
          bright[t] = true;
        }
      }

      // Обновляем carryDepth: считаем баланс скобок методов на этой строке
      carryDepth = 0;
      for (let t = 0; t < tokens.length; t++) {
        if (bright[t]) {
          if (tokens[t].text === '(') carryDepth++;
          if (tokens[t].text === ')') carryDepth--;
        }
      }
      if (carryDepth < 0) carryDepth = 0;

      for (let t = 0; t < tokens.length; t++) {
        ctx.globalAlpha = bright[t] ? 1 : dimAlpha;
        ctx.fillStyle = getTokenColor(tokens[t].type, theme);
        ctx.fillText(tokens[t].text, x, y);
        x += ctx.measureText(tokens[t].text).width;
      }
    } else {
      carryDepth = 0;
      ctx.globalAlpha = lineDimmed ? dimAlpha : 1;
      for (const token of tokens) {
        ctx.fillStyle = getTokenColor(token.type, theme);
        ctx.fillText(token.text, x, y);
        x += ctx.measureText(token.text).width;
      }
    }
  }
  ctx.globalAlpha = 1;

  return canvas;
}

export function updateTexture(
  texture: CanvasTexture,
  sourceCanvas: HTMLCanvasElement,
) {
  texture.image = sourceCanvas;
  texture.needsUpdate = true;
}
