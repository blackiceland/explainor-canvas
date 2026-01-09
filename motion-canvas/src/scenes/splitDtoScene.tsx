import {Gradient, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Colors, Fonts, Screen, Timing} from '../core/theme';
import {PanelStyle} from '../core/panelStyle';
import {OpenStyle} from '../core/openStyle';
import {OpenShapes} from '../core/openShapes';
import {OpenText} from '../core/openText';

export default makeScene2D(function* (view) {
  const opacity = createSignal(0);
  const S = OpenStyle;

  const leftBg = new Gradient({
    type: 'linear',
    from: [0, -Screen.height / 2],
    to: [0, Screen.height / 2],
    stops: [
      // keep left side in the same warm neutral as other light system scenes
      {offset: 0, color: S.colors.bg},
      {offset: 1, color: S.colors.bg},
    ],
  });

  const rightBg = new Gradient({
    type: 'linear',
    from: [0, -Screen.height / 2],
    to: [0, Screen.height / 2],
    stops: [
      {offset: 0, color: Colors.background.from},
      {offset: 1, color: Colors.background.to},
    ],
  });

  const spotlight = new Gradient({
    type: 'radial',
    from: [Screen.width * 0.12, -Screen.height * 0.12],
    to: [Screen.width * 0.12, -Screen.height * 0.12],
    fromRadius: 0,
    toRadius: Screen.width * 0.95,
    stops: [
      {offset: 0, color: 'rgba(246,231,212,0.045)'},
      {offset: 1, color: 'rgba(255,255,255,0)'},
    ],
  });

  const halfW = Screen.width / 2;
  const halfH = Screen.height;
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
      <Rect x={leftX} width={halfW} height={halfH} fill={leftBg} />
      <Rect x={rightX} width={halfW} height={halfH} fill={rightBg} />
      <Rect x={rightX} width={halfW} height={halfH} fill={spotlight} />
      <Rect x={0} width={1} height={halfH} fill={S.colors.border} />

      <Rect
        x={leftX}
        width={halfW}
        height={halfH}
        layout
        direction={'column'}
        alignItems={'start'}
        justifyContent={'space-between'}
        padding={[leftPadY, leftPadX]}
        opacity={opacity}
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
        opacity={opacity}
      />
    </>,
  );

  yield* opacity(1, Timing.slow, easeInOutCubic);
  yield* waitFor(12);
});


