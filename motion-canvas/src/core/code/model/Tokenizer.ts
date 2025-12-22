export interface Token {
    text: string;
    type: TokenType;
    color?: string;  // Если задан, используется напрямую (для Shiki)
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
    | 'constant'
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
    'BigDecimal', 'BigInteger', 'Decimal',
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

// Проверка на константу: UPPER_CASE_WITH_UNDERSCORES
function isConstant(word: string): boolean {
    return /^[A-Z][A-Z0-9_]*$/.test(word) && word.length > 1;
}

function classifyWord(
    word: string, 
    nextChar: string, 
    previousMeaningful: Token | null,
    customTypes: Set<string> = new Set()
): TokenType {
    if (JAVA_KEYWORDS.has(word)) return 'keyword';
    if (JAVA_TYPES.has(word) || customTypes.has(word)) return 'type';
    if (
        previousMeaningful &&
        previousMeaningful.type === 'keyword' &&
        (previousMeaningful.text === 'class' || previousMeaningful.text === 'interface' || previousMeaningful.text === 'enum')
    ) {
        return 'type';
    }
    // Вызов метода: только после точки (obj.method())
    if (nextChar === '(' && previousMeaningful?.text === '.') return 'method';
    if (isConstant(word)) return 'constant';
    return 'plain';
}

export function tokenizeLine(line: string, customTypes: string[] = []): Token[] {
    const tokens: Token[] = [];
    let remaining = line;
    let previousMeaningful: Token | null = null;
    const customTypesSet = new Set(customTypes);

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
            const token = {text: numberMatch[0], type: 'number' as TokenType};
            tokens.push(token);
            if (token.text.trim().length > 0) {
                previousMeaningful = token;
            }
            remaining = remaining.slice(numberMatch[0].length);
            continue;
        }

        const wordMatch = remaining.match(PATTERNS.word);
        if (wordMatch) {
            const word = wordMatch[0];
            const nextChar = remaining[word.length] ?? '';
            const token = {text: word, type: classifyWord(word, nextChar, previousMeaningful, customTypesSet)};
            tokens.push(token);
            if (token.text.trim().length > 0) {
                previousMeaningful = token;
            }
            remaining = remaining.slice(word.length);
            continue;
        }

        const operatorMatch = remaining.match(PATTERNS.operator);
        if (operatorMatch) {
            const token = {text: operatorMatch[0], type: 'operator' as TokenType};
            tokens.push(token);
            if (token.text.trim().length > 0) {
                previousMeaningful = token;
            }
            remaining = remaining.slice(operatorMatch[0].length);
            continue;
        }

        const punctMatch = remaining.match(PATTERNS.punctuation);
        if (punctMatch) {
            const token = {text: punctMatch[0], type: 'punctuation' as TokenType};
            tokens.push(token);
            if (token.text.trim().length > 0) {
                previousMeaningful = token;
            }
            remaining = remaining.slice(punctMatch[0].length);
            continue;
        }

        const whitespaceMatch = remaining.match(PATTERNS.whitespace);
        if (whitespaceMatch) {
            const token = {text: whitespaceMatch[0], type: 'plain' as TokenType};
            tokens.push(token);
            remaining = remaining.slice(whitespaceMatch[0].length);
            continue;
        }

        const token = {text: remaining[0], type: 'plain' as TokenType};
        tokens.push(token);
        if (token.text.trim().length > 0) {
            previousMeaningful = token;
        }
        remaining = remaining.slice(1);
    }

    return tokens;
}
