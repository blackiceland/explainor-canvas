import {Gradient, Line, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, createSignal, easeInOutCubic, Vector2, waitFor} from '@motion-canvas/core';
import {Colors, Fonts, Screen, Timing} from '../core/theme';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {LightBgCodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY, getLineHeight} from '../core/code/shared/TextMeasure';
import {OpenStyle} from '../core/openStyle';
import {OpenShapes} from '../core/openShapes';
import {OpenText} from '../core/openText';

// V3: Inverted split — dark slides over light from the left.
// Right side is light with code directly on bg (no card), like dryConditionsScene.

export default makeScene2D(function* (view) {
  // In V3: dark reveals from left, light is on the right (base).
  const darkReveal = createSignal(0); // 0 = full light, 1 = dark covers left half
  // Clamp for opacity math (we use darkReveal=2 in outro to cover full screen with dark).
  const darkK = () => Math.min(1, Math.max(0, darkReveal()));
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

  // Light background (matching end of paymentInputsSceneV3).
  const lightBg = '#E7DCC9';
  const darkBg = Colors.background.from;

  const halfW = Screen.width / 2;
  const halfH = Screen.height;
  // Dark panel slides in from the left.
  const darkRevealW = () => halfW * darkReveal();
  const darkRevealX = () => -Screen.width / 2 + darkRevealW() / 2;
  const dividerX = () => -Screen.width / 2 + darkRevealW();

  const leftPadX = 48;
  const leftPadY = 48;

  const cardW = halfW / 2 - leftPadX * 2;
  const cardH = 220;
  const cardRadius = OpenShapes.radius.card;
  // V3: Cards styled like paymentInputsSceneV3 (beige, thin stroke, minimal shadow).
  const cardFill = 'rgba(231, 220, 201, 0.06)';
  const cardStroke = 'rgba(231, 220, 201, 0.18)';
  const cardShadowColor = 'rgba(252,251,248,0.10)';
  const cardShadowBlur = 4;
  const cardShadowOffset: [number, number] = [0, 0];

  // V3: Code directly on light background — no card.
  const transparentCardStyle = {
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

  // Left card labels: V3 has dark background on left, so use LIGHT text.
  const labelFill = Colors.text.primary;
  // Separator lines: webhookDto hue, but softer (less aggressive).
  const sepStroke = 'rgba(201, 154, 58, 0.42)';
  const annotationYellow = '#8B5A00';  // Darker gold for light bg
  const highlightBlue = '#5A9CFF';     // Strong blue accent (only blue for card frames)
  const outlineW = 2.5;
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
      // Start from the same base as the intro, so the transition is seamless.
      {offset: 0, color: darkBg},
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
  // Pixel-snap separator positions to avoid sub-pixel antialiasing differences between the two lines.
  const sepY1Px = () => Math.round(sepY1);
  const sepY2Px = () => Math.round(sepY2);

  // DTO position helper (used by both card and separator cut-outs).
  const dtoCardX = () => Math.min(dividerX() - leftPadX - cardW / 2, layerX + cardW + 52);

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
  String fraudReason;
  String stripeId;
}`;

  // Separator lines refs for z-ordering
  const sep1Ref = createRef<Line>();
  const sep2Ref = createRef<Line>();

  view.add(
    <>
      {/* V3: Light base (matching paymentInputsSceneV3 end) */}
      <Rect width={Screen.width} height={halfH} fill={lightBg} />

      {/* Dark panel slides in from the left */}
      <Rect
        x={darkRevealX}
        width={darkRevealW}
        height={halfH}
        fill={darkBg}
      />

      {/* Divider line */}
      <Rect x={dividerX} width={1} height={halfH} fill={'rgba(0,0,0,0.15)'} opacity={darkK} />

      {/* Separator lines */}
      <Line
        ref={sep1Ref}
        points={() => [
          [Math.round(sepX1()), sepY1Px()],
          [Math.round(sepX2()), sepY1Px()],
        ]}
        stroke={sepStroke}
        lineWidth={2}
        lineDash={[14, 12]}
        lineCap={'round'}
        end={sep1End}
        opacity={() => sep1On() * darkK()}
      />
      <Line
        ref={sep2Ref}
        points={() => [
          [Math.round(sepX1()), sepY2Px()],
          [Math.round(sepX2()), sepY2Px()],
        ]}
        stroke={sepStroke}
        lineWidth={2}
        lineDash={[14, 12]}
        lineCap={'round'}
        end={sep2End}
        opacity={() => sep2On() * darkK()}
      />

      {/* DTO card — must pass ABOVE dashed lines (match reference splitDtoScene) */}
      <Rect
        ref={dtoCardRef}
        x={dtoCardX}
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
        opacity={() => dtoOn() * darkK()}
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
          opacity={() => dtoServiceEntityCardOn() * darkK()}
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
          opacity={() => dtoDbEntityCardOn() * darkK()}
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
  const rightPadY = leftPadY; // match top/bottom margin of the light cards on the left
  const rightHalfW = Screen.width / 2;
  const rightHalfCenterX = Screen.width / 4;
  const codeCardW = rightHalfW - rightPadX * 2;
  const codeCardX = rightHalfCenterX;
  const codeCardY = 0;

  // Accent line highlight (full width of light half).
  const accentLineOn = createSignal(0);

  // Match vertical margins with the left-side cards: same top + bottom padding from the frame.
  // This makes the right-side dark cards feel aligned with the left column.
  const codeCardH = Screen.height - rightPadY * 2;

  // Fit font size to the fixed card height (so code never clips when we make the card taller).
  const maxLineCount = Math.max(
    paymentsPersistenceCode.split('\n').length,
    paymentsServiceCode.split('\n').length,
    paymentsControllerCode.split('\n').length,
    paymentDtoCode.split('\n').length,
  );
  // Keep some headroom so Service/Controller feel realistic without reflow.
  const extraLines = 6;
  const targetLines = maxLineCount + extraLines;

  const fitCodeFontSize = (start: number, min: number) => {
    for (let fs = start; fs >= min; fs--) {
      const paddingY = getCodePaddingY(fs) * 2;
      const available = Math.floor((codeCardH - paddingY) / getLineHeight(fs));
      if (available >= targetLines) return fs;
    }
    return min;
  };

  const codeFontSize = fitCodeFontSize(20, 16);
  // Fixed height (aligned to left column margins).
  const repoCardH = codeCardH;

  const serviceSigLine = paymentsServiceCode.split('\n').findIndex(l => l.includes('public') && l.includes('PaymentDto'));
  const controllerSigLine = paymentsControllerCode.split('\n').findIndex(l => l.includes('public') && l.includes('PaymentDto'));

  const persistenceCodeCard = CodeBlock.fromCode(paymentsPersistenceCode, {
    x: codeCardX,
    y: codeCardY,
    width: codeCardW,
    height: repoCardH,
    fontSize: codeFontSize,
    fontFamily: Fonts.code,
    theme: LightBgCodeTheme,
    customTypes: ['PaymentsRepository', 'DSLContext', 'PaymentDto', 'UUID', 'BigDecimal'],
    cardStyle: transparentCardStyle,
  });
  persistenceCodeCard.mount(view);
  persistenceCodeCard.node.opacity(() => 1 * codeCardOn());

  // Accent line: full-width highlight on line 8 (PaymentDto return line).
  const lineH = getLineHeight(codeFontSize);
  const paddingY = getCodePaddingY(codeFontSize);
  const accentLineY = codeCardY - codeCardH / 2 + paddingY + 8 * lineH + lineH / 2;
  // Add highlight UNDER code (to rightLayer, before other code mounts).
  view.add(
    new Rect({
      x: rightHalfCenterX,
      y: accentLineY,
      width: rightHalfW,
      // Keep original strip geometry, just a bit denser (darker).
      height: lineH * 1.2,
      fill: 'rgba(255,140,163,0.24)',
      opacity: accentLineOn,
    }),
  );

  const serviceCodeCard = CodeBlock.fromCode(paymentsServiceCode, {
    x: codeCardX,
    y: codeCardY,
    width: codeCardW,
    height: repoCardH,
    fontSize: codeFontSize,
    fontFamily: Fonts.code,
    theme: LightBgCodeTheme,
    customTypes: ['PaymentsService', 'PaymentsRepository', 'PaymentDto', 'UUID'],
    cardStyle: transparentCardStyle,
  });
  serviceCodeCard.mount(view);
  serviceCodeCard.node.opacity(() => 1 * serviceCodeOn());

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
    theme: LightBgCodeTheme,
    customTypes: ['PaymentDto', 'UUID', 'BigDecimal', 'Instant'],
    cardStyle: transparentCardStyle,
  });
  dtoCodeCard.mount(view);
  dtoCodeCard.node.opacity(() => 1 * dtoCodeOn());

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
  // Slightly larger spacing between the three type blocks inside the dark DTO card.
  const dtoBelowStartY = (dtoLastLine?.node.y() ?? 0) + dtoLineH * 1.7;
  const dtoServiceFirstLineY = dtoBelowStartY;
  const serviceLines = dtoServiceEntityCode.split('\n').length;
  const dtoDbFirstLineY = dtoServiceFirstLineY + serviceLines * dtoLineH + dtoLineH * 0.55;

  const dtoServiceOffsetY = dtoServiceFirstLineY + dtoClipH / 2 - dtoLineH / 2;
  const dtoDbOffsetY = dtoDbFirstLineY + dtoClipH / 2 - dtoLineH / 2;

  const overlayCardStyle = transparentCardStyle;

  const dtoServiceEntityCodeCard = CodeBlock.fromCode(dtoServiceEntityCode, {
    x: codeCardX,
    y: codeCardY,
    width: codeCardW,
    height: repoCardH,
    fontSize: dtoFontSize,
    lineHeight: dtoLineH,
    contentOffsetY: dtoServiceOffsetY,
    fontFamily: Fonts.code,
    theme: LightBgCodeTheme,
    customTypes: ['Payment', 'UUID', 'BigDecimal', 'Instant'],
    cardStyle: overlayCardStyle,
  });
  dtoServiceEntityCodeCard.mount(view);
  dtoServiceEntityCodeCard.node.opacity(() => 1 * dtoCodeOn() * dtoServiceEntityCodeOn());

  const dtoDbEntityCodeCard = CodeBlock.fromCode(dtoDbEntityCode, {
    x: codeCardX,
    y: codeCardY,
    width: codeCardW,
    height: repoCardH,
    fontSize: dtoFontSize,
    lineHeight: dtoLineH,
    contentOffsetY: dtoDbOffsetY,
    fontFamily: Fonts.code,
    theme: LightBgCodeTheme,
    customTypes: ['PaymentEntity', 'UUID', 'BigDecimal', 'Instant'],
    cardStyle: overlayCardStyle,
  });
  dtoDbEntityCodeCard.mount(view);
  dtoDbEntityCodeCard.node.opacity(() => 1 * dtoCodeOn() * dtoDbEntityCodeOn());

  // Final accent: new fields appear inside PaymentEntity at the end (entity "grows").
  const entityLines = dtoDbEntityCode.split('\n');
  const entityFraudIndex = entityLines.findIndex(l => l.includes('fraudReason'));
  const entityStripeIndex = entityLines.findIndex(l => l.includes('stripeId'));
  const entityCloseIndex = entityLines.length - 1;

  const entityFraudLine = entityFraudIndex >= 0 ? dtoDbEntityCodeCard.getLine(entityFraudIndex) : null;
  const entityStripeLine = entityStripeIndex >= 0 ? dtoDbEntityCodeCard.getLine(entityStripeIndex) : null;
  const entityCloseLine = dtoDbEntityCodeCard.getLine(entityCloseIndex);

  const entityCloseOriginalY = entityCloseLine?.node.y() ?? 0;
  const entityFraudTargetY = entityFraudLine?.node.y() ?? 0;
  const entityStripeTargetY = entityStripeLine?.node.y() ?? 0;

  if (entityCloseLine && entityFraudLine && entityStripeLine) {
    const collapsedY = entityCloseOriginalY - 2 * dtoLineH;
    // Start "collapsed": new fields hidden; closing brace moved up by 2 lines.
    entityFraudLine.node.opacity(0);
    entityStripeLine.node.opacity(0);
    entityFraudLine.node.y(collapsedY);
    entityStripeLine.node.y(collapsedY);
    entityCloseLine.node.y(entityCloseOriginalY - 2 * dtoLineH);
  }

  const controllerCodeCard = CodeBlock.fromCode(paymentsControllerCode, {
    x: codeCardX,
    y: codeCardY,
    width: codeCardW,
    height: repoCardH,
    fontSize: codeFontSize,
    fontFamily: Fonts.code,
    theme: LightBgCodeTheme,
    customTypes: ['PaymentsController', 'PaymentsService', 'PaymentDto', 'UUID', 'GetMapping', 'PathVariable'],
    cardStyle: transparentCardStyle,
  });
  controllerCodeCard.mount(view);
  controllerCodeCard.node.opacity(() => 1 * controllerCodeOn());

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

  // IMPORTANT: Do not recolor PaymentDto in code (it becomes unreadable on the underlay strip).

  yield* darkReveal(1, Timing.slow * 1.35, easeInOutCubic);
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
  yield* waitFor(0.4);
  yield* all(
    codeCardOn(1, Timing.slow * 1.4, easeInOutCubic),
    disableOtherLayers(1, Timing.slow * 1.4, easeInOutCubic),
  );
  yield* waitFor(0.2);

  // Highlight animation (repo card only) + DTO card fade-in must start together.
  // No dimming — just accent line and recolor PaymentDto.
  const highlightDur = Timing.slow * 0.9;
  yield* all(
    dtoOn(1, Timing.slow * 1.05, easeInOutCubic),
    accentLineOn(1, highlightDur, easeInOutCubic),
  );

  // Before the DTO card starts moving, the repository (persistence) code card must fade out.
  yield* all(
    codeCardOn(0, Timing.slow * 0.65, easeInOutCubic),
    disableOtherLayers(0, Timing.slow * 0.65, easeInOutCubic),
    accentLineOn(0, Timing.slow * 0.65, easeInOutCubic),
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
    dtoCodeOn(1, Timing.slow * 1.3, easeInOutCubic),
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
  // Smooth outro: longer, softer return to the neutral frame style.
  const outlineOutDur = Timing.slow * 1.15;
  yield* all(
    dtoCardRef().stroke(cardStroke, outlineOutDur, easeInOutCubic),
    dbCardRef().stroke(cardStroke, outlineOutDur, easeInOutCubic),
    serviceCardRef().stroke(cardStroke, outlineOutDur, easeInOutCubic),
    apiCardRef().stroke(cardStroke, outlineOutDur, easeInOutCubic),
    dtoCardRef().lineWidth(1, outlineOutDur, easeInOutCubic),
    dbCardRef().lineWidth(1, outlineOutDur, easeInOutCubic),
    serviceCardRef().lineWidth(1, outlineOutDur, easeInOutCubic),
    apiCardRef().lineWidth(1, outlineOutDur, easeInOutCubic),
  );

  // After the highlight: leak lines appear and push the tail down (no blinking).
  if (dtoFraudLine && dtoStripeLine && dtoUpdatedLine && dtoTailLines.length > 0) {
    const dur = Timing.slow * 0.85;
    // Focus on DB layer while leak fields appear (disable other layer cards).
    yield* disableOtherLayers(1, Timing.slow * 0.75, easeInOutCubic);

    // 1) Reveal fraudReason and push tail down by 1 line
    yield* all(
      dtoFraudLine.node.opacity(1, dur, easeInOutCubic),
      dtoFraudLine.node.y(dtoFraudTargetY, dur, easeInOutCubic),
      ...dtoTailLines.map((l, i) => l!.node.y(dtoTailOriginalY[i] - 1 * dtoLineH, dur, easeInOutCubic)),
    );
    yield* waitFor(0.18);
    // 2) Reveal stripeId and push tail down by 1 more line
    yield* all(
      dtoStripeLine.node.opacity(1, dur, easeInOutCubic),
      dtoStripeLine.node.y(dtoStripeTargetY, dur, easeInOutCubic),
      ...dtoTailLines.map((l, i) => l!.node.y(dtoTailOriginalY[i], dur, easeInOutCubic)),
    );

    // Hold leak state for a few seconds, then revert smoothly and re-enable cards.
    yield* waitFor(2.4);
    const retractDur = Timing.slow * 0.85;
    const collapsedY = dtoUpdatedLine.node.y() - 2 * dtoLineH;

    // Retract stripeId and pull tail up by 1 line, while restoring layer emphasis.
    yield* all(
      disableOtherLayers(0, Timing.slow * 0.9, easeInOutCubic),
      dtoStripeLine.node.opacity(0, retractDur, easeInOutCubic),
      dtoStripeLine.node.y(collapsedY, retractDur, easeInOutCubic),
      ...dtoTailLines.map((l, i) => l!.node.y(dtoTailOriginalY[i] - 1 * dtoLineH, retractDur, easeInOutCubic)),
    );
    yield* waitFor(0.16);

    // Retract fraudReason and return the tail to the original "clean" position.
    yield* all(
      dtoFraudLine.node.opacity(0, retractDur, easeInOutCubic),
      dtoFraudLine.node.y(collapsedY, retractDur, easeInOutCubic),
      ...dtoTailLines.map((l, i) => l!.node.y(dtoTailOriginalY[i] - 2 * dtoLineH, retractDur, easeInOutCubic)),
    );

    // Entities appear under the DTO: smooth, one-by-one (no typing), synced with light cards.
    yield* waitFor(0.32);
    yield* all(
      dtoServiceEntityCodeOn(1, Timing.slow * 1.05, easeInOutCubic),
      dtoServiceEntityCardOn(1, Timing.slow * 1.05, easeInOutCubic),
    );
    yield* waitFor(0.22);
    yield* all(
      dtoDbEntityCodeOn(1, Timing.slow * 1.05, easeInOutCubic),
      dtoDbEntityCardOn(1, Timing.slow * 1.05, easeInOutCubic),
    );

    // End: reveal two extra fields in PaymentEntity (right dark code card).
    if (entityCloseLine && entityFraudLine && entityStripeLine) {
      yield* waitFor(0.55);
      const dur = Timing.slow * 0.7;
      // 1) Reveal fraudReason, push the closing brace down by 1 line.
      yield* all(
        entityFraudLine.node.opacity(1, dur, easeInOutCubic),
        entityFraudLine.node.y(entityFraudTargetY, dur, easeInOutCubic),
        entityCloseLine.node.y(entityCloseOriginalY - 1 * dtoLineH, dur, easeInOutCubic),
      );
      yield* waitFor(0.18);
      // 2) Reveal stripeId, push the closing brace down by 1 more line (back to original).
      yield* all(
        entityStripeLine.node.opacity(1, dur, easeInOutCubic),
        entityStripeLine.node.y(entityStripeTargetY, dur, easeInOutCubic),
        entityCloseLine.node.y(entityCloseOriginalY, dur, easeInOutCubic),
      );
    }
  }

  // Scene outro: fade everything out together, while dark half "pushes" the light half away.
  yield* waitFor(1.6);

  const componentsDur = Timing.slow * 0.65;
  const bgDur = Timing.slow * 0.95;
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
    disableOtherLayers(0, componentsDur, easeInOutCubic),

    // right half code overlays
    codeCardOn(0, componentsDur, easeInOutCubic),
    serviceCodeOn(0, componentsDur, easeInOutCubic),
    controllerCodeOn(0, componentsDur, easeInOutCubic),
    dtoCodeOn(0, componentsDur, easeInOutCubic),
    dtoServiceEntityCodeOn(0, componentsDur, easeInOutCubic),
    dtoDbEntityCodeOn(0, componentsDur, easeInOutCubic),

    // background: dark pushes light away (darkReveal goes to 2 = full screen dark)
    darkReveal(2, bgDur, easeInOutCubic),
  );

  yield* waitFor(0.25);
});


