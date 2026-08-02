import {defineConfig, type Plugin} from 'vite';
import motionCanvas from '@motion-canvas/vite-plugin';

const motionCanvasFactory = (motionCanvas as unknown as {default?: typeof motionCanvas}).default ?? motionCanvas;

// Ранний ack записи .meta — подтверждаем ПОЛУЧЕНИЕ, а не завершение записи.
// MetaFile.saveData в браузере ждёт `motion-canvas:meta-ack` максимум 1000 мс,
// а штатный обработчик @motion-canvas/vite-plugin отвечает только ПОСЛЕ
// fs.writeFile — медленный диск (антивирус, вотчеры IDE) пробивал секунду и
// редактор спамил «Connection timeout when updating metadata». Сам файл
// по-прежнему пишет штатный обработчик; двойной ack безвреден — клиент
// удаляет запись из sourceLookup при первом resolve, второй уходит в `?.()`.
const metaAckFast = (): Plugin => ({
  name: 'motion-canvas:meta-ack-fast',
  configureServer(server) {
    server.ws.on('motion-canvas:meta', (data: any, client: any) => {
      const source = data?.source;
      if (typeof source === 'string' && !source.startsWith('\0')) {
        client.send('motion-canvas:meta-ack', {source});
      }
    });
  },
});

export default defineConfig({
  plugins: [motionCanvasFactory({
    project: ['./src/project.ts', './src/verticalProject.ts', './src/subtitleOverlayProject.ts', './src/treeProject.ts'],
  }), metaAckFast()],
  resolve: {
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
