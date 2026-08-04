import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { LIMITS, PRICE_PER_SEC } from './config.mjs';
import { slugify } from './discover.mjs';
import { describeError, download, fetchResult, hashFile, submit, uploadFile, waitFor } from './fal.mjs';
import { Spinner, dim, secs, usd, warn } from './log.mjs';
import { probeDuration, remuxOriginalAudio, trimAudio } from './media.mjs';

export const costOf = (seconds) => seconds * PRICE_PER_SEC;

/** Reads durations and prices a job without spending anything. */
export async function prepareJob(job, opts) {
  const limit = LIMITS[opts.resolution];
  let seconds = opts.seconds ?? (await probeDuration(job.audio));
  let trimTo = null;

  if (seconds > limit + 0.05) {
    if (!opts.trim) {
      throw new Error(
        `audio is ${secs(seconds)} but ${opts.resolution} allows ${limit}s — ` +
          `use --res 720p (up to ${LIMITS['720p']}s), pass --trim, or cut the track yourself`,
      );
    }
    trimTo = limit;
    seconds = limit;
  }

  const imageHash = await hashFile(job.image);
  const audioHash = await hashFile(job.audio);
  const key = createHash('sha256')
    .update([imageHash, audioHash, opts.resolution, opts.turbo, job.prompt ?? '', trimTo ?? ''].join('|'))
    .digest('hex')
    .slice(0, 16);

  return {
    ...job,
    slug: slugify(job.name),
    seconds,
    trimTo,
    key,
    costUsd: costOf(seconds),
    outFile: path.join(opts.outDir, `${slugify(job.name)}.mp4`),
  };
}

async function resolveAudio(job, tmpDir) {
  if (!job.trimTo) return job.audio;
  await fs.mkdir(tmpDir, { recursive: true });
  const trimmed = path.join(tmpDir, `${job.slug}-trimmed${path.extname(job.audio) || '.wav'}`);
  await trimAudio(job.audio, job.trimTo, trimmed);
  return trimmed;
}

export async function runJob(job, ctx) {
  const { opts, ledger, cacheFile } = ctx;
  const tmpDir = path.join(opts.outDir, '.tmp');
  const label = job.name;

  const audioFile = await resolveAudio(job, tmpDir);
  const spinner = new Spinner(`${label}: uploading`).start();

  try {
    const [image, audio] = await Promise.all([
      uploadFile(job.image, cacheFile),
      uploadFile(audioFile, cacheFile),
    ]);

    const input = {
      image_url: image.url,
      audio_url: audio.url,
      resolution: opts.resolution,
      ...(opts.turbo ? { turbo_mode: true } : {}),
      ...(job.prompt ? { prompt: job.prompt } : {}),
    };

    spinner.update(`${label}: submitting`);
    const requestId = await submit(input);
    ctx.inFlight.add(requestId);
    await ledger.append({
      kind: 'submitted',
      key: job.key,
      requestId,
      name: job.name,
      image: job.image,
      audio: job.audio,
      seconds: job.seconds,
      estCostUsd: job.costUsd,
      input: { ...input, image_url: image.url, audio_url: audio.url },
      outFile: job.outFile,
    });

    spinner.update(`${label}: queued  ${dim(requestId)}`);
    await waitFor(requestId, (update) => {
      if (update.status === 'IN_QUEUE') {
        spinner.update(`${label}: queue position ${update.queue_position ?? '?'}  ${dim(requestId)}`);
      } else if (update.status === 'IN_PROGRESS') {
        spinner.update(`${label}: generating  ${dim(requestId)}`);
      }
    });

    const data = await fetchResult(requestId);
    ctx.inFlight.delete(requestId);
    const videoUrl = data?.video?.url;
    if (!videoUrl) throw new Error('fal returned no video url');

    spinner.update(`${label}: downloading`);
    await fs.mkdir(opts.outDir, { recursive: true });
    const raw = opts.remux ? path.join(tmpDir, `${job.slug}-raw.mp4`) : job.outFile;
    await download(videoUrl, raw);

    if (opts.remux) {
      spinner.update(`${label}: restoring master audio`);
      try {
        await remuxOriginalAudio(raw, audioFile, job.outFile);
        await fs.rm(raw, { force: true });
      } catch (error) {
        warn(`${label}: remux failed (${error.message.split('\n')[0]}), keeping fal audio`);
        await fs.rename(raw, job.outFile);
      }
    }

    const actualSeconds = data?.duration ?? job.seconds;
    const costUsd = costOf(actualSeconds);
    await ledger.append({
      kind: 'done',
      key: job.key,
      requestId,
      name: job.name,
      seconds: actualSeconds,
      costUsd,
      outFile: job.outFile,
      videoUrl,
    });

    spinner.stop(`${'✓'} ${label}  ${secs(actualSeconds)}  ${usd(costUsd)}  ${dim(job.outFile)}`);
    return { job, requestId, outFile: job.outFile, costUsd };
  } catch (error) {
    spinner.stop();
    const message = describeError(error);
    await ledger.append({ kind: 'failed', key: job.key, name: job.name, error: message });
    throw new Error(`${label}: ${message}`);
  }
}

export async function runPool(jobs, concurrency, worker) {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (cursor < jobs.length) {
      const index = cursor++;
      try {
        results[index] = { status: 'ok', value: await worker(jobs[index]) };
      } catch (error) {
        results[index] = { status: 'error', error };
      }
    }
  });
  await Promise.all(runners);
  return results;
}
