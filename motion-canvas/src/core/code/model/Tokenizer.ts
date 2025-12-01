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

const PATTERNS = {
    comment: /^\/\/.*/,
    annotation: /^@\w+/,
    string: /^"([^"\\]|\\.)*"/,
    number: /^\d+(\.\d+)?[fFdDlL]?/,
    word: /^[a-zA-Z_]\w*/,
    operator: /^(&&|\|\||==|!=|<=|>=|->|::|\+\+|--|[+\-*/%=<>!&|^~?:])/,
    punctuation: /^[{}()\[\];,.<>]/,
    whitespace: /^\s+/,
};

function classifyWord(word: string, nextChar: string): TokenType {
    if (JAVA_KEYWORDS.has(word)) return 'keyword';
    if (JAVA_TYPES.has(word)) return 'type';
    if (nextChar === '(') return 'method';
    return 'plain';
}

export function tokenizeLine(line: string): Token[] {
    const tokens: Token[] = [];
    let remaining = line;

    while (remaining.length > 0) {
        const commentMatch = remaining.match(PATTERNS.comment);
        if (commentMatch) {
            tokens.push({text: commentMatch[0], type: 'comment'});
            break;
        }

        const annotationMatch = remaining.match(PATTERNS.annotation);
        if (annotationMatch) {
            tokens.push({text: annotationMatch[0], type: 'annotation'});
            remaining = remaining.slice(annotationMatch[0].length);
            continue;
        }

        const stringMatch = remaining.match(PATTERNS.string);
        if (stringMatch) {
            tokens.push({text: stringMatch[0], type: 'string'});
            remaining = remaining.slice(stringMatch[0].length);
            continue;
        }

        const numberMatch = remaining.match(PATTERNS.number);
        if (numberMatch) {
            tokens.push({text: numberMatch[0], type: 'number'});
            remaining = remaining.slice(numberMatch[0].length);
            continue;
        }

        const wordMatch = remaining.match(PATTERNS.word);
        if (wordMatch) {
            const word = wordMatch[0];
            const nextChar = remaining[word.length] ?? '';
            tokens.push({text: word, type: classifyWord(word, nextChar)});
            remaining = remaining.slice(word.length);
            continue;
        }

        const operatorMatch = remaining.match(PATTERNS.operator);
        if (operatorMatch) {
            tokens.push({text: operatorMatch[0], type: 'operator'});
            remaining = remaining.slice(operatorMatch[0].length);
            continue;
        }

        const punctMatch = remaining.match(PATTERNS.punctuation);
        if (punctMatch) {
            tokens.push({text: punctMatch[0], type: 'punctuation'});
            remaining = remaining.slice(punctMatch[0].length);
            continue;
        }

        const whitespaceMatch = remaining.match(PATTERNS.whitespace);
        if (whitespaceMatch) {
            tokens.push({text: whitespaceMatch[0], type: 'plain'});
            remaining = remaining.slice(whitespaceMatch[0].length);
            continue;
        }

        tokens.push({text: remaining[0], type: 'plain'});
        remaining = remaining.slice(1);
    }

    return tokens;
}
