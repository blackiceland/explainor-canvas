import {makeScene2D, Node, Txt, Gradient} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, waitFor, Vector2} from '@motion-canvas/core';
import {ExplainorTheme} from '../core/theme';
import {QuadCodeScene, applyGradientBackground} from '../core/templates/QuadCodeScene';

const COLORS = ExplainorTheme.colors;
const FONTS = ExplainorTheme.fonts;

const INVOICE_CODE = `class InvoiceService {
  BigDecimal total(BigDecimal val) {
    return val.multiply(
      new BigDecimal("0.20")
    );
  }
}`;

const CHECKOUT_CODE = `class CheckoutService {
  BigDecimal tax(BigDecimal val) {
    return val.multiply(
      new BigDecimal("0.20")
    );
  }
}`;

const FISCAL_CODE = `class FiscalExport {
  BigDecimal vat(BigDecimal val) {
    return val.multiply(
      new BigDecimal("0.20")
    );
  }
}`;

const AUDIT_CODE = `class AuditService {
  BigDecimal check(BigDecimal val) {
    return val.multiply(
      new BigDecimal("0.20")
    );
  }
}`;

const HIGHLIGHT_PATTERN = ["new", "BigDecimal", "0.20"];

export default makeScene2D(function* (view) {
    applyGradientBackground(view);

    const quoteContainer = createRef<Node>();
    const knowledgeWord = createRef<Txt>();
    const knowledgeClone = createRef<Txt>();

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

    yield* all(
        quoteContainer().opacity(1, 0.8, easeInOutCubic),
        quoteContainer().y(0, 0.8, easeInOutCubic),
    );

    yield* waitFor(2);

    const wordPos = knowledgeWord().absolutePosition();
    knowledgeClone().absolutePosition(wordPos);
    knowledgeClone().opacity(1);
    knowledgeWord().opacity(0);

    yield* quoteContainer().opacity(0, 1.0, easeInOutCubic);

    yield* waitFor(2);

    yield* knowledgeClone().opacity(0, 0.8, easeInOutCubic);

    yield* QuadCodeScene.play(view, {
        blocks: [
            { code: INVOICE_CODE, highlightLine: 3, highlightPattern: HIGHLIGHT_PATTERN },
            { code: CHECKOUT_CODE, highlightLine: 3, highlightPattern: HIGHLIGHT_PATTERN },
            { code: FISCAL_CODE, highlightLine: 3, highlightPattern: HIGHLIGHT_PATTERN },
            { code: AUDIT_CODE, highlightLine: 3, highlightPattern: HIGHLIGHT_PATTERN },
        ],
    });
});