import {ThreadGenerator, waitFor} from '@motion-canvas/core';
import {Manticore, MorphOptions} from '../components/Manticore';
import {JavaClass, JavaMethod, JavaParam} from '../model/JavaModel';
import {DEFAULT_MORPH_PROFILES, MorphProfileName} from './MorphProfiles';
import {validateRuntimeMorph} from '../validators/ManticoreRuntimeValidator';

export interface MedusaRuntimeValidationConfig {
    enabled?: boolean;
    strict?: boolean;
    logger?: (message: string) => void;
}

export type MedusaMorphInput = MorphOptions & {
    profile?: MorphProfileName;
};

export interface MedusaConfig {
    morphDefaults?: MorphOptions;
    pauseAfterMorph?: number;
    defaultProfile?: MorphProfileName;
    profiles?: Partial<Record<MorphProfileName, MorphOptions>>;
    runtimeValidation?: MedusaRuntimeValidationConfig;
}

export class Medusa {
    private model: JavaClass;
    private manticore: Manticore;
    private cfg: {
        morphDefaults: MorphOptions;
        pauseAfterMorph: number;
        defaultProfile: MorphProfileName;
        profiles: Record<MorphProfileName, MorphOptions>;
        runtimeValidation: Required<MedusaRuntimeValidationConfig>;
    };

    constructor(model: JavaClass, manticore: Manticore, config: MedusaConfig = {}) {
        this.model = model;
        this.manticore = manticore;
        const runtimeValidation = config.runtimeValidation ?? {};
        this.cfg = {
            morphDefaults: {scrollStrategy: 'block', removeDuration: 0, moveDuration: 0.6, ...config.morphDefaults},
            pauseAfterMorph: config.pauseAfterMorph ?? 0.5,
            defaultProfile: config.defaultProfile ?? 'stableExpand',
            profiles: {
                ...DEFAULT_MORPH_PROFILES,
                ...config.profiles,
            },
            runtimeValidation: {
                enabled: runtimeValidation.enabled ?? true,
                strict: runtimeValidation.strict ?? false,
                logger: runtimeValidation.logger ?? ((m: string) => console.warn(m)),
            },
        };
    }

    private resolveMorphOptions(
        input?: MedusaMorphInput,
        fallbackProfile?: MorphProfileName,
    ): MorphOptions {
        const profileName = input?.profile ?? fallbackProfile ?? this.cfg.defaultProfile;
        const profileOpts = this.cfg.profiles[profileName] ?? {};
        const {profile: _profile, ...inline} = input ?? {};
        return {
            ...this.cfg.morphDefaults,
            ...profileOpts,
            ...inline,
        };
    }

    private methodPrefix(methodName: string): string {
        const m = this.model.getMethod(methodName);
        return `${m.returnType} ${m.name}(`;
    }

    private *morph(
        anchorMethod?: string,
        opts?: MedusaMorphInput,
        fallbackProfile?: MorphProfileName,
    ): ThreadGenerator {
        const effective = this.resolveMorphOptions(opts, fallbackProfile);
        const code = this.model.render();
        yield* this.manticore.morphTo(code, effective);
        if (this.cfg.runtimeValidation.enabled) {
            validateRuntimeMorph({
                manticore: this.manticore,
                renderedCode: code,
                maxChars: this.model.maxChars,
                anchorPrefix: anchorMethod ? this.methodPrefix(anchorMethod) : null,
                opts: effective,
                strict: this.cfg.runtimeValidation.strict,
                logger: this.cfg.runtimeValidation.logger,
            });
        }
    }

    *addParam(methodName: string, p: JavaParam, opts?: MedusaMorphInput): ThreadGenerator {
        const oldSig = this.sigLineCount(methodName);
        this.model.addParam(methodName, p);
        const newSig = this.sigLineCount(methodName);

        if (newSig > oldSig) {
            yield* this.scrollToMethod(methodName);
        }

        yield* this.morph(methodName, opts, 'stableExpand');
        yield* waitFor(this.cfg.pauseAfterMorph);
    }

    *setBody(methodName: string, body: string[], opts?: MedusaMorphInput): ThreadGenerator {
        const oldBodyLen = this.model.getMethod(methodName).body.length;
        this.model.setBody(methodName, body);
        const newBodyLen = body.length;

        if (newBodyLen > oldBodyLen) {
            yield* this.scrollToMethod(methodName);
        }

        yield* this.morph(methodName, opts, 'stableExpand');
        yield* waitFor(this.cfg.pauseAfterMorph);
    }

    *addParamsAndUpdateBody(
        methodName: string,
        params: JavaParam[],
        body: string[],
        intermediateBody?: string[],
        opts?: MedusaMorphInput,
    ): ThreadGenerator {
        const oldSig = this.sigLineCount(methodName);

        for (const p of params) {
            this.model.addParam(methodName, p);
        }
        const newSig = this.sigLineCount(methodName);

        if (newSig > oldSig) {
            if (intermediateBody) this.model.setBody(methodName, intermediateBody);
            yield* this.scrollToMethod(methodName);
            yield* this.morph(methodName, opts, 'stableExpand');
            yield* waitFor(this.cfg.pauseAfterMorph);
        }

        this.model.setBody(methodName, body);
        yield* this.scrollToMethod(methodName);
        yield* this.morph(methodName, opts, 'stableExpand');
        yield* waitFor(this.cfg.pauseAfterMorph);
    }

    *replaceLine(
        methodName: string,
        oldLine: string,
        ...newLines: string[]
    ): ThreadGenerator {
        yield* this.scrollToMethod(methodName);
        this.model.replaceLine(methodName, oldLine, ...newLines);
        yield* this.morph(methodName, undefined, 'stableExpand');
        yield* waitFor(this.cfg.pauseAfterMorph);
    }

    *updateCallArgs(
        methodName: string,
        callName: string,
        args: string[],
        opts?: MedusaMorphInput,
    ): ThreadGenerator {
        yield* this.scrollToMethod(methodName);
        this.model.updateCallArgs(methodName, callName, args);
        yield* this.morph(methodName, opts, 'stableExpand');
        yield* waitFor(this.cfg.pauseAfterMorph);
    }

    *addMethod(m: JavaMethod, afterMethod?: string, opts?: MedusaMorphInput): ThreadGenerator {
        this.model.addMethod(m, afterMethod);
        yield* this.morph(m.name, opts, 'methodAdd');
        yield* waitFor(this.cfg.pauseAfterMorph);
    }

    *addMethodFade(m: JavaMethod, afterMethod?: string, opts?: MedusaMorphInput): ThreadGenerator {
        this.model.addMethod(m, afterMethod);
        yield* this.morph(m.name, opts, 'methodAddFade');
        yield* waitFor(this.cfg.pauseAfterMorph);
    }

    *scrollTo(target: string | number, duration = 0.8): ThreadGenerator {
        yield* this.manticore.scrollTo(target, duration);
    }

    *apply(fn: (m: JavaClass) => void, opts?: MedusaMorphInput, anchorMethod?: string): ThreadGenerator {
        fn(this.model);
        yield* this.morph(anchorMethod, opts, 'stableExpand');
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
        const prefix = this.methodPrefix(methodName);
        const idx = this.manticore.findLine(prefix);
        if (idx < 0) return;
        if (this.manticore.isLineVisible(idx)) return;
        yield* this.manticore.scrollTo(idx, 0.6);
    }
}
