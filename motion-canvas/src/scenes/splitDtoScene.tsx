import {Gradient, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Colors, Fonts, Screen, Timing} from '../core/theme';
import {PanelStyle} from '../core/panelStyle';
import {OpenStyle} from '../core/openStyle';
import {OpenShapes} from '../core/openShapes';
import {OpenText} from '../core/openText';

export default makeScene2D(function* (view) {
  const leftReveal = createSignal(0);
  const leftContentOpacity = createSignal(0);
  const rightContentOpacity = createSignal(0);
  const S = OpenStyle;

  // Must match the final shade at the end of paymentInputsScene.
  const darkBg = '#0B0B0B';

  const halfW = Screen.width / 2;
  const halfH = Screen.height;
  const leftRevealW = () => halfW * leftReveal();
  const leftRevealX = () => -Screen.width / 2 + leftRevealW() / 2;
  const dividerX = () => -Screen.width / 2 + leftRevealW();

  const leftX = -Screen.width / 4;
  const rightX = Screen.width / 4;

  // align spacing to base rhythm (16/32/48)
  const leftPadX = 48;
  const leftPadY = 48;
  const codePadX = 72;
  const codePadY = 56;
  const dtoX = 0 + codePadX;
  const dtoY = -Screen.height / 2 + codePadY;

  const dtoCode = `record PaymentDto(
  String id,
  BigDecimal amount,
  String currency,
  String status,
  Instant updatedAt
) {}`;

  const cardW = halfW / 2 - leftPadX * 2;
  const cardH = 220;
  const cardRadius = OpenShapes.radius.card;
  // light system cards must match the OpenStyle material
  const cardFill = S.colors.card;
  const cardStroke = S.colors.border;
  const cardShadowColor = OpenShapes.shadow.color;
  const cardShadowBlur = OpenShapes.shadow.blur;
  const cardShadowOffset = OpenShapes.shadow.offset;

  const labelFill = S.colors.ink;

  view.add(
    <>
      <Rect width={Screen.width} height={halfH} fill={darkBg} />
      {/* Light half reveal (overlay on top of the dark background) */}
      <Rect
        x={leftRevealX}
        width={leftRevealW}
        height={halfH}
        fill={S.colors.bg}
        opacity={leftReveal}
      />
      <Rect x={dividerX} width={1} height={halfH} fill={S.colors.border} opacity={leftReveal} />

      <Rect
        x={leftX}
        width={halfW}
        height={halfH}
        layout
        direction={'column'}
        alignItems={'start'}
        justifyContent={'space-between'}
        padding={[leftPadY, leftPadX]}
        opacity={leftContentOpacity}
      >
        <Rect
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
        >
          <Txt
            text={'CLIENT'}
            fontFamily={S.fonts.sans}
            fontSize={OpenText.service.fontSize}
            fontWeight={OpenText.service.fontWeight}
            letterSpacing={OpenText.service.letterSpacing}
            fill={labelFill}
            textAlign={'center'}
          />
        </Rect>

        <Rect
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
        >
          <Txt
            text={'PAYMENT-SERVICE'}
            fontFamily={S.fonts.sans}
            fontSize={OpenText.serviceMid.fontSize}
            fontWeight={OpenText.serviceMid.fontWeight}
            letterSpacing={OpenText.serviceMid.letterSpacing}
            fill={labelFill}
            textAlign={'center'}
          />
        </Rect>

        <Rect
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
        >
          <Txt
            text={'STRIPE'}
            fontFamily={S.fonts.sans}
            fontSize={OpenText.service.fontSize}
            fontWeight={OpenText.service.fontWeight}
            letterSpacing={OpenText.service.letterSpacing}
            fill={labelFill}
            textAlign={'center'}
          />
        </Rect>
      </Rect>

      <Txt
        x={dtoX}
        y={dtoY}
        width={halfW - codePadX * 2}
        text={dtoCode}
        fontFamily={Fonts.code}
        // keep code large enough for readability, but consistent with other code scenes
        fontSize={44}
        fontWeight={600}
        lineHeight={64}
        fill={Colors.text.primary}
        offset={[-1, -1]}
        opacity={rightContentOpacity}
      />
    </>,
  );

  // Transition:
  // 1) Start on the same dark background as previous scene.
  // 2) Reveal the light half.
  // 3) Show right-side content first, then left-side.
  yield* leftReveal(1, Timing.slow * 1.35, easeInOutCubic);
  yield* waitFor(0.15);
  yield* rightContentOpacity(1, Timing.slow, easeInOutCubic);
  yield* waitFor(0.25);
  yield* leftContentOpacity(1, Timing.slow, easeInOutCubic);
  yield* waitFor(10);
});


