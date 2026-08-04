import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fal } from '@fal-ai/client';

import { ENDPOINT, mimeOf, requireKey } from './config.mjs';

let configured = false;

export function client() {
  if (!configured) {
    fal.config({ credentials: requireKey() });
    configured = true;
  }
  return fal;
}

const UPLOAD_TTL_MS = 12 * 60 * 60 * 1000;

async function readCache(cacheFile) {
  try {
    const raw = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
    const now = Date.now();
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => now - v.ts < UPLOAD_TTL_MS));
  } catch {
    return {};
  }
}

export async function hashFile(file) {
  const hash = createHash('sha256');
  hash.update(await fs.readFile(file));
  return hash.digest('hex');
}

/** Upload a local file to fal storage, reusing a recent upload of identical bytes. */
export async function uploadFile(file, cacheFile) {
  const digest = await hashFile(file);
  const cache = await readCache(cacheFile);
  if (cache[digest]) return { url: cache[digest].url, cached: true };

  const buffer = await fs.readFile(file);
  const blob = new File([buffer], path.basename(file), { type: mimeOf(file) });
  const url = await client().storage.upload(blob);

  cache[digest] = { url, ts: Date.now(), name: path.basename(file) };
  await fs.mkdir(path.dirname(cacheFile), { recursive: true });
  await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2));
  return { url, cached: false };
}

export async function submit(input) {
  const { request_id } = await client().queue.submit(ENDPOINT, { input });
  return request_id;
}

export async function waitFor(requestId, onUpdate) {
  return client().queue.subscribeToStatus(ENDPOINT, {
    requestId,
    pollInterval: 3000,
    logs: false,
    onQueueUpdate: onUpdate,
  });
}

export async function fetchResult(requestId) {
  const { data } = await client().queue.result(ENDPOINT, { requestId });
  return data;
}

export async function status(requestId) {
  return client().queue.status(ENDPOINT, { requestId });
}

export async function cancel(requestId) {
  return client().queue.cancel(ENDPOINT, { requestId });
}

export async function download(url, destFile) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status} ${res.statusText}`);
  await fs.mkdir(path.dirname(destFile), { recursive: true });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destFile));
  return destFile;
}

export function describeError(error) {
  const body = error?.body;
  const detail = body?.detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => `${(d.loc ?? []).join('.')}: ${d.msg}`).join('; ');
  }
  if (typeof detail === 'string') return detail;
  return error?.message ?? String(error);
}
