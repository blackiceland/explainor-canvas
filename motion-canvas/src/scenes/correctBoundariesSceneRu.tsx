import {makeScene2D, Line, Node, Rect, Txt} from '@motion-canvas/2d';
import {all, createRef, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {getCodePaddingY, getCodePaddingX, measureChar} from '../core/code/shared/TextMeasure';
import {SafeZone} from '../core/ScreenGrid';
import {Colors, Fonts, Timing} from '../core/theme';
import {applyBackground} from '../core/utils';
import {JavaClass, method, param} from '../core/code/model/JavaModel';
import {
  CODE_CARD_STYLE, CODE_W, LEFT_CENTER_X,
  COLOR_RULES,
} from './codeWithActionsSceneRu.config';

// ── Tree ────────────────────────────────────────────────────────────────────────
const TREE_CX    = 460;
const BOX_W      = 200;
const BOX_H      = 52;
const BOX_R      = 12;
const LINE_COLOR = 'rgba(244, 241, 235, 0.22)';
const LABEL_SIZE = 18;
const CODE_FG    = 'rgba(244, 241, 235, 0.90)';
const BOX_STROKE = 'rgba(244, 241, 235, 0.25)';

const FILLS = {
  ev:  'rgba(160, 190, 255, 0.16)',
  pf:  'rgba(160, 225, 200, 0.16)',
  ewr: 'rgba(255, 200, 160, 0.16)',
  enc: 'rgba(255, 220, 180, 0.16)',
  fe:  'rgba(200, 185, 255, 0.16)',
  pkg: 'rgba(185, 200, 255, 0.16)',
  am:  'rgba(255, 180, 200, 0.16)',
} as const;

const H2 = BOX_H / 2;

// Bad-state positions (chain)
const B = {
  ev:  {x: TREE_CX,       y: -290},
  pf:  {x: TREE_CX - 120, y: -170},
  ewr: {x: TREE_CX + 120, y: -170},
  enc: {x: TREE_CX + 120, y: -50},
  fe:  {x: TREE_CX + 120, y: 70},
  pkg: {x: TREE_CX + 120, y: 190},
  am:  {x: TREE_CX + 120, y: 310},
};
const B_SPLIT = (B.ev.y + B.pf.y) / 2;

// Mid-state (upper fan-out, lower chain)
const M = {
  ev:  {x: TREE_CX,       y: -260},
  pf:  {x: TREE_CX - 230, y: -110},
  ewr: {x: TREE_CX,       y: -110},
  fe:  {x: TREE_CX + 230, y: -110},
  pkg: {x: TREE_CX + 230, y: 40},
  am:  {x: TREE_CX + 230, y: 190},
};
const M_SPLIT = (M.ev.y + M.pf.y) / 2;

// Good-state (two fan-outs)
const G = {
  pkg: {x: TREE_CX + 230 - 130, y: 50},
  am:  {x: TREE_CX + 230 + 130, y: 50},
};
const G_FE_SPLIT = (M.fe.y + G.pkg.y) / 2;

// 4-point connector helper (degenerate split-Y for straight lines)
const conn4 = (
  x1: number, y1bot: number,
  x2: number, y2top: number,
): [number, number][] => {
  const mid = (y1bot + y2top) / 2;
  return [[x1, y1bot], [x1, mid], [x2, mid], [x2, y2top]];
};

export default makeScene2D(function* (view) {
  applyBackground(view);

  // ── Цитата Парнаса ────────────────────────────────────────────────────────────
  const quoteContainer = new Node({opacity: 0, y: -20});
  view.add(quoteContainer);
  quoteContainer.add(
    <Txt fontFamily={Fonts.primary} fontSize={44} fontWeight={300}
      fill={Colors.text.primary} textAlign="center" y={-40}>
      Each module is then designed to
    </Txt>,
  );
  quoteContainer.add(
    <Txt fontFamily={Fonts.primary} fontSize={44} fontWeight={300}
      fill={Colors.text.primary} textAlign="center" y={20}>
      <Txt fill={Colors.accent} fontWeight={600}>hide such a decision</Txt>
      {' '}from the others.
    </Txt>,
  );
  quoteContainer.add(
    <Txt fontFamily={Fonts.primary} fontSize={24} fill={Colors.text.muted}
      opacity={0.7} fontStyle="italic" textAlign="center" y={100}>
      — David Parnas, On the Criteria To Be Used in Decomposing Systems into Modules
    </Txt>,
  );

  yield* quoteContainer.opacity(1, Timing.slow, easeInOutCubic);
  yield* waitFor(2.5);
  yield* quoteContainer.opacity(0, Timing.slow, easeInOutCubic);
  yield* waitFor(0.5);

  // ── Модель кода (CODE_V4 — плохое состояние) ─────────────────────────────────
  const fontSize   = 16;
  const lineHeight = Math.round(fontSize * 1.62 * 10) / 10;
  const topInset   = Math.max(8, getCodePaddingY(fontSize) - 8);
  const maxChars   = Math.floor((CODE_W - getCodePaddingX(fontSize)) / measureChar(fontSize));

  const customTypes = [
    'String', 'RuntimeException', 'IllegalStateException', 'IllegalArgumentException',
    'Container', 'Muxer', 'Metadata', 'MetadataWriter', 'ContentSigner', 'Instant',
  ];

  const model = JavaClass.create([
    method('public', 'byte[]', 'exportVideo', [
      param('byte[]', 'sourceFrames'), param('String', 'outputFormat'),
      param('String', 'colorProfile'), param('String', 'subtitleTrack'),
      param('String', 'watermarkMode'), param('String', 'audioProfile'),
    ], [
      'validateInput(sourceFrames, outputFormat);',
      'byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack, watermarkMode, audioProfile);',
      '',
      'return encodeWithRetry(preparedFrames, outputFormat, watermarkMode, audioProfile);',
    ]),

    method('private', 'byte[]', 'prepareFrames', [
      param('byte[]', 'sourceFrames'), param('String', 'colorProfile'),
      param('String', 'subtitleTrack'), param('String', 'watermarkMode'),
      param('String', 'audioProfile'),
    ], [
      'byte[] normalizedFrames = normalizeFrames(sourceFrames);',
      'byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);',
      'byte[] subtitledFrames = overlaySubtitles(coloredFrames, subtitleTrack);',
      'byte[] watermarkedFrames = applyWatermark(subtitledFrames, watermarkMode);',
      '',
      'return normalizeAudio(watermarkedFrames, audioProfile);',
    ]),

    method('private', 'byte[]', 'encodeWithRetry', [
      param('byte[]', 'preparedFrames'), param('String', 'outputFormat'),
      param('String', 'watermarkMode'), param('String', 'audioProfile'),
    ], [
      'int attemptsLeft = this.maxAttempts;',
      '',
      'while (attemptsLeft-- > 0) {',
      '    try {',
      '        return encode(preparedFrames, outputFormat, watermarkMode, audioProfile);',
      '    } catch (RuntimeException ex) { /* retry */ }',
      '}',
      '',
      'throw new IllegalStateException("Encoding failed");',
    ]),

    method('private', 'byte[]', 'encode', [
      param('byte[]', 'preparedFrames'), param('String', 'outputFormat'),
      param('String', 'watermarkMode'), param('String', 'audioProfile'),
    ], [
      'byte[] encodedVideo = runEncoder(preparedFrames);',
      '',
      'return finalizeExport(encodedVideo, outputFormat, watermarkMode, audioProfile);',
    ]),

    method('private', 'byte[]', 'finalizeExport', [
      param('byte[]', 'encodedVideo'), param('String', 'outputFormat'),
      param('String', 'watermarkMode'), param('String', 'audioProfile'),
    ], [
      'if (!isSupportedFormat(outputFormat)) {',
      '    throw new IllegalArgumentException("Unsupported: " + outputFormat);',
      '}',
      '',
      'Container container = Muxer.mux(encodedVideo, outputFormat);',
      'container.applyWatermark(watermarkMode);',
      'container.normalizeAudio(audioProfile);',
      '',
      'return packageOutput(container, outputFormat, watermarkMode, audioProfile);',
    ]),

    method('private', 'byte[]', 'packageOutput', [
      param('Container', 'container'), param('String', 'outputFormat'),
      param('String', 'watermarkMode'), param('String', 'audioProfile'),
    ], [
      'byte[] serializedContainer = container.toByteArray();',
      'byte[] signedPayload = signContent(serializedContainer, outputFormat);',
      'byte[] budgetedPayload = enforceSizeBudget(signedPayload, outputFormat);',
      '',
      'return attachMetadata(budgetedPayload, outputFormat, watermarkMode, audioProfile);',
    ]),

    method('private', 'byte[]', 'signContent', [
      param('byte[]', 'exportPayload'), param('String', 'outputFormat'),
    ], [
      'String signingAlgorithm = resolveSigningAlgorithm(outputFormat);',
      '',
      'return ContentSigner.sign(exportPayload, signingAlgorithm);',
    ]),

    method('private', 'byte[]', 'enforceSizeBudget', [
      param('byte[]', 'signedPayload'), param('String', 'outputFormat'),
    ], [
      'int maxPayloadSize = resolveMaxPayloadSize(outputFormat);',
      'if (signedPayload.length <= maxPayloadSize) {',
      '    return signedPayload;',
      '}',
      '',
      'throw new IllegalStateException("Payload exceeds size budget: " + outputFormat);',
    ]),

    method('private', 'byte[]', 'attachMetadata', [
      param('byte[]', 'packagedPayload'), param('String', 'outputFormat'),
      param('String', 'watermarkMode'), param('String', 'audioProfile'),
    ], [
      'Metadata exportMetadata = Metadata.builder()',
      '    .format(outputFormat)',
      '    .watermark(watermarkMode)',
      '    .audio(audioProfile)',
      '    .timestamp(Instant.now())',
      '    .build();',
      '',
      'return MetadataWriter.write(packagedPayload, exportMetadata);',
    ]),
  ], maxChars);

  // ── Manticore ─────────────────────────────────────────────────────────────────
  const cb = Manticore.create(model.render(), {
    x: LEFT_CENTER_X - 50, y: -50,
    width: CODE_W,
    height: SafeZone.bottom - SafeZone.top - 36,
    fontSize, lineHeight, contentOffsetY: topInset,
    fontFamily: Fonts.code,
    theme: DryFiltersV3CodeTheme,
    cardStyle: CODE_CARD_STYLE,
    glowAccent: false,
    customTypes,
  });
  cb.mount(view);
  cb.node.opacity(0);
  cb.colorize(COLOR_RULES);

  // ── Схема (bad state) ─────────────────────────────────────────────────────────
  const treeWrap = new Node({});
  view.add(treeWrap);

  const connEvPf   = createRef<Line>();
  const connEvEwr  = createRef<Line>();
  const connEwrEnc = createRef<Line>();
  const connEncFe  = createRef<Line>();
  const connFePkg  = createRef<Line>();
  const connPkgAm  = createRef<Line>();
  const connEvFe   = createRef<Line>();
  const connFeAm   = createRef<Line>();

  const addConn = (ref: ReturnType<typeof createRef<Line>>, pts: [number, number][]) =>
    treeWrap.add(
      <Line ref={ref} points={pts}
        stroke={LINE_COLOR} lineWidth={2} radius={10} opacity={0} />,
    );

  addConn(connEvPf,   conn4(B.ev.x, B.ev.y + H2, B.pf.x, B.pf.y - H2));
  addConn(connEvEwr,  conn4(B.ev.x, B.ev.y + H2, B.ewr.x, B.ewr.y - H2));
  addConn(connEwrEnc, conn4(B.ewr.x, B.ewr.y + H2, B.enc.x, B.enc.y - H2));
  addConn(connEncFe,  conn4(B.enc.x, B.enc.y + H2, B.fe.x, B.fe.y - H2));
  addConn(connFePkg,  conn4(B.fe.x, B.fe.y + H2, B.pkg.x, B.pkg.y - H2));
  addConn(connPkgAm,  conn4(B.pkg.x, B.pkg.y + H2, B.am.x, B.am.y - H2));
  // Pre-created for later
  addConn(connEvFe,   conn4(M.ev.x, M.ev.y + H2, M.fe.x, M.fe.y - H2));
  addConn(connFeAm,   conn4(M.fe.x, M.fe.y + H2, G.am.x, G.am.y - H2));

  const bEv  = createRef<Rect>();
  const bPf  = createRef<Rect>();
  const bEwr = createRef<Rect>();
  const bEnc = createRef<Rect>();
  const bFe  = createRef<Rect>();
  const bPkg = createRef<Rect>();
  const bAm  = createRef<Rect>();

  const addBox = (
    ref: ReturnType<typeof createRef<Rect>>,
    x: number, y: number, label: string, fill: string,
  ) =>
    treeWrap.add(
      <Rect ref={ref} x={x} y={y} width={BOX_W} height={BOX_H}
        fill={fill} stroke={BOX_STROKE} lineWidth={1.5} radius={BOX_R} opacity={0}>
        <Txt fontFamily={Fonts.code} fontSize={LABEL_SIZE} fill={CODE_FG} textAlign="center">
          {label}
        </Txt>
      </Rect>,
    );

  addBox(bEv,  B.ev.x,  B.ev.y,  'exportVideo',     FILLS.ev);
  addBox(bPf,  B.pf.x,  B.pf.y,  'prepareFrames',   FILLS.pf);
  addBox(bEwr, B.ewr.x, B.ewr.y, 'encodeWithRetry', FILLS.ewr);
  addBox(bEnc, B.enc.x, B.enc.y, 'encode',           FILLS.enc);
  addBox(bFe,  B.fe.x,  B.fe.y,  'finalizeExport',  FILLS.fe);
  addBox(bPkg, B.pkg.x, B.pkg.y, 'packageOutput',   FILLS.pkg);
  addBox(bAm,  B.am.x,  B.am.y,  'attachMetadata',  FILLS.am);

  // ── Появление: код + скролл + раскрытие схемы ────────────────────────────────
  yield* cb.appear(Timing.slow);
  yield* all(
    cb.scrollTo('private byte[] attachMetadata', 5.0),
    (function* () {
      yield* bEv().opacity(1, 0.3, easeInOutCubic);
      yield* waitFor(0.4);
      yield* all(bPf().opacity(1, 0.3, easeInOutCubic), connEvPf().opacity(1, 0.3, easeInOutCubic));
      yield* waitFor(0.4);
      yield* all(bEwr().opacity(1, 0.3, easeInOutCubic), connEvEwr().opacity(1, 0.3, easeInOutCubic));
      yield* waitFor(0.4);
      yield* all(bEnc().opacity(1, 0.3, easeInOutCubic), connEwrEnc().opacity(1, 0.3, easeInOutCubic));
      yield* waitFor(0.4);
      yield* all(bFe().opacity(1, 0.3, easeInOutCubic), connEncFe().opacity(1, 0.3, easeInOutCubic));
      yield* waitFor(0.4);
      yield* all(bPkg().opacity(1, 0.3, easeInOutCubic), connFePkg().opacity(1, 0.3, easeInOutCubic));
      yield* waitFor(0.4);
      yield* all(bAm().opacity(1, 0.3, easeInOutCubic), connPkgAm().opacity(1, 0.3, easeInOutCubic));
    })(),
  );
  yield* waitFor(1.5);

  // ── Шаг 1: неправильная ответственность — prepareFrames ──────────────────────
  yield* cb.scrollTo('private byte[] prepareFrames', 1.0);
  yield* waitFor(1.5);

  model.getMethod('prepareFrames').params = [
    param('byte[]', 'sourceFrames'), param('String', 'colorProfile'),
    param('String', 'subtitleTrack'),
  ];
  model.setBody('prepareFrames', [
    'byte[] normalizedFrames = normalizeFrames(sourceFrames);',
    'byte[] coloredFrames = applyColorProfile(normalizedFrames, colorProfile);',
    '',
    'return overlaySubtitles(coloredFrames, subtitleTrack);',
  ]);
  model.updateCallArgs('exportVideo', 'prepareFrames',
    ['sourceFrames', 'colorProfile', 'subtitleTrack']);

  yield* cb.morphTo(model.render(), {
    removeDuration: 0.3, moveDuration: 0.5, addStyle: 'fade', scrollStrategy: 'auto',
  });
  yield* waitFor(1.0);

  // ── Шаг 2: пустая прослойка — encode + encodeWithRetry ───────────────────────
  yield* cb.scrollTo('private byte[] encodeWithRetry', 1.0);
  yield* waitFor(1.5);

  // Удаляем encode, упрощаем encodeWithRetry
  (model as any).methods = (model as any).methods.filter((m: any) => m.name !== 'encode');
  model.getMethod('encodeWithRetry').params = [param('byte[]', 'preparedFrames')];
  model.setBody('encodeWithRetry', [
    'int attemptsLeft = this.maxAttempts;',
    '',
    'while (attemptsLeft-- > 0) {',
    '    try {',
    '        return runEncoder(preparedFrames);',
    '    } catch (RuntimeException ex) { /* retry */ }',
    '}',
    '',
    'throw new IllegalStateException("Encoding failed");',
  ]);
  model.setBody('exportVideo', [
    'validateInput(sourceFrames, outputFormat);',
    'byte[] preparedFrames = prepareFrames(sourceFrames, colorProfile, subtitleTrack);',
    'byte[] encodedVideo = encodeWithRetry(preparedFrames);',
    '',
    'return finalizeExport(encodedVideo, outputFormat, watermarkMode, audioProfile);',
  ]);

  yield* cb.morphTo(model.render(), {
    removeDuration: 0.3, moveDuration: 0.5, addStyle: 'fade', scrollStrategy: 'auto',
  });
  yield* waitFor(0.8);

  // Схема: encode исчезает, верхняя часть → fan-out
  const DUR = 0.8;
  yield* all(
    bEnc().opacity(0, 0.4, easeInOutCubic),
    connEwrEnc().opacity(0, 0.3, easeInOutCubic),
    connEncFe().opacity(0, 0.3, easeInOutCubic),
    bEv().position([M.ev.x, M.ev.y], DUR, easeInOutCubic),
    bPf().position([M.pf.x, M.pf.y], DUR, easeInOutCubic),
    bEwr().position([M.ewr.x, M.ewr.y], DUR, easeInOutCubic),
    bFe().position([M.fe.x, M.fe.y], DUR, easeInOutCubic),
    bPkg().position([M.pkg.x, M.pkg.y], DUR, easeInOutCubic),
    bAm().position([M.am.x, M.am.y], DUR, easeInOutCubic),
    connEvPf().points(conn4(M.ev.x, M.ev.y + H2, M.pf.x, M.pf.y - H2), DUR, easeInOutCubic),
    connEvEwr().points(conn4(M.ev.x, M.ev.y + H2, M.ewr.x, M.ewr.y - H2), DUR, easeInOutCubic),
    connFePkg().points(conn4(M.fe.x, M.fe.y + H2, M.pkg.x, M.pkg.y - H2), DUR, easeInOutCubic),
    connPkgAm().points(conn4(M.pkg.x, M.pkg.y + H2, M.am.x, M.am.y - H2), DUR, easeInOutCubic),
    (function* () {
      yield* waitFor(0.3);
      yield* connEvFe().opacity(1, 0.5, easeInOutCubic);
    })(),
  );
  yield* waitFor(1.0);

  // ── Шаг 3: скрытый pass-through — packageOutput ──────────────────────────────
  yield* cb.scrollTo('private byte[] packageOutput', 1.0);
  yield* waitFor(1.5);

  // finalizeExport становится оркестратором низа
  model.setBody('finalizeExport', [
    'if (!isSupportedFormat(outputFormat)) {',
    '    throw new IllegalArgumentException("Unsupported: " + outputFormat);',
    '}',
    '',
    'Container container = Muxer.mux(encodedVideo, outputFormat);',
    'container.applyWatermark(watermarkMode);',
    'container.normalizeAudio(audioProfile);',
    'byte[] packagedBytes = packageOutput(container, outputFormat);',
    '',
    'return attachMetadata(packagedBytes, outputFormat, watermarkMode, audioProfile);',
  ]);
  model.getMethod('packageOutput').params = [
    param('Container', 'container'), param('String', 'outputFormat'),
  ];
  model.setBody('packageOutput', [
    'byte[] serializedContainer = container.toByteArray();',
    'byte[] signedPayload = signContent(serializedContainer, outputFormat);',
    '',
    'return enforceSizeBudget(signedPayload, outputFormat);',
  ]);

  yield* cb.morphTo(model.render(), {
    removeDuration: 0.3, moveDuration: 0.5, addStyle: 'fade', scrollStrategy: 'auto',
  });
  yield* waitFor(0.8);

  // Схема: нижняя часть → fan-out
  yield* all(
    connPkgAm().opacity(0, 0.3, easeInOutCubic),
    bPkg().position([G.pkg.x, G.pkg.y], DUR, easeInOutCubic),
    bAm().position([G.am.x, G.am.y], DUR, easeInOutCubic),
    connFePkg().points(conn4(M.fe.x, M.fe.y + H2, G.pkg.x, G.pkg.y - H2), DUR, easeInOutCubic),
    (function* () {
      yield* waitFor(0.3);
      yield* connFeAm().opacity(1, 0.5, easeInOutCubic);
    })(),
  );
  yield* waitFor(2.0);

  // ── Уход ──────────────────────────────────────────────────────────────────────
  yield* all(
    cb.disappear(Timing.normal),
    treeWrap.opacity(0, Timing.normal, easeInOutCubic),
  );
  yield* waitFor(0.3);
});
