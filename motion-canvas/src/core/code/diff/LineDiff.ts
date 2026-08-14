export type LineOp = 'keep' | 'add' | 'remove';

export interface DiffEntry {
    op: LineOp;
    oldIndex: number;
    newIndex: number;
    text: string;
}

function lcsTable(a: string[], b: string[]): number[][] {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({length: m + 1}, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp;
}

/** LCS of the SUFFIXES: dp[i][j] = LCS(a[i..], b[j..]). Needed to walk the
 *  diff forwards, which is what makes early matches win (see below). */
function suffixLcsTable(a: string[], b: string[]): number[][] {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({length: m + 1}, () => new Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
        for (let j = n - 1; j >= 0; j--) {
            dp[i][j] = a[i] === b[j]
                ? dp[i + 1][j + 1] + 1
                : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }
    return dp;
}

/**
 * Same LCS, walked from the START instead of the end.
 *
 * When several alignments are equally optimal — which happens as soon as the
 * code repeats itself (`return null`, a lone `}`, blank separators) — the
 * direction of the walk decides which one you get. The backward walk keeps the
 * LAST occurrence, so inserting a second guard below the first makes the diff
 * pair the OLD guard with the NEW one further down: the already-typed lines
 * silently slide away and get re-typed in place, and the block appears to
 * assemble around its innermost statement.
 *
 * Walking forwards keeps the FIRST occurrence, so lines that did not move stay
 * put and only the genuinely new ones are added.
 */
function diffLinesForward(oldLines: string[], newLines: string[]): DiffEntry[] {
    const dp = suffixLcsTable(oldLines, newLines);
    const result: DiffEntry[] = [];
    let i = 0;
    let j = 0;

    while (i < oldLines.length && j < newLines.length) {
        if (oldLines[i] === newLines[j]) {
            result.push({op: 'keep', oldIndex: i, newIndex: j, text: oldLines[i]});
            i++;
            j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            result.push({op: 'remove', oldIndex: i, newIndex: -1, text: oldLines[i]});
            i++;
        } else {
            result.push({op: 'add', oldIndex: -1, newIndex: j, text: newLines[j]});
            j++;
        }
    }
    while (i < oldLines.length) {
        result.push({op: 'remove', oldIndex: i, newIndex: -1, text: oldLines[i]});
        i++;
    }
    while (j < newLines.length) {
        result.push({op: 'add', oldIndex: -1, newIndex: j, text: newLines[j]});
        j++;
    }
    return result;
}

export function diffLines(
    oldLines: string[],
    newLines: string[],
    preferEarlyMatches = false,
): DiffEntry[] {
    if (preferEarlyMatches) return diffLinesForward(oldLines, newLines);
    const dp = lcsTable(oldLines, newLines);
    const result: DiffEntry[] = [];
    let i = oldLines.length;
    let j = newLines.length;

    const stack: DiffEntry[] = [];
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            stack.push({op: 'keep', oldIndex: i - 1, newIndex: j - 1, text: oldLines[i - 1]});
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] > dp[i - 1][j])) {
            stack.push({op: 'add', oldIndex: -1, newIndex: j - 1, text: newLines[j - 1]});
            j--;
        } else {
            stack.push({op: 'remove', oldIndex: i - 1, newIndex: -1, text: oldLines[i - 1]});
            i--;
        }
    }

    while (stack.length > 0) result.push(stack.pop()!);
    return result;
}
