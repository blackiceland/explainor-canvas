import {Rect} from '@motion-canvas/2d';
import {
  Camera,
  Color,
  SRGBColorSpace,
  NoToneMapping,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';

export interface ThreeViewConfig {
  width: number;
  height: number;
  scene: Scene;
  camera: Camera;
  quality?: number;
  background?: string | null;
  onRender?: (renderer: WebGLRenderer, scene: Scene, camera: Camera) => void;
}

export interface ThreeView {
  node: Rect;
  dispose: () => void;
}

export function createThreeView(cfg: ThreeViewConfig): ThreeView {
  const quality = cfg.quality ?? 2;
  const renderer = borrowRenderer();
  renderer.setSize(cfg.width * quality, cfg.height * quality);

  if (cfg.background) {
    cfg.scene.background = new Color(cfg.background);
  }

  if (cfg.camera instanceof PerspectiveCamera) {
    cfg.camera.aspect = cfg.width / cfg.height;
    cfg.camera.updateProjectionMatrix();
  } else if (cfg.camera instanceof OrthographicCamera) {
    const ratio = cfg.width / cfg.height;
    const scale = 0.5;
    cfg.camera.left = -ratio * scale;
    cfg.camera.right = ratio * scale;
    cfg.camera.bottom = -scale;
    cfg.camera.top = scale;
    cfg.camera.updateProjectionMatrix();
  }

  const render = cfg.onRender ?? ((r, s, c) => r.render(s, c));

  const rect = new Rect({
    width: cfg.width,
    height: cfg.height,
    fill: '#00000000',
  });

  const origDraw = (rect as any).draw.bind(rect);
  (rect as any).draw = function (context: CanvasRenderingContext2D) {
    render(renderer, cfg.scene, cfg.camera);
    context.imageSmoothingEnabled = true;
    context.drawImage(
      renderer.domElement,
      0, 0,
      quality * cfg.width,
      quality * cfg.height,
      cfg.width / -2,
      cfg.height / -2,
      cfg.width,
      cfg.height,
    );
    origDraw(context);
  };

  return {
    node: rect,
    dispose: () => disposeRenderer(renderer),
  };
}

// Singleton renderer — avoids WebGL context leak on scene reset/seek
let _singleton: WebGLRenderer | null = null;
function borrowRenderer(): WebGLRenderer {
  if (_singleton) return _singleton;
  _singleton = new WebGLRenderer({
    canvas: document.createElement('canvas'),
    alpha: true,
    antialias: true,
  });
  _singleton.outputColorSpace = SRGBColorSpace;
  _singleton.toneMapping = NoToneMapping;
  return _singleton;
}
function disposeRenderer(_renderer: WebGLRenderer) {
  // keep singleton alive — it will be reused on next scene reset
}
