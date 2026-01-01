import {Gradient, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Colors, Fonts, Screen, Timing} from '../core/theme';
import {PanelStyle} from '../core/panelStyle';

export default makeScene2D(function* (view) {
  const opacity = createSignal(0);

  const leftBg = new Gradient({
    type: 'linear',
    from: [0, -Screen.height / 2],
    to: [0, Screen.height / 2],
    stops: [
      {offset: 0, color: '#F7F5F2'},
      {offset: 1, color: '#EFEAE3'},
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

  const leftPadX = 56;
  const leftPadY = 56;
  const codePadX = 96;
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
  const cardRadius = 22;
  const cardFill = 'rgba(27,29,36,0.96)';
  const cardStroke = 'rgba(0,0,0,0.10)';
  const cardShadowColor = 'rgba(0,0,0,0.55)';
  const cardShadowBlur = PanelStyle.shadowBlur * 1.35;
  const cardShadowOffset = [PanelStyle.shadowOffset[0] * 1.15, PanelStyle.shadowOffset[1] * 1.15] as [number, number];

  const labelFill = Colors.text.primary;

  view.add(
    <>
      <Rect x={leftX} width={halfW} height={halfH} fill={leftBg} />
      <Rect x={rightX} width={halfW} height={halfH} fill={rightBg} />
      <Rect x={rightX} width={halfW} height={halfH} fill={spotlight} />
      <Rect x={0} width={1} height={halfH} fill={'rgba(0,0,0,0.10)'} />

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
            fontFamily={Fonts.primary}
            fontSize={30}
            fontWeight={650}
            letterSpacing={0.6}
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
            fontFamily={Fonts.primary}
            fontSize={30}
            fontWeight={650}
            letterSpacing={0.6}
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
            fontFamily={Fonts.primary}
            fontSize={30}
            fontWeight={650}
            letterSpacing={0.6}
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
        fontSize={64}
        fontWeight={600}
        lineHeight={92}
        fill={Colors.text.primary}
        offset={[-1, -1]}
        opacity={opacity}
      />
    </>,
  );

  yield* opacity(1, Timing.slow, easeInOutCubic);
  yield* waitFor(12);
});


