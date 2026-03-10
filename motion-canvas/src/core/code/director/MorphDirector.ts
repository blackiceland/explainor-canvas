export interface MorphBlock {
    start: number;
    end: number;
    safeEnd: number;
}

export function buildMorphBlocks(indices: number[]): MorphBlock[] {
    if (indices.length === 0) return [];

    const blocks: MorphBlock[] = [];
    let i = 0;

    while (i < indices.length) {
        let end = i;
        while (end + 1 < indices.length && indices[end + 1] === indices[end] + 1) {
            end++;
        }

        const size = end - i + 1;
        const safeEnd = size > 6
            ? Math.max(i, end - Math.ceil(size * 0.25))
            : end;

        blocks.push({start: i, end, safeEnd});
        i = end + 1;
    }

    return blocks;
}
