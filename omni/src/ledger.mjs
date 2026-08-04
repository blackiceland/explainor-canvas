import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Append-only record of everything that costs money or can be resumed:
 * submitted request ids, completed jobs, failures.
 */
export class Ledger {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'jobs.jsonl');
  }

  async append(entry) {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.appendFile(this.file, `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`);
  }

  async entries() {
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      return raw
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  /** Completed jobs keyed by input fingerprint, so a rerun skips work already paid for. */
  async completed() {
    const done = new Map();
    for (const entry of await this.entries()) {
      if (entry.kind === 'done' && entry.key) done.set(entry.key, entry);
    }
    return done;
  }

  async pending() {
    const byRequest = new Map();
    for (const entry of await this.entries()) {
      if (!entry.requestId) continue;
      if (entry.kind === 'submitted') byRequest.set(entry.requestId, entry);
      if (entry.kind === 'done' || entry.kind === 'failed' || entry.kind === 'cancelled') {
        byRequest.delete(entry.requestId);
      }
    }
    return [...byRequest.values()];
  }

  async spent() {
    let total = 0;
    for (const entry of await this.entries()) {
      if (entry.kind === 'done') total += entry.costUsd ?? 0;
    }
    return total;
  }
}
