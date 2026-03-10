import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';
import motionCanvas from '@motion-canvas/vite-plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const motionCanvasFactory = (motionCanvas as unknown as {default?: typeof motionCanvas}).default ?? motionCanvas;

export default defineConfig({
  plugins: [motionCanvasFactory()],
  resolve: {
    alias: {
      // Явное разрешение three — иначе Vite иногда не находит пакет (500 на ThreeCanvas/CodePlaneScene)
      three: path.resolve(__dirname, 'node_modules/three/build/three.module.js'),
    },
    dedupe: ['three'],
  },
  optimizeDeps: {
    include: ['three'],
  },
  ssr: {
    noExternal: ['three'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
      interval: 500
    }
  }
});
