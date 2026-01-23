import {makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, Vector2, waitFor} from '@motion-canvas/core';
import {Colors, Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

export default makeScene2D(function* (view) {
    applyBackground(view);

    const quoteContainer = createRef<Node>();
    const knowledgeWord = createRef<Txt>();
    const knowledgeClone = createRef<Txt>();

    view.add(
        <Node ref={quoteContainer} opacity={0} y={-20}>
            <Txt
                fontFamily={Fonts.primary}
                fontSize={36}
                fill={Colors.text.primary}
                textAlign="center"
                y={-50}
            >
                Every piece of <Txt ref={knowledgeWord} fill={Colors.accent} fontWeight={600}>knowledge</Txt> must have
            </Txt>
            <Txt
                fontFamily={Fonts.primary}
                fontSize={36}
                fill={Colors.text.primary}
                textAlign="center"
                y={0}
            >
                a single, unambiguous, authoritative
            </Txt>
            <Txt
                fontFamily={Fonts.primary}
                fontSize={36}
                fill={Colors.text.primary}
                textAlign="center"
                y={50}
            >
                representation within a system
            </Txt>
            <Txt
                fontFamily={Fonts.primary}
                fontSize={20}
                fill={Colors.text.muted}
                opacity={0.8}
                fontStyle="italic"
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
            fontFamily={Fonts.primary}
            fontSize={36}
            fontWeight={600}
            fill={Colors.accent}
            opacity={0}
        />
    );

    yield* quoteContainer().opacity(1, Timing.slow, easeInOutCubic);

    yield* waitFor(2);

    const wordPos = knowledgeWord().absolutePosition();
    // Snap to full pixels to avoid tiny "jitter" during fade-out.
    knowledgeClone().absolutePosition(new Vector2(Math.round(wordPos.x), Math.round(wordPos.y)));
    knowledgeClone().opacity(1);
    knowledgeWord().opacity(0);

    // Fade out the quote, but keep the extracted word on screen.
    yield* quoteContainer().opacity(0, Timing.slow, easeInOutCubic);

    // Keep the word in-place for a beat, then fade it out (no movement).
    yield* waitFor(2.2);

    yield* knowledgeClone().opacity(0, Timing.slow, easeInOutCubic);

    yield* waitFor(0.3);
});
