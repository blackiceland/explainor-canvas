import {makeScene2D, Node, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Colors, Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';
import {playQuadCode} from '../core/templates/QuadCodeScene';

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

const HIGHLIGHT = ["new", "BigDecimal", "0.20"];

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
                a single, unambiguous,
            </Txt>
            <Txt
                fontFamily={Fonts.primary}
                fontSize={36}
                fill={Colors.text.primary}
                textAlign="center"
                y={50}
            >
                authoritative representation within a system
            </Txt>
            <Txt
                fontFamily={Fonts.primary}
                fontSize={24}
                fill={Colors.text.muted}
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

    yield* all(
        quoteContainer().opacity(1, Timing.slow, easeInOutCubic),
        quoteContainer().y(0, Timing.slow, easeInOutCubic),
    );

    yield* waitFor(2);

    const wordPos = knowledgeWord().absolutePosition();
    knowledgeClone().absolutePosition(wordPos);
    knowledgeClone().opacity(1);
    knowledgeWord().opacity(0);

    yield* quoteContainer().opacity(0, Timing.slow, easeInOutCubic);

    yield* waitFor(2);

    yield* knowledgeClone().opacity(0, Timing.slow, easeInOutCubic);

    yield* playQuadCode(view, {
        blocks: [
            {code: INVOICE_CODE, highlightLine: 3, highlightPattern: HIGHLIGHT},
            {code: CHECKOUT_CODE, highlightLine: 3, highlightPattern: HIGHLIGHT},
            {code: FISCAL_CODE, highlightLine: 3, highlightPattern: HIGHLIGHT},
            {code: AUDIT_CODE, highlightLine: 3, highlightPattern: HIGHLIGHT},
        ],
    });
});
