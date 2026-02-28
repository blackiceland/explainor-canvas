/**
 * Chimera — scene validator for Manticore engine.
 * Validates states, transitions, and orchestration integrity.
 *
 * Usage: node scripts/chimera.mjs
 */

import {readFileSync} from 'fs';
import {resolve, dirname} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const MAX_LINE_CHARS = 93;
const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const WARN = '\x1b[33m!\x1b[0m';

let totalPass = 0;
let totalFail = 0;
let totalWarn = 0;

function pass(msg) { totalPass++; console.log(`  ${PASS} ${msg}`); }
function fail(msg) { totalFail++; console.log(`  ${FAIL} ${msg}`); }
function warn(msg) { totalWarn++; console.log(`  ${WARN} ${msg}`); }

function wrapLine(line, maxChars) {
    if (line.length <= maxChars) return [line];
    const indent = (line.match(/^(\s*)/) || ['',''])[0];
    const continuation = indent.length >= 8 ? indent : indent + '        ';
    const result = [];
    let current = line;
    while (current.length > maxChars) {
        let splitAt = -1;
        for (let i = maxChars - 1; i > indent.length; i--) {
            if (current[i] === ',' && i + 1 < current.length && current[i+1] === ' ') { splitAt = i; break; }
        }
        if (splitAt < 0) break;
        result.push(current.slice(0, splitAt + 1));
        current = continuation + current.slice(splitAt + 2);
    }
    result.push(current);
    return result;
}

function formatJava(code) {
    return code.split('\n').flatMap(l => wrapLine(l, MAX_LINE_CHARS)).join('\n');
}

function extractMethods(code) {
    const lines = code.split('\n');
    const methods = [];
    let current = null;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const sigMatch = line.match(/^(public|private)\s+\S+\s+(\w+)\s*\(/);

        if (sigMatch && braceDepth === 0) {
            if (current) methods.push(current);
            current = {name: sigMatch[2], startLine: i, lines: [line], sigLines: 0};
            braceDepth = 0;
        }

        if (current) {
            if (current.lines[current.lines.length - 1] !== line) current.lines.push(line);
            if (!current.sigLines && line.includes(') {')) current.sigLines = i - current.startLine + 1;
            for (const ch of line) {
                if (ch === '{') braceDepth++;
                if (ch === '}') braceDepth--;
            }
            if (braceDepth === 0 && current.lines.length > 1) {
                methods.push(current);
                current = null;
            }
        }
    }
    if (current) methods.push(current);
    return methods;
}

function extractStates() {
    const src = readFileSync(resolve(ROOT, 'src/scenes/codeWithActionsSceneRu.states.ts'), 'utf-8');
    const stateNames = [];
    const regex = /export const (CODE_\w+)\s*=\s*f\(`([\s\S]*?)`\)/g;
    let match;
    while ((match = regex.exec(src)) !== null) {
        const name = match[1];
        const raw = match[2];
        const formatted = formatJava(raw);
        stateNames.push({name, raw, formatted});
    }
    return stateNames;
}

function extractScene() {
    return readFileSync(resolve(ROOT, 'src/scenes/codeWithActionsSceneRu.tsx'), 'utf-8');
}

console.log('\n\x1b[1m╔══════════════════════════════════════╗\x1b[0m');
console.log('\x1b[1m║         CHIMERA  Scene Validator      ║\x1b[0m');
console.log('\x1b[1m╚══════════════════════════════════════╝\x1b[0m\n');

const states = extractStates();
const scene = extractScene();

console.log(`\x1b[1m[1] Line width check (max ${MAX_LINE_CHARS} chars)\x1b[0m`);
for (const {name, formatted} of states) {
    const lines = formatted.split('\n');
    const overflows = lines.filter(l => l.length > MAX_LINE_CHARS);
    if (overflows.length === 0) {
        pass(`${name}: all ${lines.length} lines within limit (max ${Math.max(...lines.map(l => l.length))})`);
    } else {
        for (const ol of overflows) {
            fail(`${name}: line overflow (${ol.length} chars): ${ol.slice(0, 60)}...`);
        }
    }
}

console.log(`\n\x1b[1m[2] Single-method transition check\x1b[0m`);
for (let i = 1; i < states.length; i++) {
    const prev = extractMethods(states[i-1].formatted);
    const curr = extractMethods(states[i].formatted);
    const prevMap = new Map(prev.map(m => [m.name, m.lines.join('\n').trim()]));
    const currMap = new Map(curr.map(m => [m.name, m.lines.join('\n').trim()]));

    const changed = [];
    const added = [];
    const removed = [];

    for (const [name, body] of currMap) {
        if (!prevMap.has(name)) { added.push(name); continue; }
        if (prevMap.get(name) !== body) changed.push(name);
    }
    for (const [name] of prevMap) {
        if (!currMap.has(name)) removed.push(name);
    }

    const totalChanges = changed.length + added.length + removed.length;
    const label = `${states[i-1].name} → ${states[i].name}`;

    if (totalChanges === 0) {
        warn(`${label}: no changes detected`);
    } else if (totalChanges === 1) {
        const what = changed[0] || added[0] || removed[0];
        const how = changed[0] ? 'modified' : added[0] ? 'added' : 'removed';
        pass(`${label}: ${how} ${what}`);
    } else if (added.length > 0 && changed.length === 0) {
        pass(`${label}: added ${added.join(', ')} (batch add OK)`);
    } else {
        fail(`${label}: ${totalChanges} methods changed [${[...changed, ...added.map(a => '+'+a), ...removed.map(r => '-'+r)].join(', ')}]`);
    }
}

console.log(`\n\x1b[1m[3] Signature stability check\x1b[0m`);
const sigHistory = new Map();
for (const {name, formatted} of states) {
    const methods = extractMethods(formatted);
    for (const m of methods) {
        if (!sigHistory.has(m.name)) sigHistory.set(m.name, []);
        sigHistory.get(m.name).push({state: name, sigLines: m.sigLines});
    }
}
for (const [methodName, history] of sigHistory) {
    const transitions = [];
    for (let i = 1; i < history.length; i++) {
        if (history[i].sigLines !== history[i-1].sigLines) {
            transitions.push(`${history[i-1].state}→${history[i].state}: ${history[i-1].sigLines}→${history[i].sigLines} lines`);
        }
    }
    if (transitions.length === 0) {
        pass(`${methodName}: signature stable (${history[0].sigLines} lines)`);
    } else {
        for (const t of transitions) {
            warn(`${methodName}: signature changed at ${t}`);
        }
    }
}

console.log(`\n\x1b[1m[4] findLine/scrollTo substring check\x1b[0m`);
const findLineMatches = [...scene.matchAll(/(?:findLine|scrollTo)\(\s*'([^']+)'/g)].map(m => m[1]);
const lastState = states[states.length - 1].formatted;
for (const substr of [...new Set(findLineMatches)]) {
    if (/^\d+$/.test(substr)) continue;
    const found = states.some(s => s.formatted.includes(substr));
    if (found) {
        pass(`"${substr}" found in states`);
    } else {
        fail(`"${substr}" NOT found in any state`);
    }
}

console.log(`\n\x1b[1m[5] Pre-scroll check for morph calls\x1b[0m`);
const sceneLines = scene.split('\n');
for (let i = 0; i < sceneLines.length; i++) {
    const line = sceneLines[i].trim();
    if (!line.includes('morph(CODE_')) continue;
    const stateMatch = line.match(/morph\((CODE_\w+)/);
    if (!stateMatch) continue;
    const stateName = stateMatch[1];

    let hasPreScroll = false;
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const prev = sceneLines[j].trim();
        if (prev.includes('scrollTo(')) { hasPreScroll = true; break; }
        if (prev.includes('morph(')) break;
        if (prev.includes('waitFor(')) continue;
    }

    if (hasPreScroll) {
        pass(`morph(${stateName}) at line ${i+1}: has pre-scroll`);
    } else {
        const stateObj = states.find(s => s.name === stateName);
        const prevStateIdx = states.findIndex(s => s.name === stateName) - 1;
        if (prevStateIdx >= 0) {
            const prevMethods = extractMethods(states[prevStateIdx].formatted);
            const currMethods = extractMethods(stateObj.formatted);
            const prevMap = new Map(prevMethods.map(m => [m.name, m.lines.join('\n')]));
            const addedNew = currMethods.some(m => !prevMap.has(m.name));
            if (addedNew) {
                warn(`morph(${stateName}) at line ${i+1}: no pre-scroll (adds new method — ensureRangeVisible may handle)`);
            } else {
                warn(`morph(${stateName}) at line ${i+1}: no pre-scroll`);
            }
        } else {
            warn(`morph(${stateName}) at line ${i+1}: no pre-scroll (first morph)`);
        }
    }
}

console.log('\n\x1b[1m════════════════════════════════════════\x1b[0m');
console.log(`  ${PASS} ${totalPass} passed  ${FAIL} ${totalFail} failed  ${WARN} ${totalWarn} warnings`);
console.log('\x1b[1m════════════════════════════════════════\x1b[0m\n');

process.exit(totalFail > 0 ? 1 : 0);
