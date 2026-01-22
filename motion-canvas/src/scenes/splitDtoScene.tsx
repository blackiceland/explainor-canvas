import {Gradient, Line, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, createSignal, easeInOutCubic, Vector2, waitFor} from '@motion-canvas/core';
import {Colors, Fonts, Screen, Timing} from '../core/theme';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {ExplainorCodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY, getLineHeight} from '../core/code/shared/TextMeasure';
import {OpenStyle} from '../core/openStyle';
import {OpenShapes} from '../core/openShapes';
import {OpenText} from '../core/openText';

export default makeScene2D(function* (view) {
  const leftReveal = createSignal(0);
  const darkThemeOn = createSignal(0);
  const codeCardOn = createSignal(0);
  const serviceCodeOn = createSignal(0);
  const controllerCodeOn = createSignal(0);
  const dtoCodeOn = createSignal(0);
  const disableOtherLayers = createSignal(0);
  const dtoOn = createSignal(0);
  const dtoY = createSignal(0);
  const dtoServiceEntityCodeOn = createSignal(0);
  const dtoDbEntityCodeOn = createSignal(0);
  const dtoServiceEntityCardOn = createSignal(0);
  const dtoDbEntityCardOn = createSignal(0);
  const S = OpenStyle;

  // Match dryFiltersScene background base (applyBackground uses Colors.background gradient).
  const darkBg = Colors.background.from;

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
  const annotationYellow = '#FFD166';
  const highlightBlue = S.colors.blue;
  const outlineW = 2;
  const outlineDur = Timing.slow * 0.8;

  const dtoCardRef = createRef<Rect>();
  const dbCardRef = createRef<Rect>();
  const serviceCardRef = createRef<Rect>();
  const apiCardRef = createRef<Rect>();

  const slotTopY = -Screen.height / 2 + leftPadY + cardH / 2;
  const slotMidY = 0;
  const slotBotY = Screen.height / 2 - leftPadY - cardH / 2;
  dtoY(slotBotY);

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
    return dsl.select(
        PAYMENTS.ID,
        PAYMENTS.AMOUNT,
        PAYMENTS.CURRENCY,
        PAYMENTS.STATUS,
        PAYMENTS.UPDATED_AT
      )
      .from(PAYMENTS)
      .where(PAYMENTS.ID.eq(id))
      .fetchOneInto(PaymentDto.class);
  }
}`;

  const paymentsServiceCode = `@Service
final class PaymentsService {

  private final PaymentsRepository repository;

  PaymentsService(PaymentsRepository repository) {
    this.repository = repository;
  }

  @Transactional(readOnly = true)
  public PaymentDto getById(UUID id) {
    PaymentDto dto = repository.findById(id);

    if (dto == null) {
      throw new PaymentNotFoundException(id);
    }

    return dto;
  }
}`;

  const paymentsControllerCode = `@RestController
@RequestMapping("/payments")
final class PaymentsController {

  private final PaymentsService service;

  PaymentsController(PaymentsService service) {
    this.service = service;
  }

  @GetMapping("/{id}")
  public ResponseEntity<PaymentDto> get(
    @PathVariable UUID id
  ) {
    return ResponseEntity.ok(service.getById(id));
  }
}`;

  const paymentDtoCode = `public record PaymentDto(
  UUID id,
  BigDecimal amount,
  String currency,
  String status,
  String fraudReason,
  String stripeId,
  Instant updatedAt
) {}`;

  const dtoServiceEntityCode = `final class Payment {
  UUID id;
  BigDecimal amount;
  String currency;
  String status;
  Instant updatedAt;
}`;

  const dtoDbEntityCode = `final class PaymentEntity {
  UUID id;
  BigDecimal amount;
  String currency;
  String status;
  Instant updatedAt;
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

      {/* DTO card on the white side (shows the same DTO used across layers) */}
      <Rect
        ref={dtoCardRef}
        x={() => Math.min(dividerX() - leftPadX - cardW / 2, layerX + cardW + 52)}
        y={dtoY}
        width={cardW}
        height={cardH}
        radius={cardRadius}
        fill={cardFill}
        stroke={cardStroke}
        lineWidth={1}
        shadowColor={cardShadowColor}
        shadowBlur={cardShadowBlur}
        shadowOffset={cardShadowOffset}
        layout
        direction={'column'}
        alignItems={'center'}
        justifyContent={'center'}
        gap={0}
        opacity={() => dtoOn() * leftReveal()}
      >
        <Txt
          text={'PAYMENT DTO'}
          fontFamily={S.fonts.sans}
          fontSize={46}
          fontWeight={OpenText.service.fontWeight}
          letterSpacing={OpenText.service.letterSpacing}
          fill={labelFill}
          textAlign={'center'}
        />
      </Rect>

      {/* Service entity card on the white side (appears with service entity code) */}
      <Rect
        x={() => Math.min(dividerX() - leftPadX - cardW / 2, layerX + cardW + 52)}
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
        layout
        direction={'column'}
        alignItems={'center'}
        justifyContent={'center'}
        opacity={() => dtoServiceEntityCardOn() * leftReveal()}
      >
        <Txt
          text={'PAYMENT'}
          fontFamily={S.fonts.sans}
          fontSize={46}
          fontWeight={OpenText.service.fontWeight}
          letterSpacing={OpenText.service.letterSpacing}
          fill={labelFill}
          textAlign={'center'}
        />
      </Rect>

      {/* DB entity card on the white side (appears with DB entity code) */}
      <Rect
        x={() => Math.min(dividerX() - leftPadX - cardW / 2, layerX + cardW + 52)}
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
        layout
        direction={'column'}
        alignItems={'center'}
        justifyContent={'center'}
        opacity={() => dtoDbEntityCardOn() * leftReveal()}
      >
        <Txt
          text={'PAYMENT ENTITY'}
          fontFamily={S.fonts.sans}
          fontSize={40}
          fontWeight={OpenText.service.fontWeight}
          letterSpacing={OpenText.service.letterSpacing}
          fill={labelFill}
          textAlign={'center'}
        />
      </Rect>

      <Rect
        ref={dbCardRef}
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
        ref={serviceCardRef}
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
        ref={apiCardRef}
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
  // Keep a bit of side padding like before (otherwise the card feels too wide).
  const rightPadX = 72;
  const rightHalfW = Screen.width / 2;
  const rightHalfCenterX = Screen.width / 4;
  const codeCardW = rightHalfW - rightPadX * 2;
  const codeCardX = rightHalfCenterX;
  const codeCardY = slotMidY;
  const codeFontSize = 20;
  // Make all right-side code cards taller (same height) so Service/Controller can be more realistic.
  // Keep top alignment (no extra offsets) so increasing height doesn't break layout.
  const rightCardLineCount = Math.max(
    paymentsPersistenceCode.split('\n').length,
    paymentsServiceCode.split('\n').length,
    paymentsControllerCode.split('\n').length,
    paymentDtoCode.split('\n').length,
  );
  // Add headroom so the Service/Controller can grow without resizing again.
  const extraLines = 6;
  const repoCardH = (rightCardLineCount + extraLines) * getLineHeight(codeFontSize) + getCodePaddingY(codeFontSize) * 2;

  const serviceSigLine = paymentsServiceCode.split('\n').findIndex(l => l.includes('public') && l.includes('PaymentDto'));
  const controllerSigLine = paymentsControllerCode.split('\n').findIndex(l => l.includes('public') && l.includes('PaymentDto'));

  const persistenceCodeCard = CodeBlock.fromCode(paymentsPersistenceCode, {
    x: codeCardX,
    y: codeCardY,
    width: codeCardW,
    height: repoCardH,
    fontSize: codeFontSize,
    fontFamily: Fonts.code,
    theme: ExplainorCodeTheme,
    customTypes: ['PaymentsRepository', 'DSLContext', 'PaymentDto', 'UUID', 'BigDecimal'],
  });
  persistenceCodeCard.mount(view);
  persistenceCodeCard.node.opacity(() => darkThemeOn() * codeCardOn());

  const serviceCodeCard = CodeBlock.fromCode(paymentsServiceCode, {
    x: codeCardX,
    y: codeCardY,
    width: codeCardW,
    height: repoCardH,
    fontSize: codeFontSize,
    fontFamily: Fonts.code,
    theme: ExplainorCodeTheme,
    customTypes: ['PaymentsService', 'PaymentsRepository', 'PaymentDto', 'UUID'],
  });
  serviceCodeCard.mount(view);
  serviceCodeCard.node.opacity(() => darkThemeOn() * serviceCodeOn());

  const dtoCodeCard = CodeBlock.fromCode(paymentDtoCode, {
    x: codeCardX,
    y: codeCardY,
    width: codeCardW,
    height: repoCardH,
    fontSize: 24,
    lineHeight: getLineHeight(24),
    // Keep the same top-left alignment as other code cards.
    contentOffsetY: 0,
    fontFamily: Fonts.code,
    theme: ExplainorCodeTheme,
    customTypes: ['PaymentDto', 'UUID', 'BigDecimal', 'Instant'],
  });
  dtoCodeCard.mount(view);
  dtoCodeCard.node.opacity(() => darkThemeOn() * dtoCodeOn());

  // DTO leak animation (no second card, no holes):
  // start state looks like DTO without leak fields, then leak lines appear and push the tail down.
  const dtoFontSize = 24;
  const dtoLineH = getLineHeight(dtoFontSize);
  const dtoFraudIndex = paymentDtoCode.split('\n').findIndex(l => l.includes('fraudReason'));
  const dtoStripeIndex = paymentDtoCode.split('\n').findIndex(l => l.includes('stripeId'));
  const dtoUpdatedIndex = paymentDtoCode.split('\n').findIndex(l => l.includes('Instant updatedAt'));
  const dtoLineCount = paymentDtoCode.split('\n').length;

  const dtoFraudLine = dtoFraudIndex >= 0 ? dtoCodeCard.getLine(dtoFraudIndex) : null;
  const dtoStripeLine = dtoStripeIndex >= 0 ? dtoCodeCard.getLine(dtoStripeIndex) : null;
  const dtoUpdatedLine = dtoUpdatedIndex >= 0 ? dtoCodeCard.getLine(dtoUpdatedIndex) : null;

  const dtoTailLines =
    dtoUpdatedIndex >= 0
      ? Array.from({length: dtoLineCount - dtoUpdatedIndex}, (_, k) => dtoCodeCard.getLine(dtoUpdatedIndex + k))
          .filter(Boolean)
      : [];
  const dtoTailOriginalY = dtoTailLines.map(l => l!.node.y());
  const dtoFraudTargetY = dtoFraudLine?.node.y() ?? 0;
  const dtoStripeTargetY = dtoStripeLine?.node.y() ?? 0;

  if (dtoUpdatedLine && dtoFraudLine && dtoStripeLine) {
    const collapsedY = dtoUpdatedLine.node.y() - 2 * dtoLineH;
    // Hide leak lines and collapse tail so the DTO looks "clean" at first.
    dtoFraudLine.node.opacity(0);
    dtoStripeLine.node.opacity(0);
    dtoFraudLine.node.y(collapsedY);
    dtoStripeLine.node.y(collapsedY);
    for (let i = 0; i < dtoTailLines.length; i++) {
      const line = dtoTailLines[i]!;
      line.node.y(dtoTailOriginalY[i] - 2 * dtoLineH);
    }
  }

  // Entities under the DTO: CodeBlock overlays with the same theme; fade in one-by-one.
  const dtoClipH = repoCardH - getCodePaddingY(dtoFontSize) * 2;
  const dtoLastLine = dtoCodeCard.getLine(dtoLineCount - 1);
  const dtoBelowStartY = (dtoLastLine?.node.y() ?? 0) + dtoLineH * 1.35; // Payment a touch lower
  const dtoServiceFirstLineY = dtoBelowStartY;
  const serviceLines = dtoServiceEntityCode.split('\n').length;
  const dtoDbFirstLineY = dtoServiceFirstLineY + serviceLines * dtoLineH + dtoLineH * 0.25; // Entity a touch higher / tighter gap

  const dtoServiceOffsetY = dtoServiceFirstLineY + dtoClipH / 2 - dtoLineH / 2;
  const dtoDbOffsetY = dtoDbFirstLineY + dtoClipH / 2 - dtoLineH / 2;

  const overlayCardStyle = {
    fill: 'rgba(0,0,0,0)',
    stroke: 'rgba(0,0,0,0)',
    strokeWidth: 0,
    shadowColor: 'rgba(0,0,0,0)',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    edge: false,
    opacity: 0,
  } as const;

  const dtoServiceEntityCodeCard = CodeBlock.fromCode(dtoServiceEntityCode, {
    x: codeCardX,
    y: codeCardY,
    width: codeCardW,
    height: repoCardH,
    fontSize: dtoFontSize,
    lineHeight: dtoLineH,
    contentOffsetY: dtoServiceOffsetY,
    fontFamily: Fonts.code,
    theme: ExplainorCodeTheme,
    customTypes: ['Payment', 'UUID', 'BigDecimal', 'Instant'],
    cardStyle: overlayCardStyle,
  });
  dtoServiceEntityCodeCard.mount(view);
  dtoServiceEntityCodeCard.node.opacity(() => darkThemeOn() * dtoCodeOn() * dtoServiceEntityCodeOn());

  const dtoDbEntityCodeCard = CodeBlock.fromCode(dtoDbEntityCode, {
    x: codeCardX,
    y: codeCardY,
    width: codeCardW,
    height: repoCardH,
    fontSize: dtoFontSize,
    lineHeight: dtoLineH,
    contentOffsetY: dtoDbOffsetY,
    fontFamily: Fonts.code,
    theme: ExplainorCodeTheme,
    customTypes: ['PaymentEntity', 'UUID', 'BigDecimal', 'Instant'],
    cardStyle: overlayCardStyle,
  });
  dtoDbEntityCodeCard.mount(view);
  dtoDbEntityCodeCard.node.opacity(() => darkThemeOn() * dtoCodeOn() * dtoDbEntityCodeOn());

  const controllerCodeCard = CodeBlock.fromCode(paymentsControllerCode, {
    x: codeCardX,
    y: codeCardY,
    width: codeCardW,
    height: repoCardH,
    fontSize: codeFontSize,
    fontFamily: Fonts.code,
    theme: ExplainorCodeTheme,
    customTypes: ['PaymentsController', 'PaymentsService', 'PaymentDto', 'UUID', 'GetMapping', 'PathVariable'],
  });
  controllerCodeCard.mount(view);
  controllerCodeCard.node.opacity(() => darkThemeOn() * controllerCodeOn());
  // Make annotations consistently yellow (service + controller)
  const annotationTokens = ['@Service', '@Transactional', '@RestController', '@RequestMapping', '@GetMapping', '@PathVariable'];
  yield* all(
    ...Array.from({length: serviceCodeCard.lineCount}, (_, i) =>
      serviceCodeCard.recolorTokens(i, annotationTokens, annotationYellow, 0),
    ),
    ...Array.from({length: controllerCodeCard.lineCount}, (_, i) =>
      controllerCodeCard.recolorTokens(i, annotationTokens, annotationYellow, 0),
    ),
  );

  // Pink accent: highlight PaymentDto only in method signatures (no dimming, no body highlight).
  if (serviceSigLine >= 0) {
    yield* serviceCodeCard.recolorTokens(serviceSigLine, ['PaymentDto'], Colors.accent, 0);
  }
  if (controllerSigLine >= 0) {
    yield* controllerCodeCard.recolorTokens(controllerSigLine, ['PaymentDto'], Colors.accent, 0);
  }

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

  // Highlight animation (repo card only) + DTO card fade-in must start together.
  const dimOpacity = 0.22;
  const highlightDur = Timing.slow * 0.9;
  const dimAllOtherLines = Array.from({length: persistenceCodeCard.lineCount}, (_, i) =>
    i === 8 ? waitFor(0) : persistenceCodeCard.setLineTokensOpacity(i, dimOpacity, highlightDur),
  );
  yield* all(
    dtoOn(1, Timing.slow * 1.05, easeInOutCubic),
    ...dimAllOtherLines,
    persistenceCodeCard.setLineTokensOpacity(8, dimOpacity, highlightDur),
    persistenceCodeCard.setLineTokensOpacityMatching(8, ['PaymentDto'], 1, highlightDur),
    persistenceCodeCard.recolorTokens(8, ['PaymentDto'], Colors.accent, highlightDur),
  );

  // Before the DTO card starts moving, the repository (persistence) code card must fade out.
  yield* all(
    codeCardOn(0, Timing.slow * 0.65, easeInOutCubic),
    disableOtherLayers(0, Timing.slow * 0.65, easeInOutCubic),
  );

  // Move DTO card up through layers; right-side code cards switch.
  const travel = Timing.slow * 1.05;
  const serviceFadeIn = Timing.slow * 0.75;
  // Must fully disappear before controller starts to appear, and still be fully visible at arrival.
  const serviceFadeOut = Math.max(0.2, Math.min(Timing.fast, travel - (Timing.slow * 0.75) - 0.03));
  const controllerFadeIn = Timing.slow * 0.75;

  // 1) DB -> SERVICE: continuous move; service card fades in shortly before arrival (no pauses).
  yield* all(
    dtoY(slotMidY, travel, easeInOutCubic),
    (function* () {
      // Start fade-in so it's fully visible exactly at arrival.
      yield* waitFor(Math.max(0, travel - serviceFadeIn));
      yield* serviceCodeOn(1, serviceFadeIn, easeInOutCubic);
    })(),
  );

  // 2) SERVICE -> API: service fades out at start, controller fades in before arrival (continuous move).
  yield* all(
    dtoY(slotTopY, travel, easeInOutCubic),
    (function* () {
      yield* serviceCodeOn(0, serviceFadeOut, easeInOutCubic);
      // Start fade-in so it's fully visible exactly at arrival (and only after service is gone).
      yield* waitFor(Math.max(serviceFadeOut, travel - controllerFadeIn));
      yield* controllerCodeOn(1, controllerFadeIn, easeInOutCubic);
    })(),
  );

  // After controller: fade it out, then show DTO code on the right before the blue outline.
  yield* controllerCodeOn(0, Timing.slow * 0.6, easeInOutCubic);
  yield* waitFor(0.25);
  // DTO code card appears at the same moment as the blue outline on light cards.
  yield* all(
    dtoCodeOn(1, Timing.slow * 0.85, easeInOutCubic),
    dtoCardRef().stroke(highlightBlue, outlineDur, easeInOutCubic),
    dbCardRef().stroke(highlightBlue, outlineDur, easeInOutCubic),
    serviceCardRef().stroke(highlightBlue, outlineDur, easeInOutCubic),
    apiCardRef().stroke(highlightBlue, outlineDur, easeInOutCubic),
    dtoCardRef().lineWidth(outlineW, outlineDur, easeInOutCubic),
    dbCardRef().lineWidth(outlineW, outlineDur, easeInOutCubic),
    serviceCardRef().lineWidth(outlineW, outlineDur, easeInOutCubic),
    apiCardRef().lineWidth(outlineW, outlineDur, easeInOutCubic),
  );
  yield* waitFor(1);
  yield* all(
    dtoCardRef().stroke(cardStroke, Timing.slow * 0.7, easeInOutCubic),
    dbCardRef().stroke(cardStroke, Timing.slow * 0.7, easeInOutCubic),
    serviceCardRef().stroke(cardStroke, Timing.slow * 0.7, easeInOutCubic),
    apiCardRef().stroke(cardStroke, Timing.slow * 0.7, easeInOutCubic),
    dtoCardRef().lineWidth(1, Timing.slow * 0.7, easeInOutCubic),
    dbCardRef().lineWidth(1, Timing.slow * 0.7, easeInOutCubic),
    serviceCardRef().lineWidth(1, Timing.slow * 0.7, easeInOutCubic),
    apiCardRef().lineWidth(1, Timing.slow * 0.7, easeInOutCubic),
  );

  // After the highlight: leak lines appear and push the tail down (no blinking).
  if (dtoFraudLine && dtoStripeLine && dtoUpdatedLine && dtoTailLines.length > 0) {
    const dur = Timing.slow * 0.55;
    // Focus on DB layer while leak fields appear (disable other layer cards).
    yield* disableOtherLayers(1, Timing.slow * 0.55, easeInOutCubic);

    // 1) Reveal fraudReason and push tail down by 1 line
    yield* all(
      dtoFraudLine.node.opacity(1, dur, easeInOutCubic),
      dtoFraudLine.node.y(dtoFraudTargetY, dur, easeInOutCubic),
      ...dtoTailLines.map((l, i) => l!.node.y(dtoTailOriginalY[i] - 1 * dtoLineH, dur, easeInOutCubic)),
    );
    yield* waitFor(0.12);
    // 2) Reveal stripeId and push tail down by 1 more line
    yield* all(
      dtoStripeLine.node.opacity(1, dur, easeInOutCubic),
      dtoStripeLine.node.y(dtoStripeTargetY, dur, easeInOutCubic),
      ...dtoTailLines.map((l, i) => l!.node.y(dtoTailOriginalY[i], dur, easeInOutCubic)),
    );

    // Hold leak state for a few seconds, then revert smoothly and re-enable cards.
    yield* waitFor(2.0);
    const retractDur = Timing.slow * 0.55;
    const collapsedY = dtoUpdatedLine.node.y() - 2 * dtoLineH;

    // Retract stripeId and pull tail up by 1 line, while restoring layer emphasis.
    yield* all(
      disableOtherLayers(0, Timing.slow * 0.75, easeInOutCubic),
      dtoStripeLine.node.opacity(0, retractDur, easeInOutCubic),
      dtoStripeLine.node.y(collapsedY, retractDur, easeInOutCubic),
      ...dtoTailLines.map((l, i) => l!.node.y(dtoTailOriginalY[i] - 1 * dtoLineH, retractDur, easeInOutCubic)),
    );
    yield* waitFor(0.10);

    // Retract fraudReason and return the tail to the original "clean" position.
    yield* all(
      dtoFraudLine.node.opacity(0, retractDur, easeInOutCubic),
      dtoFraudLine.node.y(collapsedY, retractDur, easeInOutCubic),
      ...dtoTailLines.map((l, i) => l!.node.y(dtoTailOriginalY[i] - 2 * dtoLineH, retractDur, easeInOutCubic)),
    );

    // Entities appear under the DTO: smooth, one-by-one (no typing), synced with light cards.
    yield* waitFor(0.2);
    yield* all(
      dtoServiceEntityCodeOn(1, Timing.slow * 0.8, easeInOutCubic),
      dtoServiceEntityCardOn(1, Timing.slow * 0.8, easeInOutCubic),
    );
    yield* waitFor(0.16);
    yield* all(
      dtoDbEntityCodeOn(1, Timing.slow * 0.8, easeInOutCubic),
      dtoDbEntityCardOn(1, Timing.slow * 0.8, easeInOutCubic),
    );
  }

  // Scene outro: fade everything out together, while dark half "pushes" the light half away.
  yield* waitFor(2.2);
  const componentsDur = Timing.slow * 0.75;
  const bgDur = Timing.slow * 1.1;
  yield* all(
    // left half content
    apiOn(0, componentsDur, easeInOutCubic),
    serviceOn(0, componentsDur, easeInOutCubic),
    dbOn(0, componentsDur, easeInOutCubic),
    sep1On(0, componentsDur, easeInOutCubic),
    sep2On(0, componentsDur, easeInOutCubic),
    dtoOn(0, componentsDur, easeInOutCubic),
    dtoServiceEntityCardOn(0, componentsDur, easeInOutCubic),
    dtoDbEntityCardOn(0, componentsDur, easeInOutCubic),

    // right half code overlays
    codeCardOn(0, componentsDur, easeInOutCubic),
    serviceCodeOn(0, componentsDur, easeInOutCubic),
    controllerCodeOn(0, componentsDur, easeInOutCubic),
    dtoCodeOn(0, componentsDur, easeInOutCubic),
    dtoServiceEntityCodeOn(0, componentsDur, easeInOutCubic),
    dtoDbEntityCodeOn(0, componentsDur, easeInOutCubic),

    // background transition: dark expands + gradients disappear
    leftReveal(0, bgDur, easeInOutCubic),
  );

  yield* waitFor(0.4);
});


