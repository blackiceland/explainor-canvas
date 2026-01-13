import {Gradient, Line, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, Vector2, waitFor} from '@motion-canvas/core';
import {Colors, Fonts, Screen, Timing} from '../core/theme';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {ExplainorCodeTheme} from '../core/code/model/SyntaxTheme';
import {OpenStyle} from '../core/openStyle';
import {OpenShapes} from '../core/openShapes';
import {OpenText} from '../core/openText';

export default makeScene2D(function* (view) {
  const leftReveal = createSignal(0);
  const darkThemeOn = createSignal(0);
  const codeCardOn = createSignal(0);
  const disableOtherLayers = createSignal(0);
  const S = OpenStyle;

  const darkBg = '#0B0B0B';

  const halfW = Screen.width / 2;
  const halfH = Screen.height;
  const leftRevealW = () => halfW * leftReveal();
  const leftRevealX = () => -Screen.width / 2 + leftRevealW() / 2;
  const dividerX = () => -Screen.width / 2 + leftRevealW();

  const leftPadX = 48;
  const leftPadY = 48;

  const cardW = halfW / 2 - leftPadX * 2;
  const cardH = 220;
  const cardRadius = OpenShapes.radius.card;
  const cardFill = S.colors.card;
  const cardStroke = S.colors.border;
  const cardShadowColor = OpenShapes.shadow.color;
  const cardShadowBlur = OpenShapes.shadow.blur;
  const cardShadowOffset = OpenShapes.shadow.offset;

  const labelFill = S.colors.ink;
  const sepStroke = S.colors.transport;

  const slotTopY = -Screen.height / 2 + leftPadY + cardH / 2;
  const slotMidY = 0;
  const slotBotY = Screen.height / 2 - leftPadY - cardH / 2;

  const layerX = -Screen.width / 2 + leftPadX + cardW / 2;

  const dbOn = createSignal(0);
  const serviceOn = createSignal(0);
  const apiOn = createSignal(0);
  const dimmedLayerOpacity = (base: number) => base * (1 - disableOtherLayers() * 0.82);

  const sep1On = createSignal(0);
  const sep1End = createSignal(0);
  const sep2On = createSignal(0);
  const sep2End = createSignal(0);

  const darkGradient = new Gradient({
    type: 'linear',
    from: new Vector2(0, -Screen.height / 2),
    to: new Vector2(0, Screen.height / 2),
    stops: [
      {offset: 0, color: Colors.background.from},
      {offset: 1, color: Colors.background.to},
    ],
  });

  const darkSpotlight = new Gradient({
    type: 'radial',
    from: new Vector2(Screen.width * 0.12, -Screen.height * 0.12),
    to: new Vector2(Screen.width * 0.12, -Screen.height * 0.12),
    fromRadius: 0,
    toRadius: Screen.width * 0.95,
    stops: [
      {offset: 0, color: 'rgba(246,231,212,0.045)'},
      {offset: 1, color: 'rgba(255,255,255,0)'},
    ],
  });

  const sepX1 = () => -Screen.width / 2;
  const sepX2 = () => dividerX();
  const sepY1 = (slotTopY + cardH / 2 + (slotMidY - cardH / 2)) / 2;
  const sepY2 = (slotMidY + cardH / 2 + (slotBotY - cardH / 2)) / 2;

  const paymentsPersistenceCode = `final class PaymentsRepository {

  private final DSLContext dsl;

  PaymentsRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  public PaymentDto findById(UUID id) {
    return dsl.selectFrom(PAYMENTS)
      .where(PAYMENTS.ID.eq(id))
      .fetchOneInto(PaymentDto.class);
  }
}`;

  view.add(
    <>
      <Rect width={Screen.width} height={halfH} fill={darkBg} />
      <Rect
        width={Screen.width}
        height={halfH}
        fill={darkGradient}
        opacity={darkThemeOn}
      />
      <Rect
        width={Screen.width}
        height={halfH}
        fill={darkSpotlight}
        opacity={darkThemeOn}
      />
      <Rect
        x={leftRevealX}
        width={leftRevealW}
        height={halfH}
        fill={S.colors.bg}
        opacity={1}
      />
      <Rect x={dividerX} width={1} height={halfH} fill={S.colors.border} opacity={leftReveal} />

      <Line
        points={() => [
          [sepX1(), sepY1],
          [sepX2(), sepY1],
        ]}
        stroke={sepStroke}
        lineWidth={2}
        lineDash={[14, 12]}
        lineCap={'round'}
        end={sep1End}
        opacity={() => sep1On() * leftReveal()}
      />
      <Line
        points={() => [
          [sepX1(), sepY2],
          [sepX2(), sepY2],
        ]}
        stroke={sepStroke}
        lineWidth={2}
        lineDash={[14, 12]}
        lineCap={'round'}
        end={sep2End}
        opacity={() => sep2On() * leftReveal()}
      />

      <Rect
        x={layerX}
        y={slotBotY}
        width={cardW}
        height={cardH}
        radius={cardRadius}
        fill={cardFill}
        stroke={cardStroke}
        lineWidth={1}
        shadowColor={cardShadowColor}
        shadowBlur={cardShadowBlur}
        shadowOffset={cardShadowOffset}
        clip
        layout
        alignItems={'center'}
        justifyContent={'center'}
        direction={'column'}
        gap={4}
        opacity={dbOn}
      >
        <Txt
          text={'PERSISTENCE'}
          fontFamily={S.fonts.sans}
          fontSize={46}
          fontWeight={OpenText.service.fontWeight}
          letterSpacing={OpenText.service.letterSpacing}
          fill={labelFill}
          textAlign={'center'}
          lineHeight={52}
        />
        <Txt
          text={'DB LAYER'}
          fontFamily={S.fonts.sans}
          fontSize={36}
          fontWeight={OpenText.service.fontWeight}
          letterSpacing={OpenText.service.letterSpacing}
          fill={sepStroke}
          textAlign={'center'}
          lineHeight={42}
        />
      </Rect>

      <Rect
        x={layerX}
        y={slotMidY}
        width={cardW}
        height={cardH}
        radius={cardRadius}
        fill={cardFill}
        stroke={cardStroke}
        lineWidth={1}
        shadowColor={cardShadowColor}
        shadowBlur={cardShadowBlur}
        shadowOffset={cardShadowOffset}
        clip
        layout
        alignItems={'center'}
        justifyContent={'center'}
        direction={'column'}
        gap={4}
        opacity={() => dimmedLayerOpacity(serviceOn())}
      >
        <Txt
          text={'SERVICE'}
          fontFamily={S.fonts.sans}
          fontSize={46}
          fontWeight={OpenText.service.fontWeight}
          letterSpacing={OpenText.service.letterSpacing}
          fill={labelFill}
          textAlign={'center'}
          lineHeight={52}
        />
        <Txt
          text={'DOMAIN LAYER'}
          fontFamily={S.fonts.sans}
          fontSize={36}
          fontWeight={OpenText.service.fontWeight}
          letterSpacing={OpenText.service.letterSpacing}
          fill={sepStroke}
          textAlign={'center'}
          lineHeight={42}
        />
      </Rect>

      <Rect
        x={layerX}
        y={slotTopY}
        width={cardW}
        height={cardH}
        radius={cardRadius}
        fill={cardFill}
        stroke={cardStroke}
        lineWidth={1}
        shadowColor={cardShadowColor}
        shadowBlur={cardShadowBlur}
        shadowOffset={cardShadowOffset}
        clip
        layout
        alignItems={'center'}
        justifyContent={'center'}
        direction={'column'}
        gap={4}
        opacity={() => dimmedLayerOpacity(apiOn())}
      >
        <Txt
          text={'API LAYER'}
          fontFamily={S.fonts.sans}
          fontSize={46}
          fontWeight={OpenText.service.fontWeight}
          letterSpacing={OpenText.service.letterSpacing}
          fill={labelFill}
          textAlign={'center'}
          lineHeight={52}
        />
        <Txt
          text={'TRANSPORT'}
          fontFamily={S.fonts.sans}
          fontSize={36}
          fontWeight={OpenText.service.fontWeight}
          letterSpacing={OpenText.service.letterSpacing}
          fill={sepStroke}
          textAlign={'center'}
          lineHeight={42}
        />
      </Rect>
    </>,
  );

  // Right side: code cards (match dryFiltersScene styling via CodeBlock/CodeCard)
  const rightPadX = 72;
  const rightHalfW = Screen.width / 2;
  const rightHalfCenterX = Screen.width / 4;
  const codeCardW = rightHalfW - rightPadX * 2;
  const codeCardX = rightHalfCenterX;
  const codeCardY = slotMidY;

  const persistenceCodeCard = CodeBlock.fromCode(paymentsPersistenceCode, {
    x: codeCardX,
    y: codeCardY,
    width: codeCardW,
    fontSize: 20,
    fontFamily: Fonts.code,
    theme: ExplainorCodeTheme,
    customTypes: ['PaymentsRepository', 'DSLContext', 'PaymentDto', 'UUID', 'PAYMENTS', 'BigDecimal'],
  });
  persistenceCodeCard.mount(view);
  persistenceCodeCard.node.opacity(() => darkThemeOn() * codeCardOn());

  yield* all(
    leftReveal(1, Timing.slow * 1.35, easeInOutCubic),
    darkThemeOn(1, Timing.slow * 1.35, easeInOutCubic),
  );
  yield* waitFor(0.35);

  yield* all(
    sep1On(1, Timing.slow * 0.55, easeInOutCubic),
    sep2On(1, Timing.slow * 0.55, easeInOutCubic),
  );
  yield* all(
    sep1End(1, Timing.slow * 0.65, easeInOutCubic),
    sep2End(1, Timing.slow * 0.65, easeInOutCubic),
  );
  yield* waitFor(0.2);

  yield* apiOn(1, Timing.slow * 0.95, easeInOutCubic);
  yield* waitFor(0.12);
  yield* serviceOn(1, Timing.slow * 0.95, easeInOutCubic);
  yield* waitFor(0.12);
  yield* dbOn(1, Timing.slow * 0.95, easeInOutCubic);

  // After the layer cards are in, reveal the right-side code card and "disable" non-persistence layers.
  yield* waitFor(0.25);
  yield* all(
    codeCardOn(1, Timing.slow * 0.9, easeInOutCubic),
    disableOtherLayers(1, Timing.slow * 0.9, easeInOutCubic),
  );
  yield* waitFor(0.2);
  // Dim all code and highlight only the DTO token in the method signature (not the whole line)
  yield* persistenceCodeCard.dimLines(0, persistenceCodeCard.lineCount - 1, 0.25, Timing.slow * 0.7);
  yield* persistenceCodeCard.recolorTokens(8, ['PaymentDto'], Colors.accent, Timing.slow * 0.7);
  yield* waitFor(10);
});


