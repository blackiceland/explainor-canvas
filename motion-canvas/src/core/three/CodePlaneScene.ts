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

export function renderCodeToCanvas(
  lines: string[],
  theme: SyntaxTheme,
  fontFamily: string,
  fontSize: number,
  customTypes: string[],
  canvasWidth: number,
  bgColor: string = '#1a1a2e',
): HTMLCanvasElement {
  const lineH = Math.round(fontSize * 1.62);
  const paddingX = 24;
  const paddingY = 16;
  const totalH = lines.length * lineH + paddingY * 2;

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

  for (let i = 0; i < lines.length; i++) {
    const tokens = tokenizeLine(lines[i], customTypes);
    let x = paddingX;
    const y = paddingY + i * lineH + lineH / 2;

    for (const token of tokens) {
      ctx.fillStyle = getTokenColor(token.type, theme);
      ctx.fillText(token.text, x, y);
      x += ctx.measureText(token.text).width;
    }
  }

  return canvas;
}

export function updateTexture(
  texture: CanvasTexture,
  sourceCanvas: HTMLCanvasElement,
) {
  texture.image = sourceCanvas;
  texture.needsUpdate = true;
}
