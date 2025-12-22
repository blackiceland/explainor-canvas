import {defineConfig} from 'vite';
import motionCanvas from '@motion-canvas/vite-plugin';

const motionCanvasFactory = (motionCanvas as unknown as {default?: typeof motionCanvas}).default ?? motionCanvas;

export default defineConfig({
  plugins: [motionCanvasFactory()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
      interval: 500
    }
  }
});
