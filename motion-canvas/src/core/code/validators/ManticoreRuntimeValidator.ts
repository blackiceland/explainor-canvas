import {Manticore, MorphOptions} from '../components/Manticore';

export interface RuntimeValidationIssue {
    code: 'ANCHOR_NOT_VISIBLE' | 'LINE_OVERFLOW' | 'BLOCK_SCROLL_VIOLATION';
    message: string;
}

export interface RuntimeValidationConfig {
    manticore: Manticore;
    renderedCode: string;
    maxChars: number;
    anchorPrefix?: string | null;
    opts: MorphOptions;
    strict: boolean;
    logger: (message: string) => void;
}

export function validateRuntimeMorph(cfg: RuntimeValidationConfig): RuntimeValidationIssue[] {
    const issues: RuntimeValidationIssue[] = [];
    const lines = cfg.renderedCode.split('\n');

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > cfg.maxChars) {
            issues.push({
                code: 'LINE_OVERFLOW',
                message: `Line ${i + 1} exceeds maxChars (${lines[i].length} > ${cfg.maxChars})`,
            });
            break;
        }
    }

    if (cfg.anchorPrefix) {
        const idx = cfg.manticore.findLine(cfg.anchorPrefix);
        if (idx >= 0 && !cfg.manticore.isLineVisible(idx)) {
            issues.push({
                code: 'ANCHOR_NOT_VISIBLE',
                message: `Anchor method "${cfg.anchorPrefix}" is not visible after morph`,
            });
        }
    }

    const report = cfg.manticore.getLastMorphReport();
    if (
        report &&
        cfg.opts.scrollStrategy === 'block' &&
        report.tailScrollEvents > 0
    ) {
        issues.push({
            code: 'BLOCK_SCROLL_VIOLATION',
            message: `Expected block scroll, got ${report.tailScrollEvents} tail scroll events`,
        });
    }

    for (const issue of issues) {
        cfg.logger(`[ManticoreRuntimeValidator] ${issue.code}: ${issue.message}`);
    }

    if (cfg.strict && issues.length > 0) {
        throw new Error(issues.map(i => `${i.code}: ${i.message}`).join('\n'));
    }

    return issues;
}
