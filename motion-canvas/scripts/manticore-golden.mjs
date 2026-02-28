import {readFileSync} from 'fs';
import {resolve, dirname} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const statesSrc = readFileSync(resolve(ROOT, 'src/scenes/codeWithActionsSceneRu.states.ts'), 'utf-8');

const tests = [];

function addTest(name, fn) {
  tests.push({name, fn});
}

function parseStates(src) {
  const states = new Map();
  const re = /export const (CODE_\w+)\s*=\s*f\(`([\s\S]*?)`\);/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    states.set(m[1], m[2].replace(/\r\n/g, '\n'));
  }
  return states;
}

function extractMethods(code) {
  const lines = code.split('\n');
  const methods = new Map();
  let currentName = null;
  let start = -1;
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sig = line.match(/^(public|private)\s+\S+\s+(\w+)\s*\(/);
    if (sig && currentName === null) {
      currentName = sig[2];
      start = i;
      depth = 0;
    }
    if (currentName !== null) {
      for (const ch of line) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
      if (depth === 0 && i > start) {
        methods.set(currentName, lines.slice(start, i + 1).join('\n'));
        currentName = null;
        start = -1;
      }
    }
  }
  return methods;
}

function changedMethods(prevCode, nextCode) {
  const prev = extractMethods(prevCode);
  const next = extractMethods(nextCode);
  const changed = new Set();
  for (const [name, body] of next) {
    if (!prev.has(name)) {
      changed.add(name);
      continue;
    }
    if (prev.get(name) !== body) changed.add(name);
  }
  for (const [name] of prev) {
    if (!next.has(name)) changed.add(name);
  }
  return [...changed];
}

const states = parseStates(statesSrc);
const required = [
  'CODE_V2a_export',
  'CODE_V2a_prepare',
  'CODE_V2b_export',
  'CODE_V2b',
  'CODE_V3d_sig',
  'CODE_V3d',
  'CODE_V3f_encode',
  'CODE_V3f',
];

addTest('required states exist', () => {
  for (const name of required) {
    if (!states.has(name)) throw new Error(`Missing state ${name}`);
  }
});

addTest('subtitleTrack lands in prepareFrames signature only on prepare step', () => {
  const a = states.get('CODE_V2a_export');
  const b = states.get('CODE_V2a_prepare');
  if (!a.includes('prepareFrames(byte[] sourceFrames, String colorProfile)')) {
    throw new Error('CODE_V2a_export signature mismatch');
  }
  if (!b.includes('prepareFrames(byte[] sourceFrames, String colorProfile, String subtitleTrack)')) {
    throw new Error('CODE_V2a_prepare missing subtitleTrack in signature');
  }
  const diff = changedMethods(a, b);
  if (!(diff.length === 1 && diff[0] === 'prepareFrames')) {
    throw new Error(`Expected only prepareFrames to change, got [${diff.join(', ')}]`);
  }
});

addTest('v2b_export removes runEncoder and switches to encodeWithRetry', () => {
  const code = states.get('CODE_V2b_export');
  if (code.includes('byte[] encodedVideo = runEncoder(preparedFrames);')) {
    throw new Error('runEncoder line still present in CODE_V2b_export');
  }
  if (!code.includes('return encodeWithRetry(preparedFrames, outputFormat);')) {
    throw new Error('encodeWithRetry return missing in CODE_V2b_export');
  }
});

addTest('v2b introduces encodeWithRetry and encode methods', () => {
  const code = states.get('CODE_V2b');
  if (!code.includes('private byte[] encodeWithRetry(')) {
    throw new Error('encodeWithRetry method missing');
  }
  if (!code.includes('private byte[] encode(byte[] preparedFrames, String outputFormat)')) {
    throw new Error('encode method missing');
  }
});

addTest('v3d expands prepareFrames with watermark and audio', () => {
  const a = states.get('CODE_V3d_sig');
  const b = states.get('CODE_V3d');
  const diff = changedMethods(a, b);
  if (!(diff.length === 1 && diff[0] === 'prepareFrames')) {
    throw new Error(`Expected only prepareFrames to change, got [${diff.join(', ')}]`);
  }
  if (!b.includes('applyWatermark(subtitledFrames, watermarkMode)')) {
    throw new Error('watermark pipeline missing');
  }
  if (!b.includes('return normalizeAudio(watermarkedFrames, audioProfile);')) {
    throw new Error('audio normalization missing');
  }
});

addTest('v3f adds finalizeExport method as final step', () => {
  const a = states.get('CODE_V3f_encode');
  const b = states.get('CODE_V3f');
  const diff = changedMethods(a, b);
  if (!(diff.length === 1 && diff[0] === 'finalizeExport')) {
    throw new Error(`Expected only finalizeExport to change, got [${diff.join(', ')}]`);
  }
  if (!b.includes('private byte[] finalizeExport(')) {
    throw new Error('finalizeExport method missing');
  }
});

let failures = 0;
for (const t of tests) {
  try {
    t.fn();
    console.log(`PASS ${t.name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL ${t.name}`);
    console.log(`  ${e.message}`);
  }
}

if (failures > 0) {
  process.exit(1);
}

console.log(`OK ${tests.length} golden checks`);
