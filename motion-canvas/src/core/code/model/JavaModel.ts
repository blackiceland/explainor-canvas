export interface JavaParam {
    type: string;
    name: string;
}

export interface JavaMethod {
    access: string;
    returnType: string;
    name: string;
    params: JavaParam[];
    body: string[];
}

export function param(type: string, name: string): JavaParam {
    return {type, name};
}

export function method(
    access: string,
    returnType: string,
    name: string,
    params: JavaParam[],
    body: string[],
): JavaMethod {
    return {access, returnType, name, params: [...params], body: [...body]};
}

export class JavaClass {
    private methods: JavaMethod[];
    readonly maxChars: number;

    private constructor(methods: JavaMethod[], maxChars: number) {
        this.methods = methods.map(m => ({...m, params: [...m.params], body: [...m.body]}));
        this.maxChars = maxChars;
    }

    static create(methods: JavaMethod[], maxChars: number): JavaClass {
        return new JavaClass(methods, maxChars);
    }

    clone(): JavaClass {
        return new JavaClass(this.methods, this.maxChars);
    }

    getMethod(name: string): JavaMethod {
        const m = this.methods.find(m => m.name === name);
        if (!m) throw new Error(`Method '${name}' not found`);
        return m;
    }

    addParam(methodName: string, p: JavaParam): void {
        this.getMethod(methodName).params.push(p);
    }

    setBody(methodName: string, body: string[]): void {
        this.getMethod(methodName).body = [...body];
    }

    replaceLine(methodName: string, oldLine: string, ...newLines: string[]): void {
        const m = this.getMethod(methodName);
        const idx = m.body.findIndex(l => l.includes(oldLine));
        if (idx < 0) throw new Error(`Line containing '${oldLine}' not found in '${methodName}'`);
        const indent = m.body[idx].match(/^(\s*)/)?.[0] ?? '';
        const indented = newLines.map(l => l === '' ? '' : indent + l);
        m.body.splice(idx, 1, ...indented);
    }

    removeLine(methodName: string, lineContent: string): void {
        const m = this.getMethod(methodName);
        const idx = m.body.findIndex(l => l.includes(lineContent));
        if (idx < 0) throw new Error(`Line containing '${lineContent}' not found in '${methodName}'`);
        m.body.splice(idx, 1);
    }

    addLine(methodName: string, afterLine: string, ...newLines: string[]): void {
        const m = this.getMethod(methodName);
        const idx = m.body.findIndex(l => l.includes(afterLine));
        if (idx < 0) throw new Error(`Line containing '${afterLine}' not found in '${methodName}'`);
        m.body.splice(idx + 1, 0, ...newLines);
    }

    addMethod(m: JavaMethod, afterMethod?: string): void {
        if (afterMethod) {
            const idx = this.methods.findIndex(x => x.name === afterMethod);
            if (idx < 0) throw new Error(`Method '${afterMethod}' not found`);
            this.methods.splice(idx + 1, 0, {...m, params: [...m.params], body: [...m.body]});
        } else {
            this.methods.push({...m, params: [...m.params], body: [...m.body]});
        }
    }

    updateCallArgs(methodName: string, callName: string, args: string[]): void {
        const m = this.getMethod(methodName);
        const re = new RegExp(`(.*\\b${callName}\\()([^)]*)(\\).*)`, 's');
        for (let i = 0; i < m.body.length; i++) {
            const match = m.body[i].match(re);
            if (match) {
                m.body[i] = match[1] + args.join(', ') + match[3];
                return;
            }
        }
        throw new Error(`Call to '${callName}' not found in '${methodName}'`);
    }

    render(): string {
        return this.methods.map(m => this.renderMethod(m)).join('\n\n');
    }

    private renderMethod(m: JavaMethod): string {
        const sig = this.renderSignature(m);
        const body = m.body.flatMap(l => {
            if (l === '') return [''];
            const indented = '    ' + l;
            return this.wrapLine(indented);
        });
        return [...sig, ...body, '}'].join('\n');
    }

    private wrapLine(line: string): string[] {
        if (line.length <= this.maxChars) return [line];

        const indent = line.match(/^(\s*)/)?.[0] ?? '';
        const continuation = indent.length >= 8 ? indent : indent + '        ';
        const result: string[] = [];
        let current = line;

        while (current.length > this.maxChars) {
            let splitAt = -1;
            for (let i = this.maxChars - 1; i > indent.length; i--) {
                if (current[i] === ',' && i + 1 < current.length && current[i + 1] === ' ') {
                    splitAt = i;
                    break;
                }
            }
            if (splitAt < 0) break;

            result.push(current.slice(0, splitAt + 1));
            current = continuation + current.slice(splitAt + 2);
        }
        result.push(current);
        return result;
    }

    private renderSignature(m: JavaMethod): string[] {
        const paramStr = m.params.map(p => `${p.type} ${p.name}`).join(', ');
        const oneLiner = `${m.access} ${m.returnType} ${m.name}(${paramStr}) {`;

        if (oneLiner.length <= this.maxChars) return [oneLiner];

        const prefix = `${m.access} ${m.returnType} ${m.name}(`;
        const continuation = ' '.repeat(8);
        const lines: string[] = [];
        let current = prefix;

        for (let i = 0; i < m.params.length; i++) {
            const p = `${m.params[i].type} ${m.params[i].name}`;
            const isLast = i === m.params.length - 1;
            const withComma = current + p + ',';

            if (isLast) {
                const finished = current + p + ') {';
                if (finished.length <= this.maxChars) {
                    current = finished;
                } else {
                    lines.push(current.endsWith(', ') ? current.slice(0, -1) : current);
                    current = continuation + p + ') {';
                }
            } else {
                if (withComma.length <= this.maxChars) {
                    current = current + p + ', ';
                } else {
                    lines.push(current.endsWith(', ') ? current.slice(0, -1) : current);
                    current = continuation + p + ', ';
                }
            }
        }
        if (current.trim()) lines.push(current);

        return lines;
    }

    methodNames(): string[] {
        return this.methods.map(m => m.name);
    }

    findMethodByLine(lineContent: string): string | null {
        for (const m of this.methods) {
            const rendered = this.renderMethod(m);
            if (rendered.includes(lineContent)) return m.name;
        }
        return null;
    }
}
