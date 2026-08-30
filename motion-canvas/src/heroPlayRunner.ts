import './global.css';
import project from './heroProject?project';
import {Renderer, Vector2} from '@motion-canvas/core';

// Просмотрщик ОДНОЙ сцены без редактора.
//
//   http://127.0.0.1:5173/heroplay.html?scene=<имя>[&fps=30&from=0&w=1920&h=1080]
//
// Зачем он существует: редактор при открытии пересчитывает проект и живёт в
// тяжёлой вкладке; когда он болеет, автор не может даже посмотреть сцену.
// Плеер строит Renderer над проектом из ОДНОЙ сцены (как shotRunner) и гонит
// реальное время: секунда сцены = секунда на часах, дорогие кадры честно
// пропускаются (seek вперёд без отрисовки промежуточных).
//
// Правка файла сцены перезагружает страницу через HMR, и плеер ПРОДОЛЖАЕТ С
// ТОГО ЖЕ КАДРА (sessionStorage) — быстрый цикл «правка → смотрю этот же бит».
// Запись .meta заглушена в play.html на уровне вебсокета.

async function ensureFontsLoaded(timeoutMs = 10_000): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const families = new Set([...document.fonts].map(f => f.family.replace(/["']/g, '')));
    if (families.has('Newsreader') && families.has('JetBrains Mono')) break;
    await new Promise(r => setTimeout(r, 100));
  }
  await Promise.all([...document.fonts].map(f => f.load().catch(() => null)));
  await document.fonts.ready;
}

const $ = (id: string) => document.getElementById(id)!;
const setStatus = (t: string) => ($('status').textContent = t);

function showError(err: unknown) {
  const pre = document.createElement('pre');
  pre.className = 'err';
  pre.textContent = String(err instanceof Error ? (err.stack ?? err.message) : err);
  $('stage').replaceChildren(pre);
  setStatus('Error');
}

function showIndex(names: string[]) {
  const wrap = document.createElement('div');
  wrap.id = 'index';
  const head = document.createElement('div');
  head.textContent = 'Сцены проекта — кликни, чтобы посмотреть:';
  head.style.marginBottom = '12px';
  wrap.appendChild(head);
  for (const n of names) {
    const a = document.createElement('a');
    a.href = `/heroplay.html?scene=${encodeURIComponent(n)}`;
    a.textContent = n;
    wrap.appendChild(a);
  }
  $('stage').replaceChildren(wrap);
  setStatus(`${names.length} scene(s)`);
}

async function main() {
  const q = new URLSearchParams(location.search);
  const sceneName = q.get('scene');
  const fps = Number(q.get('fps') ?? '30') || 30;
  const width = Number(q.get('w') ?? '1920') || 1920;
  const height = Number(q.get('h') ?? '1080') || 1080;

  const descriptions = project.scenes as any[];
  if (!sceneName) {
    showIndex(descriptions.map(s => s?.name).filter(Boolean));
    return;
  }
  const description = descriptions.find(s => s?.name === sceneName);
  if (!description) {
    showIndex(descriptions.map(s => s?.name).filter(Boolean));
    throw new Error(`Сцена "${sceneName}" не найдена — список выше.`);
  }

  setStatus('Fonts…');
  await ensureFontsLoaded();

  const renderer = new Renderer({...(project as any), scenes: [description]});
  const playback = (renderer as any).playback;
  const settings = {
    name: project.name,
    range: [0, 0] as [number, number],
    fps,
    exporter: {
      name: '@motion-canvas/core/image-sequence',
      options: {fileType: 'image/png', quality: 100, groupByScene: false},
    },
    size: new Vector2(width, height),
    resolutionScale: 1,
    colorSpace: 'srgb',
    background: null,
  };

  renderer.stage.configure(settings as any);
  playback.fps = fps;
  await (renderer as any).reloadScenes(settings);
  setStatus('Measuring…');
  await playback.recalculate();
  await playback.reset();
  const duration = Math.max(1, playback.duration as number);

  $('stage').replaceChildren(renderer.stage.finalBuffer);

  // старт: ?from= → иначе кадр, сохранённый до HMR-перезагрузки
  const saveKey = `play:${sceneName}`;
  const fromParam = q.get('from');
  let cur = -1;
  let acc =
    fromParam != null
      ? (Number(fromParam) || 0) / fps
      : Number(sessionStorage.getItem(saveKey) ?? '0') / fps;
  if (!Number.isFinite(acc) || acc < 0 || acc * fps >= duration) acc = 0;

  const state = {playing: true, speed: 1, loop: true, busy: false};
  (window as any).__PLAY = {scene: sceneName, duration, fps, frame: () => cur, state};

  const hud = () => {
    const f = Math.max(0, cur);
    ($('fill') as HTMLElement).style.width = `${((f / (duration - 1)) * 100).toFixed(2)}%`;
    setStatus(
      `${sceneName} · ${f}/${duration - 1} · ${(f / fps).toFixed(2)}s/${(duration / fps).toFixed(1)}s` +
        ` · ×${state.speed}${state.playing ? '' : ' · PAUSED'}${state.loop ? '' : ' · no-loop'}`,
    );
  };

  const show = async (frame: number) => {
    frame = Math.max(0, Math.min(duration - 1, Math.round(frame)));
    if (state.busy) return;
    state.busy = true;
    try {
      if (frame < cur) setStatus('seek…');
      await playback.seek(frame);
      await renderer.stage.render(playback.currentScene, playback.previousScene);
      cur = frame;
      sessionStorage.setItem(saveKey, String(cur));
      hud();
    } finally {
      state.busy = false;
    }
  };

  const seekTo = async (frame: number) => {
    acc = Math.max(0, Math.min(duration - 1, frame)) / fps;
    await show(acc * fps);
  };

  $('progress').addEventListener('click', e => {
    const r = ($('progress') as HTMLElement).getBoundingClientRect();
    void seekTo(((e.clientX - r.left) / r.width) * (duration - 1));
  });
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') { state.playing = !state.playing; hud(); e.preventDefault(); }
    else if (e.code === 'ArrowLeft') { state.playing = false; void seekTo(cur - (e.shiftKey ? fps : 1)); }
    else if (e.code === 'ArrowRight') { state.playing = false; void seekTo(cur + (e.shiftKey ? fps : 1)); }
    else if (e.code === 'Home') { void seekTo(0); }
    else if (e.code === 'KeyL') { state.loop = !state.loop; hud(); }
    else if (e.code === 'Digit1') { state.speed = 0.5; hud(); }
    else if (e.code === 'Digit2') { state.speed = 1; hud(); }
    else if (e.code === 'Digit3') { state.speed = 2; hud(); }
  });

  // реальное время: пропускаем кадры, если рендер не успевает
  let last = performance.now();
  const tick = async (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    if (state.playing && !state.busy) {
      acc += dt * state.speed;
      let target = Math.floor(acc * fps);
      if (target >= duration) {
        if (state.loop) { acc = 0; target = 0; }
        else { acc = (duration - 1) / fps; target = duration - 1; state.playing = false; }
      }
      if (target !== cur) await show(target);
    }
    requestAnimationFrame(tick);
  };
  await show(Math.floor(acc * fps));
  requestAnimationFrame(tick);
}

main().catch(showError);
