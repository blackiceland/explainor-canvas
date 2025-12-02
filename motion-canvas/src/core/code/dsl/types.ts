export interface CodeSource {
    code: string;
    range: [number, number];
}

export interface DryPattern {
    pattern: 'dry';
    left: CodeSource;
    right: CodeSource;
    helper: string;
    call: string;
}

export interface DominoPattern {
    pattern: 'domino';
    code: string;
    steps: Array<{
        highlight: [number, number];
        label?: string;
    }>;
}

export interface ExtractVariablePattern {
    pattern: 'extractVariable';
    code: string;
    expression: {
        line: number;
        from: number;
        to: number;
    };
    variableName: string;
}

export type ScenePattern = DryPattern | DominoPattern | ExtractVariablePattern;

