import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

function resolveBinary(envVar, staticPath, fallback) {
  const fromEnv = process.env[envVar];
  if (fromEnv) return fromEnv;
  if (staticPath && existsSync(staticPath)) return staticPath;
  return fallback;
}

let cached = null;

async function binaries() {
  if (cached) return cached;
  let ffmpegStatic = null;
  let ffprobeStatic = null;
  try {
    ffmpegStatic = (await import('ffmpeg-static')).default;
  } catch {
    /* optional */
  }
  try {
    ffprobeStatic = (await import('ffprobe-static')).default?.path ?? null;
  } catch {
    /* optional */
  }
  cached = {
    ffmpeg: resolveBinary('OMNI_FFMPEG', ffmpegStatic, 'ffmpeg'),
    ffprobe: resolveBinary('OMNI_FFPROBE', ffprobeStatic, 'ffprobe'),
  };
  return cached;
}

export async function ffmpegInfo() {
  const { ffmpeg, ffprobe } = await binaries();
  const check = async (bin) => {
    try {
      await exec(bin, ['-version']);
      return bin;
    } catch {
      return null;
    }
  };
  return { ffmpeg: await check(ffmpeg), ffprobe: await check(ffprobe) };
}

export async function probeDuration(file) {
  const { ffprobe } = await binaries();
  const { stdout } = await exec(ffprobe, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=nw=1:nk=1',
    file,
  ]);
  const seconds = Number(String(stdout).trim());
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`ffprobe could not read a duration from ${path.basename(file)}`);
  }
  return seconds;
}

export async function trimAudio(input, seconds, outFile) {
  const { ffmpeg } = await binaries();
  await exec(ffmpeg, ['-y', '-i', input, '-t', String(seconds), '-vn', outFile], {
    maxBuffer: 1024 * 1024 * 16,
  });
  return outFile;
}

/** Replace the model's re-encoded audio with the original master, keeping the video stream untouched. */
export async function remuxOriginalAudio(videoFile, audioFile, outFile) {
  const { ffmpeg } = await binaries();
  await exec(
    ffmpeg,
    [
      '-y',
      '-i',
      videoFile,
      '-i',
      audioFile,
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '320k',
      '-shortest',
      '-movflags',
      '+faststart',
      outFile,
    ],
    { maxBuffer: 1024 * 1024 * 16 },
  );
  return outFile;
}
