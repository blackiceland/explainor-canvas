import {makeScene2D, Node, Txt, Circle} from '@motion-canvas/2d';
import {all, chain, createRef, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, waitFor} from '@motion-canvas/core';
import {ExplainorTheme} from '../core/theme';

const COLORS = ExplainorTheme.colors;
const FONTS = ExplainorTheme.fonts;

export default makeScene2D(function* (view) {
    view.fill(COLORS.background);

    const quoteContainer = createRef<Node>();
    const knowledgeWord = createRef<Txt>();
    const knowledgeClone = createRef<Txt>();
    const knowledgeCircle = createRef<Circle>();

    view.add(
        <Node ref={quoteContainer} opacity={0} y={-20}>
            <Txt
                fontFamily={FONTS.primary}
                fontSize={36}
                fill={COLORS.text.primary}
                textAlign="center"
                y={-50}
            >
                Every piece of <Txt ref={knowledgeWord} fill={COLORS.accent.red} fontWeight={600}>knowledge</Txt> must have
            </Txt>
            <Txt
                fontFamily={FONTS.primary}
                fontSize={36}
                fill={COLORS.text.primary}
                textAlign="center"
                y={0}
            >
                a single, unambiguous,
            </Txt>
            <Txt
                fontFamily={FONTS.primary}
                fontSize={36}
                fill={COLORS.text.primary}
                textAlign="center"
                y={50}
            >
                authoritative representation within a system
            </Txt>
            <Txt
                fontFamily={FONTS.primary}
                fontSize={24}
                fill={COLORS.text.muted}
                textAlign="center"
                y={130}
            >
                — The Pragmatic Programmer
            </Txt>
        </Node>
    );

    view.add(
        <Txt
            ref={knowledgeClone}
            text="knowledge"
            fontFamily={FONTS.primary}
            fontSize={36}
            fontWeight={600}
            fill={COLORS.accent.red}
            opacity={0}
        />
    );

    view.add(
        <Circle
            ref={knowledgeCircle}
            size={80}
            fill={COLORS.accent.red}
            opacity={0}
            scale={1}
        />
    );

    yield* all(
        quoteContainer().opacity(1, 0.8, easeInOutCubic),
        quoteContainer().y(0, 0.8, easeInOutCubic),
    );

    yield* waitFor(3);

    const wordPos = knowledgeWord().absolutePosition();
    knowledgeCircle().absolutePosition(wordPos);
    knowledgeClone().absolutePosition(wordPos);
    
    knowledgeClone().opacity(1);
    knowledgeWord().opacity(0);

    yield* quoteContainer().opacity(0, 1.0, easeInOutCubic);

    yield* all(
        knowledgeClone().opacity(0, 0.6, easeInOutCubic),
        knowledgeCircle().opacity(1, 0.6, easeInOutCubic),
    );

    yield* waitFor(2);
});
