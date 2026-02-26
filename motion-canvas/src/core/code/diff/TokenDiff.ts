import {Token} from '../model/Tokenizer';

export type TokenOp = 'keep' | 'add' | 'remove';

export interface TokenDiffEntry {
    op: TokenOp;
    oldIndex: number;
    newIndex: number;
    token: Token;
}

function tokenKey(t: Token): string {
    return t.text + '\0' + t.type;
}

function lcsTokenTable(a: Token[], b: Token[]): number[][] {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({length: m + 1}, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = tokenKey(a[i - 1]) === tokenKey(b[j - 1])
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp;
}

export function diffTokens(oldTokens: Token[], newTokens: Token[]): TokenDiffEntry[] {
    const dp = lcsTokenTable(oldTokens, newTokens);
    const stack: TokenDiffEntry[] = [];
    let i = oldTokens.length;
    let j = newTokens.length;

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && tokenKey(oldTokens[i - 1]) === tokenKey(newTokens[j - 1])) {
            stack.push({op: 'keep', oldIndex: i - 1, newIndex: j - 1, token: newTokens[j - 1]});
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            stack.push({op: 'add', oldIndex: -1, newIndex: j - 1, token: newTokens[j - 1]});
            j--;
        } else {
            stack.push({op: 'remove', oldIndex: i - 1, newIndex: -1, token: oldTokens[i - 1]});
            i--;
        }
    }

    const result: TokenDiffEntry[] = [];
    while (stack.length > 0) result.push(stack.pop()!);
    return result;
}
