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

export function diffLines(oldLines: string[], newLines: string[]): DiffEntry[] {
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
