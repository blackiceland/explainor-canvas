export class CodeDocument {
    public readonly lines: string[];

    private constructor(lines: string[]) {
        this.lines = lines;
    }

    public static from(code: string): CodeDocument {
        return new CodeDocument(code.split('\n'));
    }

    public get lineCount(): number {
        return this.lines.length;
    }

    public getLine(index: number): string | undefined {
        return this.lines[index];
    }

    public getLines(from: number, to: number): string[] {
        return this.lines.slice(from, to + 1);
    }

    public slice(from: number, to: number): CodeDocument {
        return new CodeDocument(this.getLines(from, to));
    }
}

