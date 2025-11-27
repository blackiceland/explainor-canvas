import {Txt} from '@motion-canvas/2d';
import {createRef, Reference} from '@motion-canvas/core';

export class CodeLine {
    private readonly ref = createRef<Txt>();
    private readonly _index: number;
    private readonly _text: string;

    constructor(index: number, text: string) {
        this._index = index;
        this._text = text;
    }

    public get index(): number {
        return this._index;
    }

    public get text(): string {
        return this._text;
    }

    public getRef(): Reference<Txt> {
        return this.ref;
    }

    public node(): Txt {
        return this.ref();
    }

    public createNode(props: {
        fontFamily: string;
        fontSize: number;
        fill: string;
        opacity?: number;
    }): Txt {
        const txt = new Txt({
            text: this._text,
            fontFamily: props.fontFamily,
            fontSize: props.fontSize,
            fill: props.fill,
            opacity: props.opacity ?? 1,
        });
        
        this.ref(txt);
        
        return txt;
    }

    public absolutePosition() {
        return this.ref().absolutePosition();
    }

    public position() {
        return this.ref().position();
    }
}
