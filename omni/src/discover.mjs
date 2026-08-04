import fs from 'node:fs/promises';
import path from 'node:path';

import { AUDIO_EXT, IMAGE_EXT } from './config.mjs';

const stem = (file) => path.basename(file, path.extname(file));

export const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'clip';

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile()).map((e) => path.join(dir, e.name));
  const dirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'out')
    .map((e) => path.join(dir, e.name));
  return {
    dirs,
    images: files.filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase())),
    audios: files.filter((f) => AUDIO_EXT.has(path.extname(f).toLowerCase())),
    texts: files.filter((f) => path.extname(f).toLowerCase() === '.txt'),
  };
}

async function readPrompt(candidates) {
  for (const file of candidates) {
    if (!file) continue;
    try {
      const text = (await fs.readFile(file, 'utf8')).trim();
      if (text) return text;
    } catch {
      /* missing prompt file is fine */
    }
  }
  return undefined;
}

function pairFlat(images, audios) {
  const pairs = [];
  if (images.length === 1) return audios.map((audio) => ({ image: images[0], audio }));
  if (audios.length === 1) return images.map((image) => ({ image, audio: audios[0] }));

  const byStem = new Map(images.map((f) => [stem(f), f]));
  for (const audio of audios) {
    const image = byStem.get(stem(audio));
    if (image) pairs.push({ image, audio });
  }
  return pairs;
}

/**
 * Discovers clips in `dir`. Two supported layouts:
 *   - one subfolder per clip (image + audio [+ prompt.txt] inside)
 *   - a flat folder: matching basenames, or one photo shared across many tracks
 */
export async function discoverJobs(dir) {
  const root = await listFiles(dir);
  const rootPrompt = root.texts.find((f) => path.basename(f).toLowerCase() === 'prompt.txt');
  const jobs = [];

  for (const sub of root.dirs) {
    const inner = await listFiles(sub);
    if (inner.images.length === 0 || inner.audios.length === 0) continue;
    for (const { image, audio } of pairFlat(inner.images, inner.audios)) {
      jobs.push({
        name: inner.audios.length > 1 ? `${path.basename(sub)}-${stem(audio)}` : path.basename(sub),
        dir: sub,
        image,
        audio,
        prompt: await readPrompt([
          path.join(sub, `${stem(audio)}.txt`),
          path.join(sub, 'prompt.txt'),
          rootPrompt,
        ]),
      });
    }
  }

  for (const { image, audio } of pairFlat(root.images, root.audios)) {
    jobs.push({
      name: stem(audio) === stem(image) ? stem(audio) : `${stem(image)}-${stem(audio)}`,
      dir,
      image,
      audio,
      prompt: await readPrompt([path.join(dir, `${stem(audio)}.txt`), rootPrompt]),
    });
  }

  const seen = new Set();
  return jobs.filter((job) => {
    const key = `${job.image}|${job.audio}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
