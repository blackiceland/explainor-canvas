import {spawn} from 'node:child_process';

import {chromium} from 'playwright';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i += 2;
      } else {
        out[key] = true;
        i += 1;
      }
    } else {
      // Support positional scene name: `npm run still -- dryFiltersSceneV3`
      out.scene = out.scene ?? a;
      i += 1;
    }
  }
  return out;
}

async function waitForHttpOk(url: string, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, {method: 'GET'});
      if (res.ok) return;
    } catch {
      // ignore
    }
    await sleep(250);
  }
  throw new Error(`Dev server did not become ready: ${url}`);
}

function startDevServer(port: number) {
  const npmCmd = process.platform === 'win32' ? 'npm' : 'npm';
  const child = spawn(
    npmCmd,
    [
      '--prefix',
      '../motion-canvas',
      'run',
      'dev',
      '--',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    {stdio: 'inherit', shell: true},
  );

  return child;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const port = Number(args.port ?? 5173);
  const fps = Number(args.fps ?? 60);
  const frameRaw = args.frame;
  const framesRaw = args.frames;
  const globalFrame = args.globalFrame !== undefined ? Number(args.globalFrame) : undefined;
  const scene = typeof args.scene === 'string' ? args.scene : '';
  const timeoutMs = Number(args.timeoutMs ?? 120_000);
  const keepServer = Boolean(args.keepServer);

  const baseUrl = `http://127.0.0.1:${port}`;
  const makeStillUrl = (frame: number) => {
    const stillUrl = new URL(`${baseUrl}/still.html`);
    if (scene) stillUrl.searchParams.set('scene', scene);
    if (Number.isFinite(frame)) stillUrl.searchParams.set('frame', String(frame));
    if (globalFrame !== undefined && Number.isFinite(globalFrame)) stillUrl.searchParams.set('globalFrame', String(globalFrame));
    stillUrl.searchParams.set('fps', String(fps));
    stillUrl.searchParams.set('timeoutMs', String(timeoutMs));
    return stillUrl;
  };

  // Reuse an already running server if possible; otherwise start one.
  let server: ReturnType<typeof startDevServer> | null = null;
  try {
    await waitForHttpOk(`${baseUrl}/still.html`, 1500);
  } catch {
    server = startDevServer(port);
  }

  try {
    await waitForHttpOk(`${baseUrl}/`, timeoutMs);

    const browser = await chromium.launch({headless: true});
    const runOnce = async (localFrame: number) => {
      const page = await browser.newPage();
      const url = makeStillUrl(localFrame);
      // On slower Windows machines, first Vite compile of /src/stillRunner.ts can take a while.
      await page.goto(url.toString(), {waitUntil: 'domcontentloaded', timeout: timeoutMs});

      await page.waitForFunction(
        () => Boolean((window as any).__MC_STILL_DONE) || Boolean((window as any).__MC_STILL_ERROR),
        undefined,
        {timeout: timeoutMs},
      );

      const error = await page.evaluate(() => (window as any).__MC_STILL_ERROR ?? null);
      const info = await page.evaluate(() => (window as any).__MC_STILL ?? null);
      await page.close();

      if (error) throw new Error(String(error));
      return info;
    };

    // Frame selection:
    // - If --frames is provided: export all listed frames.
    // - Else if --frame is provided: export that frame.
    // - Else: for scene exports default to ~2 seconds (helps with scenes that appear after a beat/slow).
    let frames: number[] = [];
    if (typeof framesRaw === 'string') {
      frames = framesRaw
        .split(',')
        .map(s => Number(s.trim()))
        .filter(n => Number.isFinite(n));
    } else if (typeof frameRaw === 'string') {
      const f = Number(frameRaw);
      frames = Number.isFinite(f) ? [f] : [];
    } else {
      frames = [scene ? Math.round(fps * 2) : 0];
    }

    const results: any[] = [];
    for (const f of frames) {
      results.push(await runOnce(f));
    }

    await browser.close();

    // eslint-disable-next-line no-console
    console.log('\n=== STILL EXPORTED ===');
    for (const r of results) console.log(r);
    // eslint-disable-next-line no-console
    console.log('=====================\n');
  } finally {
    if (!keepServer && server) {
      server.kill();
    }
  }
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


