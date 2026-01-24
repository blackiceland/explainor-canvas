import {makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {applyBackground} from '../core/utils';
import {Fonts, Screen, Timing} from '../core/theme';
import {PanelStyle} from '../core/panelStyle';

const CODE = `@Service
final class PaymentsService {

  private final PaymentsRepository repository;

  PaymentsService(PaymentsRepository repository) {
    this.repository = repository;
  }

  @Transactional(readOnly = true)
  public PaymentDto getById(UUID id) {
    return repository.findById(id);
  }
}`;

export default makeScene2D(function* (view) {
  applyBackground(view);

  const typed = createSignal('');
  const cursorOn = createSignal(1);

  const cardW = 1180;
  const cardH = 640;
  const pad = 44;

  view.add(
    <Rect
      width={cardW}
      height={cardH}
      radius={PanelStyle.radius}
      fill={PanelStyle.fill}
      stroke={PanelStyle.stroke}
      lineWidth={PanelStyle.lineWidth}
      shadowColor={PanelStyle.shadowColor}
      shadowBlur={PanelStyle.shadowBlur}
      shadowOffset={PanelStyle.shadowOffset}
      clip
      layout={false}
    >
      <Txt
        x={() => -cardW / 2 + pad}
        y={() => -cardH / 2 + pad}
        width={() => cardW - pad * 2}
        text={() => typed() + (cursorOn() ? '▍' : '')}
        fontFamily={Fonts.code}
        fontSize={28}
        lineHeight={42}
        fontWeight={400}
        fill={PanelStyle.labelFill}
        textAlign={'left'}
        offset={[-1, -1]}
      />
    </Rect>,
  );

  yield* waitFor(0.35);

  // Typewriter: simple per-character reveal.
  for (let i = 0; i <= CODE.length; i++) {
    typed(CODE.slice(0, i));
    const ch = CODE[i] ?? '';
    const dt =
      ch === '\n' ? 0.05 :
      ch === ' ' ? 0.012 :
      /[{}();]/.test(ch) ? 0.02 :
      0.015;
    yield* waitFor(dt);
  }

  // Cursor blink at the end (subtle).
  yield* waitFor(0.25);
  for (let i = 0; i < 6; i++) {
    yield* cursorOn(0, 0.12, easeInOutCubic);
    yield* cursorOn(1, 0.12, easeInOutCubic);
  }

  yield* waitFor(Timing.slow);
});







