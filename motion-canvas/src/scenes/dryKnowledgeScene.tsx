import {makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Colors, Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';
import {playQuadCode} from '../core/templates/QuadCodeScene';
import {buildLineGhosts, mountGhosts, flyGhostsTo, fadeInGhosts, fadeOutGhosts} from '../core/code/animation/GhostBuilder';

const INVOICE_CODE = `class InvoiceService {

  BigDecimal calculateTotal(BigDecimal amount) {
    return amount.multiply(new BigDecimal("0.20"));
  }
}`;

const CHECKOUT_CODE = `class CheckoutService {

  BigDecimal calculateTax(BigDecimal price) {
    return price.multiply(new BigDecimal("0.20"));
  }
}`;

const FISCAL_CODE = `class FiscalExport {

  BigDecimal exportVat(BigDecimal revenue) {
    return revenue.multiply(new BigDecimal("0.20"));
  }
}`;

const AUDIT_CODE = `class AuditService {

  BigDecimal checkCompliance(BigDecimal value) {
    return value.multiply(new BigDecimal("0.20"));
  }
}`;

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
    knowledgeClone().absolutePosition(wordPos);
    knowledgeClone().opacity(1);
    knowledgeWord().opacity(0);

    yield* quoteContainer().opacity(0, Timing.slow, easeInOutCubic);

    yield* waitFor(2);

    yield* knowledgeClone().opacity(0, Timing.slow, easeInOutCubic);

    const codeBlocks = yield* playQuadCode(view, {
        blocks: [
            {code: INVOICE_CODE},
            {code: CHECKOUT_CODE},
            {code: FISCAL_CODE},
            {code: AUDIT_CODE},
        ],
        visibleIndices: [0, 1, 2],
    });

    const targetBlock = codeBlocks[3];
    targetBlock.hideAllTokens();

    yield* waitFor(0.5);

    const duration = Timing.slow;
    const sourceBlocks = [codeBlocks[0], codeBlocks[1], codeBlocks[2]];
    const highlightLineIndex = 3;

    yield* all(
        ...sourceBlocks.map(b =>
            all(
                b.highlightLines([[highlightLineIndex, highlightLineIndex]], duration),
                b.recolorLine(highlightLineIndex, Colors.accent, duration),
            ),
        ),
    );

    yield* waitFor(0.6);

    yield* targetBlock.appear(Timing.slow);

    const ghosts = buildLineGhosts(sourceBlocks, highlightLineIndex);
    mountGhosts(view, ghosts, 1);

    yield* all(
        ...sourceBlocks.map(b => b.hideLines([[highlightLineIndex, highlightLineIndex]], 0)),
    );

    const targetPos = targetBlock.getLineWorldPosition(3);
    if (targetPos) {
        yield* all(
            flyGhostsTo(ghosts, targetPos, 0.8),
            fadeOutGhosts(ghosts.slice(1), 0.6),
        );
    }

    yield* waitFor(2);
});
