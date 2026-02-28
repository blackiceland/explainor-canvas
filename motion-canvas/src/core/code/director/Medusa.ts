import {ThreadGenerator, waitFor} from '@motion-canvas/core';
import {Manticore, MorphOptions} from '../components/Manticore';
import {JavaClass, JavaMethod, JavaParam} from '../model/JavaModel';

export interface MedusaConfig {
    morphDefaults?: MorphOptions;
    pauseAfterMorph?: number;
}

export class Medusa {
    private model: JavaClass;
    private manticore: Manticore;
    private cfg: Required<MedusaConfig>;

    constructor(model: JavaClass, manticore: Manticore, config: MedusaConfig = {}) {
        this.model = model;
        this.manticore = manticore;
        this.cfg = {
            morphDefaults: {scrollStrategy: 'block', removeDuration: 0, moveDuration: 0.6, ...config.morphDefaults},
            pauseAfterMorph: config.pauseAfterMorph ?? 0.5,
        };
    }

    private morph(opts?: MorphOptions): ThreadGenerator {
        return this.manticore.morphTo(this.model.render(), {...this.cfg.morphDefaults, ...opts});
    }

    *addParam(methodName: string, p: JavaParam, opts?: MorphOptions): ThreadGenerator {
        const oldSig = this.sigLineCount(methodName);
        this.model.addParam(methodName, p);
        const newSig = this.sigLineCount(methodName);

        if (newSig > oldSig) {
            yield* this.scrollToMethod(methodName);
        }

        yield* this.morph(opts);
        yield* waitFor(this.cfg.pauseAfterMorph);
    }

    *setBody(methodName: string, body: string[], opts?: MorphOptions): ThreadGenerator {
        const oldBodyLen = this.model.getMethod(methodName).body.length;
        this.model.setBody(methodName, body);
        const newBodyLen = body.length;

        if (newBodyLen > oldBodyLen) {
            yield* this.scrollToMethod(methodName);
        }

        yield* this.morph(opts);
        yield* waitFor(this.cfg.pauseAfterMorph);
    }

    *addParamsAndUpdateBody(
        methodName: string,
        params: JavaParam[],
        body: string[],
        intermediateBody?: string[],
        opts?: MorphOptions,
    ): ThreadGenerator {
        const oldSig = this.sigLineCount(methodName);

        for (const p of params) {
            this.model.addParam(methodName, p);
        }
        const newSig = this.sigLineCount(methodName);

        if (newSig > oldSig) {
            if (intermediateBody) this.model.setBody(methodName, intermediateBody);
            yield* this.scrollToMethod(methodName);
            yield* this.morph(opts);
            yield* waitFor(this.cfg.pauseAfterMorph);
        }

        this.model.setBody(methodName, body);
        yield* this.scrollToMethod(methodName);
        yield* this.morph(opts);
        yield* waitFor(this.cfg.pauseAfterMorph);
    }

    *replaceLine(
        methodName: string,
        oldLine: string,
        ...newLines: string[]
    ): ThreadGenerator {
        yield* this.scrollToMethod(methodName);
        this.model.replaceLine(methodName, oldLine, ...newLines);
        yield* this.morph();
        yield* waitFor(this.cfg.pauseAfterMorph);
    }

    *updateCallArgs(
        methodName: string,
        callName: string,
        args: string[],
        opts?: MorphOptions,
    ): ThreadGenerator {
        yield* this.scrollToMethod(methodName);
        this.model.updateCallArgs(methodName, callName, args);
        yield* this.morph(opts);
        yield* waitFor(this.cfg.pauseAfterMorph);
    }

    *addMethod(m: JavaMethod, afterMethod?: string, opts?: MorphOptions): ThreadGenerator {
        this.model.addMethod(m, afterMethod);
        yield* this.morph({scrollStrategy: 'blockWithTail', ...opts});
        yield* waitFor(this.cfg.pauseAfterMorph);
    }

    *addMethodFade(m: JavaMethod, afterMethod?: string, opts?: MorphOptions): ThreadGenerator {
        this.model.addMethod(m, afterMethod);
        yield* this.morph({addStyle: 'fade', scrollStrategy: 'blockWithTail', ...opts});
        yield* waitFor(this.cfg.pauseAfterMorph);
    }

    *scrollTo(target: string | number, duration = 0.8): ThreadGenerator {
        yield* this.manticore.scrollTo(target, duration);
    }

    *apply(fn: (m: JavaClass) => void, opts?: MorphOptions): ThreadGenerator {
        fn(this.model);
        yield* this.morph(opts);
        yield* waitFor(this.cfg.pauseAfterMorph);
    }

    get cb(): Manticore {
        return this.manticore;
    }

    private sigLineCount(methodName: string): number {
        const m = this.model.getMethod(methodName);
        const testClass = JavaClass.create([m], this.model.maxChars);
        const rendered = testClass.render();
        const firstBrace = rendered.indexOf('{');
        return rendered.slice(0, firstBrace + 1).split('\n').length;
    }

    private *scrollToMethod(methodName: string): ThreadGenerator {
        const sigPrefix = this.findMethodSignaturePrefix(methodName);
        if (!sigPrefix) return;
        const idx = this.manticore.findLine(sigPrefix);
        if (idx < 0) return;
        if (this.manticore.isLineVisible(idx)) return;
        yield* this.manticore.scrollTo(idx, 0.6);
    }

    private findMethodSignaturePrefix(methodName: string): string | null {
        const m = this.model.getMethod(methodName);
        return `${m.returnType} ${m.name}(`;
    }
}
