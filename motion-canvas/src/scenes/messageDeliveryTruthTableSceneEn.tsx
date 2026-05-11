import {Circle, Line, Node, Txt, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';
import {
  CODE,
  CODE_CARD_STYLE,
  CODE_FONT,
  CODE_LH,
  CODE_W,
  CODE_X,
  COLOR_RULES,
  CUSTOM_TYPES,
  DRYRUN_COLOR,
  FORCESEND_COLOR,
  ISRETRY_COLOR,
  LINE,
} from './messageDeliveryShared';

// ════════════════════════════════════════════════════════════════════════
// OPTION 1 — truth table.
//   Right column is a 3×2 decision matrix: rows = booleans, columns =
//   false / true. Each row has ONE highlighted cell — the case where
//   the flag's effect lives. Reads as a literal "what does the flag
//   choose between" map.
// ════════════════════════════════════════════════════════════════════════

const F_CODE  = Fonts.code;
const F_LABEL = Fonts.primary;

// Column anchors (left-aligned text starts here).
const COL_NAME_X  = 60;
const COL_FALSE_X = 280;
const COL_TRUE_X  = 520;
// Header row Y — sits a comfortable distance above the first data row.
const HEADER_Y    = -300;

const HEADER_FILL = 'rgba(244,241,235,0.45)';
const DIM_FILL    = 'rgba(244,241,235,0.55)';
const DOT_R       = 5;

type Row = {
  y: number;
  name: string;
  nameColor: string;
  falseText: string;
  trueText: string;
  // which cell carries the accent — the cell where the flag's behaviour lives
  highlight: 'false' | 'true';
  accent: string;
};

export default makeScene2D(function* (view) {
  applyBackground(view);

  const code = Manticore.create(CODE, {
    x: CODE_X,
    y: 0,
    width: CODE_W,
    fontSize: CODE_FONT,
    lineHeight: CODE_LH,
    fontFamily: F_CODE,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    customTypes: CUSTOM_TYPES,
  });
  code.mount(view);
  code.colorize(COLOR_RULES);

  // Rows anchored to the code zones — each row's Y matches the midline
  // of the body block that boolean controls. The eye traces left-to-
  // right from "this code" to "this entry in the table".
  const rows: Row[] = [
    {
      y: code.getLineSceneY(10),
      name: 'dryRun',
      nameColor: DRYRUN_COLOR,
      falseText: 'continue',
      trueText:  'Preview',
      highlight: 'true',
      accent: DRYRUN_COLOR,
    },
    {
      y: code.getLineSceneY(16),
      name: 'forceSend',
      nameColor: FORCESEND_COLOR,
      falseText: 'check rules',
      trueText:  'skip',
      highlight: 'false',          // forceSend's WORK lives in the false branch
      accent: FORCESEND_COLOR,
    },
    {
      y: code.getLineSceneY(22),
      name: 'isRetry',
      nameColor: ISRETRY_COLOR,
      falseText: 'create',
      trueText:  'nextRetry',
      highlight: 'true',
      accent: ISRETRY_COLOR,
    },
  ];

  const table = createRef<Node>();
  view.add(<Node ref={table} opacity={0} />);

  // ── header ──
  const header = (label: string, x: number) => (
    <Txt
      text={label}
      fontFamily={F_LABEL}
      fontSize={14}
      letterSpacing={4}
      fill={HEADER_FILL}
      x={x}
      y={HEADER_Y}
      textAlign={'left'}
    />
  );
  table().add(
    <>
      {header('FALSE', COL_FALSE_X)}
      {header('TRUE',  COL_TRUE_X)}
    </>,
  );

  // ── data rows ──
  const cell = (text: string, x: number, y: number, highlight: boolean, accent: string) => (
    <>
      {highlight && (
        <Circle
          x={x - 16}
          y={y}
          width={DOT_R * 2}
          height={DOT_R * 2}
          fill={accent}
        />
      )}
      <Txt
        text={text}
        fontFamily={F_CODE}
        fontSize={20}
        fill={highlight ? accent : DIM_FILL}
        x={x}
        y={y}
        textAlign={'left'}
      />
    </>
  );

  for (const row of rows) {
    table().add(
      <>
        <Txt
          text={row.name}
          fontFamily={F_CODE}
          fontSize={20}
          fill={row.nameColor}
          x={COL_NAME_X}
          y={row.y}
          textAlign={'left'}
        />
        {cell(row.falseText, COL_FALSE_X, row.y, row.highlight === 'false', row.accent)}
        {cell(row.trueText,  COL_TRUE_X,  row.y, row.highlight === 'true',  row.accent)}
      </>,
    );
  }

  // ── faint divider beneath the header for the "table" feel ──
  table().add(
    <Line
      points={[[COL_NAME_X - 12, HEADER_Y + 22], [COL_TRUE_X + 240, HEADER_Y + 22]]}
      stroke={'rgba(244,241,235,0.18)'}
      lineWidth={1}
    />,
  );

  yield* code.appear(0.7);
  yield* all(
    code.getLine(LINE.sigDryRun)!.setTokensGlow(['dryRun'],       10, DRYRUN_COLOR,    0.6),
    code.getLine(LINE.sigForceSend)!.setTokensGlow(['forceSend'], 10, FORCESEND_COLOR, 0.6),
    code.getLine(LINE.sigIsRetry)!.setTokensGlow(['isRetry'],     10, ISRETRY_COLOR,   0.6),
    table().opacity(1, 0.8, easeInOutCubic),
  );

  yield* waitFor(4.0);
});
