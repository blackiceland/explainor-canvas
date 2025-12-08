import {makeScene2D, Node, Txt, Circle, Layout} from '@motion-canvas/2d';
import {all, chain, createRef, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, easeOutElastic, waitFor, range} from '@motion-canvas/core';
import {ExplainorTheme} from '../core/theme';

const COLORS = ExplainorTheme.colors;
const FONTS = ExplainorTheme.fonts;

export default makeScene2D(function* (view) {
    view.fill(COLORS.background);

    const quoteContainer = createRef<Node>();
    const knowledgeWord = createRef<Txt>();
    const lettersContainer = createRef<Layout>();
    const knowledgeCircle = createRef<Circle>();

    const word = "knowledge";
    const letters = word.split('');
    const letterRefs = letters.map(() => createRef<Txt>());

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
        <Layout
            ref={lettersContainer}
            layout
            direction="row"
            gap={0}
            opacity={0}
        >
            {letters.map((char, index) => (
                <Txt
                    ref={letterRefs[index]}
                    text={char}
                    fontFamily={FONTS.primary}
                    fontSize={36}
                    fontWeight={600}
                    fill={COLORS.accent.red}
                />
            ))}
        </Layout>
    );

    view.add(
        <Circle
            ref={knowledgeCircle}
            size={80}
            fill={COLORS.accent.red}
            opacity={0}
            scale={0}
        />
    );

    yield* all(
        quoteContainer().opacity(1, 0.8, easeInOutCubic),
        quoteContainer().y(0, 0.8, easeInOutCubic),
    );

    yield* waitFor(3);

    const wordPos = knowledgeWord().absolutePosition();
    lettersContainer().absolutePosition(wordPos);
    knowledgeCircle().absolutePosition(wordPos);
    
    // Switch to letters
    lettersContainer().opacity(1);
    knowledgeWord().opacity(0);

    yield* quoteContainer().opacity(0, 1.0, easeInOutCubic);

    yield* waitFor(0.5);
    
    yield* lettersContainer().gap(-35, 0.6, easeInCubic);

    lettersContainer().opacity(0);
    knowledgeCircle().opacity(1);

    yield* knowledgeCircle().scale(1, 1, easeOutElastic);

    yield* waitFor(2);
});
