import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');

export const ENDPOINT = 'fal-ai/bytedance/omnihuman/v1.5';

// fal bills OmniHuman 1.5 per second of generated video (= audio length).
// Override with OMNI_PRICE_PER_SEC if fal changes the rate.
export const PRICE_PER_SEC = Number(process.env.OMNI_PRICE_PER_SEC ?? 0.16);

export const LIMITS = {
  '1080p': 30,
  '720p': 60,
};

export const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
export const AUDIO_EXT = new Set(['.wav', '.mp3', '.m4a', '.aac', '.flac', '.ogg', '.opus']);

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
};

export const mimeOf = (file) => MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';

export function loadEnv() {
  const candidates = [path.join(ROOT, '.env'), path.join(process.cwd(), '.env')];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      process.loadEnvFile(file);
    } catch {
      // malformed .env — env vars already in the shell still apply
    }
  }
}

export function requireKey() {
  const key = process.env.FAL_KEY || process.env.FAL_API_KEY;
  if (!key) {
    throw new Error(
      'FAL_KEY is not set. Put it in omni/.env as FAL_KEY=... (see .env.example) or export it in the shell.',
    );
  }
  return key;
}
