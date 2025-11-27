export interface Token {
    text: string;
    type: TokenType;
}

export type TokenType =
    | 'keyword'
    | 'type'
    | 'string'
    | 'number'
    | 'operator'
    | 'punctuation'
    | 'method'
    | 'comment'
    | 'annotation'
    | 'plain';

const JAVA_KEYWORDS = new Set([
    'void', 'int', 'long', 'double', 'float', 'boolean', 'char', 'byte', 'short',
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return',
    'try', 'catch', 'finally', 'throw', 'throws',
    'class', 'interface', 'enum', 'extends', 'implements',
    'public', 'private', 'protected', 'static', 'final', 'abstract', 'synchronized', 'volatile', 'transient',
    'new', 'this', 'super', 'instanceof',
    'true', 'false', 'null',
    'import', 'package',
]);

const JAVA_TYPES = new Set([
    'String', 'Integer', 'Long', 'Double', 'Float', 'Boolean', 'Character', 'Byte', 'Short',
    'Object', 'Class', 'Void',
    'List', 'ArrayList', 'Map', 'HashMap', 'Set', 'HashSet',
    'Optional', 'Stream',
    'Exception', 'RuntimeException', 'Error',
    'LocalDate', 'LocalDateTime', 'Instant',
    'User', 'Plan', 'Subscription', 'IllegalStateException',
]);

export function tokenizeLine(line: string): Token[] {
    const tokens: Token[] = [];
    let remaining = line;

    while (remaining.length > 0) {
        let matched = false;

        if (remaining.startsWith('//')) {
            tokens.push({text: remaining, type: 'comment'});
            break;
        }

        const annotationMatch = remaining.match(/^@\w+/);
        if (annotationMatch) {
            tokens.push({text: annotationMatch[0], type: 'annotation'});
            remaining = remaining.slice(annotationMatch[0].length);
            matched = true;
            continue;
        }

        const stringMatch = remaining.match(/^"([^"\\]|\\.)*"/);
        if (stringMatch) {
            tokens.push({text: stringMatch[0], type: 'string'});
            remaining = remaining.slice(stringMatch[0].length);
            matched = true;
            continue;
        }

        const numberMatch = remaining.match(/^\d+(\.\d+)?[fFdDlL]?/);
        if (numberMatch) {
            tokens.push({text: numberMatch[0], type: 'number'});
            remaining = remaining.slice(numberMatch[0].length);
            matched = true;
            continue;
        }

        const wordMatch = remaining.match(/^[a-zA-Z_]\w*/);
        if (wordMatch) {
            const word = wordMatch[0];
            let type: TokenType = 'plain';

            if (JAVA_KEYWORDS.has(word)) {
                type = 'keyword';
            } else if (JAVA_TYPES.has(word)) {
                type = 'type';
            } else if (remaining.length > word.length && remaining[word.length] === '(') {
                type = 'method';
            }

            tokens.push({text: word, type});
            remaining = remaining.slice(word.length);
            matched = true;
            continue;
        }

        const operatorMatch = remaining.match(/^(&&|\|\||==|!=|<=|>=|->|::|\+\+|--|[+\-*/%=<>!&|^~?:])/);
        if (operatorMatch) {
            tokens.push({text: operatorMatch[0], type: 'operator'});
            remaining = remaining.slice(operatorMatch[0].length);
            matched = true;
            continue;
        }

        const punctMatch = remaining.match(/^[{}()\[\];,.<>]/);
        if (punctMatch) {
            tokens.push({text: punctMatch[0], type: 'punctuation'});
            remaining = remaining.slice(punctMatch[0].length);
            matched = true;
            continue;
        }

        const whitespaceMatch = remaining.match(/^\s+/);
        if (whitespaceMatch) {
            tokens.push({text: whitespaceMatch[0], type: 'plain'});
            remaining = remaining.slice(whitespaceMatch[0].length);
            matched = true;
            continue;
        }

        if (!matched) {
            tokens.push({text: remaining[0], type: 'plain'});
            remaining = remaining.slice(1);
        }
    }

    return tokens;
}

