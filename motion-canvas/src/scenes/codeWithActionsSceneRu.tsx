import {Line, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, easeOutCubic, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code/components/CodeBlock';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Fonts, Screen, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';

const PANEL_W       = Screen.width * 5 / 16;
const PANEL_X       = Screen.width / 2 - PANEL_W / 2;
const DIVIDER_X     = PANEL_X - PANEL_W / 2;

const CODE_RIGHT    = DIVIDER_X;
const CODE_W        = CODE_RIGHT - (-Screen.width / 2 + 40);
const LEFT_CENTER_X = -Screen.width / 2 + 40 + CODE_W / 2;

const FRAME_W            = 420;
const FRAME_H            = 236;
const FRAME_FILL_NEUTRAL = 'rgba(244, 241, 235, 0.10)';
const FRAME_STROKE_DONE  = 'rgba(244, 241, 235, 0.85)';
const SCANLINE_COLOR     = 'rgba(244, 241, 235, 0.06)';
const SCANLINE_COUNT     = 10;

const ITEM_GAP   = 98;
const Y_ENCODER  = -160;
const Y_FINALIZE = Y_ENCODER + FRAME_H + ITEM_GAP;

const CODE_CARD_STYLE = {
  radius: 24, fill: 'rgba(0,0,0,0)', stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0, shadowColor: 'rgba(0,0,0,0)', shadowBlur: 0,
  shadowOffsetX: 0, shadowOffsetY: 0, edge: false,
} as const;

const V0 = `public byte[] exportVideo(byte[] sourceFrames, String outputFormat) {
    validateInput(sourceFrames, outputFormat);
    byte[] encodedVideo = runEncoder(sourceFrames);

    return finalizeExport(encodedVideo, outputFormat);
}`;

const FRAME_STROKE = 'rgba(244, 241, 235, 0.50)';
const GUIDE_COLOR  = 'rgba(244, 241, 235, 0.15)';

const SOFT_GREEN   = 'rgba(168, 214, 178, 0.88)';
const VAR_LIGHT    = 'rgba(244, 241, 235, 0.96)';
const TYPE_CLEAN   = 'rgba(220, 215, 255, 0.80)';
const METHOD_COLOR = DryFiltersV3CodeTheme.method;

const COLOR_RULES = [
  {match: 'sourceFrames', color: VAR_LIGHT},
  {match: 'outputFormat', color: VAR_LIGHT},
  {match: 'encodedVideo', color: VAR_LIGHT},
  {match: 'preparedFrames', color: VAR_LIGHT},
  {match: 'normalized',   color: VAR_LIGHT},
  {match: 'exportVideo',  color: VAR_LIGHT},
  {match: 'String',       color: TYPE_CLEAN},
  {match: 'validateInput',    color: METHOD_COLOR},
  {match: 'runEncoder',       color: METHOD_COLOR},
  {match: 'finalizeExport',   color: METHOD_COLOR},
  {match: 'normalizeFrames',  color: METHOD_COLOR},
  {match: 'applyColorProfile', color: METHOD_COLOR},
  {match: /^"[^"]*"$/, color: SOFT_GREEN},
];


export default makeScene2D(function* (view) {
  applyBackground(view);

  const fontSize   = 26;
  const lineHeight = Math.round(fontSize * 1.62 * 10) / 10;
  const paddingY   = getCodePaddingY(fontSize);
  const topInset   = Math.max(8, paddingY - 8);

  // ── сигналы normalizeFrames ──────────────────────────────────────────────
  const Y_NORMALIZE  = Y_ENCODER;
  const skewX        = createSignal(6);
  const skewY        = createSignal(-3);
  const scaleXn      = createSignal(0.91);
  const scaleYn      = createSignal(1.07);
  const rotation     = createSignal(-2.8);
  const radius0      = createSignal(2);
  const strokeColor0 = createSignal(FRAME_STROKE);
  const frameOpNorm  = createSignal(0);
  const guidesOp     = createSignal(0);

  // ── сигналы фреймов ────────────────────────────────────────────────────
  const COLS = 8; const ROWS = 5;
  const labelOp         = createSignal(0);
  const frameOpEncoder  = createSignal(0);
  const frameOpFinalize = createSignal(0);
  const formatLabelOp   = createSignal(0);
  const blockOpacities  = Array.from({length: COLS * ROWS}, () => createSignal(0));

  const dividerOp = createSignal(0);
  view.add(
    <Line
      points={[[DIVIDER_X, -Screen.height / 2], [DIVIDER_X, Screen.height / 2]]}
      stroke={'rgba(244,241,235,0.08)'}
      lineWidth={1}
      opacity={dividerOp}
    />,
  );

  view.add(<>
    {/* normalizeFrames — snap guides */}
    <Line points={[[PANEL_X - FRAME_W*0.55, Y_NORMALIZE],[PANEL_X + FRAME_W*0.55, Y_NORMALIZE]]}
      stroke={GUIDE_COLOR} lineWidth={1} lineDash={[8,8]} opacity={guidesOp}/>
    <Line points={[[PANEL_X, Y_NORMALIZE - FRAME_H*0.7],[PANEL_X, Y_NORMALIZE + FRAME_H*0.7]]}
      stroke={GUIDE_COLOR} lineWidth={1} lineDash={[8,8]} opacity={guidesOp}/>

    {/* normalizeFrames — distorted frame */}
    <Rect
      x={PANEL_X} y={Y_NORMALIZE}
      width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_NEUTRAL} stroke={strokeColor0} lineWidth={2} radius={radius0}
      opacity={frameOpNorm}
      skewX={skewX} skewY={skewY}
      scaleX={scaleXn} scaleY={scaleYn}
      rotation={rotation}
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H/2 + ((i+1)/(SCANLINE_COUNT+1))*FRAME_H;
        return <Line points={[[-FRAME_W/2+10,y],[FRAME_W/2-10,y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
    </Rect>

    {/* section label */}
    <Txt
      x={PANEL_X}
      y={-Screen.height / 2 + 52}
      text={'VIDEO EXPORT'}
      fontFamily={Fonts.primary}
      fontSize={26}
      fill={'rgba(244,241,235,0.90)'}
      letterSpacing={6}
      fontWeight={700}
      opacity={labelOp}
    />

    {/* runEncoder */}
    <Rect x={PANEL_X} y={Y_ENCODER} width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_NEUTRAL} stroke={FRAME_STROKE_DONE} lineWidth={3} radius={6}
      opacity={frameOpEncoder} clip
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
        return <Line points={[[-FRAME_W/2+10, y],[FRAME_W/2-10, y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
      {Array.from({length: COLS * ROWS}, (_, idx) => {
        const col = idx % COLS; const row = Math.floor(idx / COLS);
        const bw = FRAME_W / COLS; const bh = FRAME_H / ROWS;
        const x = -FRAME_W/2 + col*bw + bw/2; const y = -FRAME_H/2 + row*bh + bh/2;
        return <Rect key={String(idx)} x={x} y={y} width={bw-2} height={bh-2} fill={'rgba(180,175,220,0.45)'} radius={2} opacity={blockOpacities[idx]}/>;
      })}
    </Rect>

    {/* finalizeExport — dashed border */}
    <Rect x={PANEL_X} y={Y_FINALIZE} width={FRAME_W+16} height={FRAME_H+16}
      fill={'rgba(0,0,0,0)'} stroke={'rgba(244,241,235,0.50)'} lineWidth={2}
      lineDash={[10,7]} radius={14} opacity={frameOpFinalize}
    />
    {/* finalizeExport — frame */}
    <Rect x={PANEL_X} y={Y_FINALIZE} width={FRAME_W} height={FRAME_H}
      fill={FRAME_FILL_NEUTRAL} stroke={FRAME_STROKE_DONE} lineWidth={3}
      radius={6} opacity={frameOpFinalize} clip
    >
      {Array.from({length: SCANLINE_COUNT}, (_, i) => {
        const y = -FRAME_H / 2 + ((i + 1) / (SCANLINE_COUNT + 1)) * FRAME_H;
        return <Line points={[[-FRAME_W/2+10, y],[FRAME_W/2-10, y]]} stroke={SCANLINE_COLOR} lineWidth={1}/>;
      })}
      {Array.from({length: COLS * ROWS}, (_, idx) => {
        const col = idx % COLS; const row = Math.floor(idx / COLS);
        const bw = FRAME_W / COLS; const bh = FRAME_H / ROWS;
        const x = -FRAME_W/2 + col*bw + bw/2; const y = -FRAME_H/2 + row*bh + bh/2;
        return <Rect key={String(idx)} x={x} y={y} width={bw-2} height={bh-2} fill={'rgba(180,175,220,0.45)'} radius={2}/>;
      })}
    </Rect>
    {/* .mp4 badge */}
    <Rect
      x={() => PANEL_X + FRAME_W/2 - 24} y={() => Y_FINALIZE - FRAME_H/2 + 36}
      width={96} height={40} fill={'rgba(30,28,40,0.90)'}
      stroke={'rgba(244,241,235,0.85)'} lineWidth={1.5} radius={6}
      offset={[1,0]} opacity={formatLabelOp}
    >
      <Txt x={0} y={0} text={'.mp4'} fontFamily={Fonts.code} fontSize={24} fill={'rgba(244,241,235,1.0)'}/>
    </Rect>
  </>);

  // ── один CodeBlock на всю сцену ────────────────────────────────────────
  const cb = CodeBlock.fromCode(V0, {
    x: LEFT_CENTER_X,
    y: 0,
    width: CODE_W,
    height: SafeZone.bottom - SafeZone.top - 36,
    fontSize,
    lineHeight,
    contentOffsetY: topInset,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    customTypes: ['String', 'RuntimeException', 'IllegalStateException', 'IllegalArgumentException'],
  });

  cb.mount(view);
  cb.colorize(COLOR_RULES);

  const FADE_IN = Timing.slow;

  // ── v0: появление ─────────────────────────────────────────────────────
  yield* dividerOp(1, FADE_IN, easeInOutCubic);
  yield* cb.appear(FADE_IN);
  yield* waitFor(0.5);

  yield* all(
    labelOp(1, FADE_IN, easeInOutCubic),
    frameOpEncoder(1, FADE_IN, easeInOutCubic),
  );
  yield* waitFor(0.3);

  const blockDelay = 0.01; const blockOp = 0.05;
  for (let idx = 0; idx < COLS * ROWS; idx++) {
    yield* blockOpacities[idx](1, blockOp, easeInOutCubic);
    if (idx < COLS * ROWS - 1) yield* waitFor(blockDelay);
  }
  yield* waitFor(0.5);

  yield* frameOpFinalize(1, FADE_IN, easeInOutCubic);
  yield* waitFor(0.4);
  yield* formatLabelOp(1, FADE_IN, easeInOutCubic);
  yield* waitFor(2);

  // ── v0 → v1: вставляем строку + метод ─────────────────────────────────

  // фреймы v0 плавно уходят
  yield* all(
    frameOpEncoder(0, FADE_IN, easeInOutCubic),
    frameOpFinalize(0, FADE_IN, easeInOutCubic),
    formatLabelOp(0, FADE_IN, easeInOutCubic),
  );
  for (const sig of blockOpacities) sig(0);
  yield* waitFor(0.4);

  // 1) normalizeFrames появляется справа — до нового кода
  yield* frameOpNorm(1, FADE_IN, easeInOutCubic);
  yield* waitFor(0.4);
  yield* guidesOp(1, 0.3, easeInOutCubic);
  yield* waitFor(0.2);
  yield* all(
    skewX(0, 0.9, easeOutCubic),
    skewY(0, 0.9, easeOutCubic),
    scaleXn(1, 0.9, easeOutCubic),
    scaleYn(1, 0.9, easeOutCubic),
    rotation(0, 0.9, easeOutCubic),
    radius0(10, 0.9, easeOutCubic),
    strokeColor0(FRAME_STROKE_DONE, 0.9, easeOutCubic),
  );
  yield* guidesOp(0, 0.4, easeInOutCubic);
  yield* waitFor(0.5);

  // 2) теперь печатаем новую строку вызова
  yield* cb.insertLinesAt(1, '    byte[] preparedFrames = prepareFrames(sourceFrames);', {
    extraColorRules: [{match: 'prepareFrames', color: METHOD_COLOR}],
  });
  yield* waitFor(0.3);

  // 3) меняем sourceFrames → preparedFrames в runEncoder
  yield* cb.replaceInLine(3, 'sourceFrames', 'preparedFrames');
  yield* waitFor(0.8);

  // 4) вставляем реализацию prepareFrames
  yield* cb.insertLinesAt(6, [
    '',
    'private byte[] prepareFrames(byte[] sourceFrames) {',
    '    byte[] normalized = normalizeFrames(sourceFrames);',
    '    return applyColorProfile(normalized, "REC709");',
    '}',
  ], {
    extraColorRules: [{match: 'prepareFrames', color: VAR_LIGHT}],
  });

  yield* waitFor(2);
});
