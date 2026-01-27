import {Circle, Line, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, createSignal, easeInOutCubic, linear, waitFor} from '@motion-canvas/core';
import {OpenStyle} from '../core/openStyle';
import {OpenText} from '../core/openText';
import {OpenShapes} from '../core/openShapes';
import {Timing} from '../core/theme';
import {SafeZone} from '../core/ScreenGrid';

const SERVICES = ['GATEWAY', 'AUTH', 'ORDERS', 'PAYMENT', 'NOTIFY'];

const MESSAGE_SEQUENCE = [
  {from: 0, to: 1, label: 'validate'},
  {from: 1, to: 2, label: 'create'},
  {from: 2, to: 3, label: 'charge'},
  {from: 3, to: 2, label: 'confirmed'},
  {from: 2, to: 4, label: 'notify'},
  {from: 2, to: 0, label: 'response'},
];

export default makeScene2D(function* (view) {
  const S = OpenStyle;

  view.fill(S.colors.bg);

  const serviceRadius = 130;
  const totalWidth = SafeZone.right - SafeZone.left;
  const gap = (totalWidth - SERVICES.length * serviceRadius * 2) / (SERVICES.length - 1);
  const startX = SafeZone.left + serviceRadius;
  const serviceY = 60;

  const wireStroke = 'rgba(21,21,21,0.55)';
  const portColor = S.colors.blue;
  const packetColor = S.colors.transport;
  const portSize = OpenShapes.dots.port;
  const packetSize = OpenShapes.dots.packet;

  const serviceOpacity = SERVICES.map(() => createSignal(0));
  const wireOpacity = createSignal(0);

  const getServiceX = (i: number) => startX + i * (serviceRadius * 2 + gap);

  const serviceRefs = SERVICES.map(() => createRef<Circle>());
  const leftPortRefs = SERVICES.map(() => createRef<Circle>());
  const rightPortRefs = SERVICES.map(() => createRef<Circle>());

  view.add(
    <>
      {SERVICES.map((name, i) => {
        const cx = getServiceX(i);
        const isFirst = i === 0;
        const isLast = i === SERVICES.length - 1;

        return (
          <>
            {!isFirst && (
              <Line
                points={[
                  [getServiceX(i - 1) + serviceRadius, serviceY],
                  [cx - serviceRadius, serviceY],
                ]}
                stroke={wireStroke}
                lineWidth={OpenShapes.stroke.connector}
                lineCap={'round'}
                opacity={() => wireOpacity() * Math.min(serviceOpacity[i - 1](), serviceOpacity[i]())}
              />
            )}

            <Circle
              ref={serviceRefs[i]}
              x={cx}
              y={serviceY}
              width={serviceRadius * 2}
              height={serviceRadius * 2}
              fill={S.colors.ink}
              opacity={serviceOpacity[i]}
            />

            <Txt
              x={cx}
              y={serviceY - 4}
              text={name}
              fontFamily={S.fonts.sans}
              fontSize={OpenText.service.fontSize}
              fontWeight={OpenText.service.fontWeight}
              letterSpacing={OpenText.service.letterSpacing}
              fill={S.colors.card}
              opacity={serviceOpacity[i]}
            />

            {!isFirst && (
              <Circle
                ref={leftPortRefs[i]}
                x={cx - serviceRadius}
                y={serviceY}
                width={portSize}
                height={portSize}
                fill={portColor}
                opacity={() => wireOpacity() * serviceOpacity[i]() * 0.78}
              />
            )}

            {!isLast && (
              <Circle
                ref={rightPortRefs[i]}
                x={cx + serviceRadius}
                y={serviceY}
                width={portSize}
                height={portSize}
                fill={portColor}
                opacity={() => wireOpacity() * serviceOpacity[i]() * 0.78}
              />
            )}
          </>
        );
      })}
    </>,
  );

  for (let i = 0; i < SERVICES.length; i++) {
    yield* serviceOpacity[i](1, Timing.slow, easeInOutCubic);
    if (i < SERVICES.length - 1) {
      yield* waitFor(0.18);
    }
  }

  yield* waitFor(0.3);
  yield* wireOpacity(1, Timing.normal, easeInOutCubic);
  yield* waitFor(0.5);

  for (const msg of MESSAGE_SEQUENCE) {
    const fromX = getServiceX(msg.from);
    const toX = getServiceX(msg.to);
    const direction = msg.to > msg.from ? 1 : -1;

    const startX = fromX + direction * serviceRadius;
    const endX = toX - direction * serviceRadius;

    const labelY = serviceY - OpenShapes.spacing.endpointY;

    const packetT = createSignal(0);
    const packetOpacity = createSignal(0);
    const labelOpacity = createSignal(0);

    const packetRef = createRef<Circle>();
    const labelRef = createRef<Txt>();

    view.add(
      <>
        <Txt
          ref={labelRef}
          x={(startX + endX) / 2}
          y={labelY}
          text={msg.label}
          fontFamily={S.fonts.mono}
          fontSize={OpenText.endpointPath.fontSize}
          fontWeight={OpenText.endpointPath.fontWeight}
          letterSpacing={OpenText.endpointPath.letterSpacing}
          fill={S.colors.blue}
          opacity={labelOpacity}
        />
        <Circle
          ref={packetRef}
          x={() => startX + (endX - startX) * packetT()}
          y={serviceY}
          width={packetSize}
          height={packetSize}
          fill={packetColor}
          opacity={packetOpacity}
        />
      </>,
    );

    yield* all(
      packetOpacity(1, Timing.fast, easeInOutCubic),
      labelOpacity(1, Timing.fast, easeInOutCubic),
    );

    yield* packetT(1, Timing.normal, linear);

    yield* all(
      packetOpacity(0, Timing.fast, easeInOutCubic),
      labelOpacity(0, Timing.fast, easeInOutCubic),
    );

    packetRef().remove();
    labelRef().remove();

    yield* waitFor(0.25);
  }

  yield* waitFor(1.0);

  yield* all(
    wireOpacity(0, Timing.slow, easeInOutCubic),
    ...serviceOpacity.map(sig => sig(0, Timing.slow, easeInOutCubic)),
  );

  yield* waitFor(0.3);
});
