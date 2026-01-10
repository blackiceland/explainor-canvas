import {makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Colors, Screen, Timing} from '../core/theme';
import {OpenStyle} from '../core/openStyle';
import {OpenShapes} from '../core/openShapes';
import {OpenText} from '../core/openText';
import {CodeBlockText} from '../core/components/CodeBlockText';

export default makeScene2D(function* (view) {
  const leftReveal = createSignal(0);
  const rightContentOpacity = createSignal(0);
  const S = OpenStyle;

  const darkBg = '#0B0B0B';

  const halfW = Screen.width / 2;
  const halfH = Screen.height;
  const leftRevealW = () => halfW * leftReveal();
  const leftRevealX = () => -Screen.width / 2 + leftRevealW() / 2;
  const dividerX = () => -Screen.width / 2 + leftRevealW();

  const leftPadX = 48;
  const leftPadY = 48;
  const codePadX = 72;
  const codePadY = 56;
  const codeX = 0 + codePadX;
  const codeY = -Screen.height / 2 + codePadY;

  const dbCode = `PaymentDto dto = jdbc.queryOne("""
  SELECT id, amount, currency, status, updated_at
  FROM payments
  WHERE id = ?
""", id);

return dto;`;

  const serviceCode = `PaymentDto dto = repo.load(id);
dto.status = "PAID";
repo.save(dto);

return dto;`;

  const apiCode = `@Get("/payments/{id}")
PaymentDto get(String id) {
  return service.get(id);
}`;

  const codeText = createSignal(dbCode);

  const cardW = halfW / 2 - leftPadX * 2;
  const cardH = 220;
  const cardRadius = OpenShapes.radius.card;
  const cardFill = S.colors.card;
  const cardStroke = S.colors.border;
  const cardShadowColor = OpenShapes.shadow.color;
  const cardShadowBlur = OpenShapes.shadow.blur;
  const cardShadowOffset = OpenShapes.shadow.offset;

  const labelFill = S.colors.ink;
  const dtoBlue = S.colors.blue;

  const slotTopY = -Screen.height / 2 + leftPadY + cardH / 2;
  const slotMidY = 0;
  const slotBotY = Screen.height / 2 - leftPadY - cardH / 2;

  const layerX = -Screen.width / 2 + leftPadX + cardW / 2;
  const dtoGap = 40;
  const dtoCardW = cardW;
  const dtoCardH = cardH;
  const dtoX = layerX + cardW / 2 + dtoGap + dtoCardW / 2;

  const dbOn = createSignal(0);
  const serviceOn = createSignal(0);
  const apiOn = createSignal(0);

  const dtoOn = createSignal(0);
  const dtoY = createSignal(slotBotY);

  const layerInDy = 56;
  const layerY = (slotY: number, on: () => number) => slotY + (1 - on()) * layerInDy;

  view.add(
    <>
      <Rect width={Screen.width} height={halfH} fill={darkBg} />
      <Rect
        x={leftRevealX}
        width={leftRevealW}
        height={halfH}
        fill={S.colors.bg}
        opacity={leftReveal}
      />
      <Rect x={dividerX} width={1} height={halfH} fill={S.colors.border} opacity={leftReveal} />

      <Rect
        x={layerX}
        y={() => layerY(slotBotY, dbOn)}
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
        opacity={dbOn}
      >
        <Txt
          text={'PERSISTENCE\n/ DB LAYER'}
          fontFamily={S.fonts.sans}
          fontSize={46}
          fontWeight={OpenText.service.fontWeight}
          letterSpacing={OpenText.service.letterSpacing}
          fill={labelFill}
          textAlign={'center'}
          lineHeight={52}
        />
      </Rect>

      <Rect
        x={layerX}
        y={() => layerY(slotMidY, serviceOn)}
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
        opacity={serviceOn}
      >
        <Txt
          text={'SERVICE\n/ DOMAIN LAYER'}
          fontFamily={S.fonts.sans}
          fontSize={46}
          fontWeight={OpenText.service.fontWeight}
          letterSpacing={OpenText.service.letterSpacing}
          fill={labelFill}
          textAlign={'center'}
          lineHeight={52}
        />
      </Rect>

      <Rect
        x={layerX}
        y={() => layerY(slotTopY, apiOn)}
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
        opacity={apiOn}
      >
        <Txt
          text={'API LAYER\n/ TRANSPORT'}
          fontFamily={S.fonts.sans}
          fontSize={46}
          fontWeight={OpenText.service.fontWeight}
          letterSpacing={OpenText.service.letterSpacing}
          fill={labelFill}
          textAlign={'center'}
          lineHeight={52}
        />
      </Rect>

      <Rect
        x={dtoX}
        y={dtoY}
        width={dtoCardW}
        height={dtoCardH}
        radius={cardRadius}
        fill={cardFill}
        stroke={cardStroke}
        lineWidth={1}
        shadowColor={cardShadowColor}
        shadowBlur={cardShadowBlur}
        shadowOffset={cardShadowOffset}
        clip
        opacity={dtoOn}
      />
      <Txt
        x={() => dtoX - dtoCardW / 2 + 28}
        y={() => dtoY() - dtoCardH / 2 + 32}
        text={'PaymentDto'}
        fontFamily={S.fonts.mono}
        fontSize={44}
        fontWeight={700}
        lineHeight={56}
        fill={dtoBlue}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={dtoOn}
      />
      <Txt
        x={() => dtoX - dtoCardW / 2 + 28}
        y={() => dtoY() - dtoCardH / 2 + 92}
        text={`id\namount\ncurrency\nstatus\nupdatedAt`}
        fontFamily={S.fonts.mono}
        fontSize={40}
        fontWeight={650}
        lineHeight={52}
        fill={labelFill}
        textAlign={'left'}
        offset={[-1, -1]}
        opacity={dtoOn}
      />

      <CodeBlockText
        x={codeX}
        y={codeY}
        style={{fontSize: 44, lineHeight: 64, width: halfW - codePadX * 2, fontWeight: 600}}
        text={codeText}
        fill={Colors.text.primary}
        opacity={rightContentOpacity}
        ellipsis
        ellipsisText={'...'}
        maxWidthPx={halfW - codePadX * 2}
      />
    </>,
  );

  yield* leftReveal(1, Timing.slow * 1.35, easeInOutCubic);
  yield* waitFor(0.2);

  codeText(dbCode);
  yield* all(
    rightContentOpacity(1, Timing.slow, easeInOutCubic),
    dbOn(1, Timing.slow, easeInOutCubic),
  );
  yield* waitFor(0.25);

  dtoY(slotBotY);
  yield* dtoOn(1, Timing.slow, easeInOutCubic);
  yield* waitFor(0.3);

  yield* dtoY(slotMidY, Timing.slow * 1.05, easeInOutCubic);
  yield* serviceOn(1, Timing.slow, easeInOutCubic);
  yield* waitFor(0.2);

  yield* rightContentOpacity(0, Timing.normal * 0.55, easeInOutCubic);
  codeText(serviceCode);
  yield* rightContentOpacity(1, Timing.normal * 0.55, easeInOutCubic);
  yield* waitFor(0.35);

  yield* dtoY(slotTopY, Timing.slow * 1.05, easeInOutCubic);
  yield* apiOn(1, Timing.slow, easeInOutCubic);
  yield* waitFor(0.2);

  yield* rightContentOpacity(0, Timing.normal * 0.55, easeInOutCubic);
  codeText(apiCode);
  yield* rightContentOpacity(1, Timing.normal * 0.55, easeInOutCubic);
  yield* waitFor(10);
});


