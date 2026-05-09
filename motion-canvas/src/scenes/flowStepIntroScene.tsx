import {Line, Node, Rect, Txt, makeScene2D} from '@motion-canvas/2d';
import {
    Reference,
    all,
    createRef,
    easeInCubic,
    easeInOutCubic,
    easeOutCubic,
    sequence,
    waitFor,
} from '@motion-canvas/core';
import {Manticore} from '../core/code/components/Manticore';
import {DryFiltersV3CodeTheme} from '../core/code/model/SyntaxTheme';
import {Colors, Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ── palette / proportions ─────────────────────────────────────────────────
const SURFACE        = Colors.surface;
const STROKE         = '#262A34';
const STROKE_LIT     = Colors.accent;
const TEXT_PRIMARY   = Colors.text.primary;
const TEXT_MUTED     = 'rgba(244,241,235,0.55)';
const ACCENT         = Colors.accent;
const CONNECTOR      = 'rgba(244,241,235,0.30)';
const SHADOW_COLOR   = 'rgba(0,0,0,0.48)';
const SHADOW_BLUR    = 38;
const SHADOW_OFFSET: [number, number] = [-10, 16];

// ── Beat 1: 4-card flow row ───────────────────────────────────────────────
const FLOW_CARD_W = 320;
const FLOW_CARD_H = 168;
const FLOW_CARD_GAP = 60;
const FLOW_CARD_RADIUS = 22;
const FLOW_CARDS_Y = -20;

const FLOW_LABELS = [
    'New subscriber',
    'Wait 10 min',
    'Send WhatsApp',
    'Wait for reply',
] as const;
const FLOW_COUNT = FLOW_LABELS.length;
const SEND_INDEX = 2;

const FLOW_ROW_W = FLOW_COUNT * FLOW_CARD_W + (FLOW_COUNT - 1) * FLOW_CARD_GAP;
const FLOW_FIRST_CENTER_X = -FLOW_ROW_W / 2 + FLOW_CARD_W / 2;
const flowCenterX = (i: number): number =>
    FLOW_FIRST_CENTER_X + i * (FLOW_CARD_W + FLOW_CARD_GAP);

// ── Beat 4: code + decoders ───────────────────────────────────────────────
const CODE_Y = -300;
const CODE_FONT = 40;
const CODE_LH   = 60;

const DECODER_LABEL_X = -240;
const DECODER_VALUE_X = -60;
const DECODER_STEP_Y  = -130;
const DECODER_CTX_Y   =  -30;
const MINI_CARD_SCALE = 0.58;

// ── Beat 5: pipeline ──────────────────────────────────────────────────────
const PIPELINE_Y = +210;
const STATION_W = 218;
const STATION_H = 84;
const STATION_GAP = 36;
const STATION_RADIUS = 18;
const STATION_LABELS = [
    'Anna',
    'Consent?',
    'Quiet Hours?',
    'Render',
    'WhatsApp',
    'Next Step',
] as const;
const STATIONS_COUNT = STATION_LABELS.length;
const ANNA_STATION_INDEX = 0;

const PIPELINE_ROW_W = STATIONS_COUNT * STATION_W + (STATIONS_COUNT - 1) * STATION_GAP;
const PIPELINE_FIRST_X = -PIPELINE_ROW_W / 2 + STATION_W / 2;
const stationCenterX = (i: number): number =>
    PIPELINE_FIRST_X + i * (STATION_W + STATION_GAP);

// ──────────────────────────────────────────────────────────────────────────
//  helpers
// ──────────────────────────────────────────────────────────────────────────
//  A flow card has a 14-px y-offset baked in at construction time so the
//  reveal animation can tween BOTH opacity → 1 and y → FLOW_CARDS_Y in
//  parallel. Motion Canvas's tween API does not accept a start-value
//  argument, so the only clean way to animate "in from below" is to
//  pre-position the node at the offset before mount.
// ──────────────────────────────────────────────────────────────────────────

interface FlowCardHandle {
    node: Reference<Node>;
    rect: Reference<Rect>;
    label: Reference<Txt>;
}

function makeFlowCard(label: string, x: number, y: number): {jsx: any; h: FlowCardHandle} {
    const node  = createRef<Node>();
    const rect  = createRef<Rect>();
    const txt   = createRef<Txt>();
    const jsx = (
        <Node ref={node} x={x} y={y + 14} opacity={0}>
            <Rect
                ref={rect}
                width={FLOW_CARD_W}
                height={FLOW_CARD_H}
                radius={FLOW_CARD_RADIUS}
                fill={SURFACE}
                stroke={STROKE}
                lineWidth={1}
                shadowColor={SHADOW_COLOR}
                shadowBlur={SHADOW_BLUR}
                shadowOffset={SHADOW_OFFSET}
            />
            <Txt
                ref={txt}
                text={label}
                fontFamily={Fonts.primary}
                fontSize={28}
                fontWeight={500}
                fill={TEXT_PRIMARY}
            />
        </Node>
    );
    return {jsx, h: {node, rect, label: txt}};
}

interface ConnectorHandle {
    line: Reference<Line>;
}

function makeConnector(x1: number, x2: number, y: number): {jsx: any; h: ConnectorHandle} {
    const line = createRef<Line>();
    const jsx = (
        <Line
            ref={line}
            points={[[x1, y], [x2 - 6, y]]}
            stroke={CONNECTOR}
            lineWidth={1.5}
            endArrow
            arrowSize={7}
            opacity={0}
        />
    );
    return {jsx, h: {line}};
}

interface StationHandle {
    node: Reference<Node>;
    rect: Reference<Rect>;
    label: Reference<Txt>;
}

function makeStation(label: string, x: number, y: number): {jsx: any; h: StationHandle} {
    const node = createRef<Node>();
    const rect = createRef<Rect>();
    const txt  = createRef<Txt>();
    const jsx = (
        <Node ref={node} x={x} y={y + 12} opacity={0}>
            <Rect
                ref={rect}
                width={STATION_W}
                height={STATION_H}
                radius={STATION_RADIUS}
                fill={SURFACE}
                stroke={STROKE}
                lineWidth={1}
                shadowColor={SHADOW_COLOR}
                shadowBlur={SHADOW_BLUR * 0.6}
                shadowOffset={[-6, 10]}
            />
            <Txt
                ref={txt}
                text={label}
                fontFamily={Fonts.primary}
                fontSize={22}
                fontWeight={500}
                fill={TEXT_PRIMARY}
            />
        </Node>
    );
    return {jsx, h: {node, rect, label: txt}};
}

// Anna marker — single Node whose .position points to the DOT's centre.
// Label sits to the right of the dot. Constructed this way so Beat 5
// can drop the label and slide just-the-dot through the pipeline by
// moving the marker's position (the dot is at local 0,0).
interface AnnaHandle {
    node: Reference<Node>;
    dot: Reference<Rect>;
    name: Reference<Txt>;
}

function makeAnnaMarker(x: number, y: number): {jsx: any; h: AnnaHandle} {
    const node = createRef<Node>();
    const dot  = createRef<Rect>();
    const name = createRef<Txt>();
    const jsx = (
        <Node ref={node} x={x} y={y + 8} opacity={0}>
            <Rect
                ref={dot}
                width={16}
                height={16}
                radius={8}
                fill={ACCENT}
                shadowColor={ACCENT}
                shadowBlur={18}
            />
            <Txt
                ref={name}
                text="Anna"
                fontFamily={Fonts.primary}
                fontSize={22}
                fontWeight={500}
                fill={TEXT_PRIMARY}
                x={42}
            />
        </Node>
    );
    return {jsx, h: {node, dot, name}};
}

// ──────────────────────────────────────────────────────────────────────────
export default makeScene2D(function* (view) {
    applyBackground(view);

    // ════════════════════════════════════════════════════════════════════
    //  BEAT 1 — UI flow cards (sequential reveal)
    // ════════════════════════════════════════════════════════════════════
    const flowCards: FlowCardHandle[] = [];
    const connectors: ConnectorHandle[] = [];
    const flowJsx: any[] = [];

    for (let i = 0; i < FLOW_COUNT; i++) {
        const {jsx, h} = makeFlowCard(FLOW_LABELS[i], flowCenterX(i), FLOW_CARDS_Y);
        flowJsx.push(jsx);
        flowCards.push(h);
    }
    for (let i = 0; i < FLOW_COUNT - 1; i++) {
        const x1 = flowCenterX(i)     + FLOW_CARD_W / 2 + 6;
        const x2 = flowCenterX(i + 1) - FLOW_CARD_W / 2 - 6;
        const {jsx, h} = makeConnector(x1, x2, FLOW_CARDS_Y);
        flowJsx.push(jsx);
        connectors.push(h);
    }

    view.add(<>{flowJsx}</>);

    const cardIn = (i: number) => all(
        flowCards[i].node().opacity(1, 0.45, easeOutCubic),
        flowCards[i].node().y(FLOW_CARDS_Y, 0.45, easeOutCubic),
    );
    const connIn = (i: number) =>
        connectors[i].line().opacity(1, 0.32, easeOutCubic);

    yield* cardIn(0);
    yield* waitFor(0.18);
    yield* connIn(0);
    yield* cardIn(1);
    yield* waitFor(0.10);
    yield* connIn(1);
    yield* cardIn(2);
    yield* waitFor(0.10);
    yield* connIn(2);
    yield* cardIn(3);

    yield* waitFor(2.4);

    // ════════════════════════════════════════════════════════════════════
    //  BEAT 2 — zoom on Send WhatsApp
    // ════════════════════════════════════════════════════════════════════
    const SEND = flowCards[SEND_INDEX].node;

    yield* all(
        flowCards[0].node().opacity(0, 0.7, easeInOutCubic),
        flowCards[1].node().opacity(0, 0.7, easeInOutCubic),
        flowCards[3].node().opacity(0, 0.7, easeInOutCubic),
        ...connectors.map(c => c.line().opacity(0, 0.7, easeInOutCubic)),
        SEND().x(0, 1.0, easeInOutCubic),
        SEND().y(0, 1.0, easeInOutCubic),
        SEND().scale(1.18, 1.0, easeInOutCubic),
    );

    yield* waitFor(1.4);

    // ════════════════════════════════════════════════════════════════════
    //  BEAT 3 — Anna marker on the card
    //   Card is at (0, 0) at scale 1.18, so the visual half-extents are
    //   320*1.18/2 = 188.8 (x) and 168*1.18/2 = 99.1 (y). The marker
    //   anchors its dot at lower-right — inset by 84 (room for "Anna"
    //   text) and 26 from the bottom.
    // ════════════════════════════════════════════════════════════════════
    const ANNA_REST_X = (FLOW_CARD_W * 1.18) / 2 - 84;
    const ANNA_REST_Y = (FLOW_CARD_H * 1.18) / 2 - 26;

    const {jsx: annaJsx, h: anna} = makeAnnaMarker(ANNA_REST_X, ANNA_REST_Y);
    view.add(annaJsx);

    yield* all(
        anna.node().opacity(1, 0.5, easeOutCubic),
        anna.node().y(ANNA_REST_Y, 0.5, easeOutCubic),
    );

    yield* waitFor(1.6);

    // ════════════════════════════════════════════════════════════════════
    //  BEAT 4 — code reveal + decoder annotations
    //
    //   Layout:
    //     y = -300  executeStep(step, ctx)         (centred)
    //     y = -120  step =   [Send WhatsApp mini]
    //     y =  -50  ctx  =   ●Anna
    //
    //   The card and Anna marker physically slide into the decoder
    //   slots — same nodes, same colours, same labels, so the read is
    //   "this card became step / this marker became ctx" rather than
    //   "two new things appeared".
    // ════════════════════════════════════════════════════════════════════
    const code = Manticore.create('executeStep(step, ctx)', {
        x: 0,
        y: CODE_Y,
        width: 760,
        fontSize: CODE_FONT,
        lineHeight: CODE_LH,
        fontFamily: Fonts.code,
        theme: DryFiltersV3CodeTheme,
        cardStyle: {
            radius: 0,
            fill: 'rgba(0,0,0,0)',
            stroke: 'rgba(0,0,0,0)',
            strokeWidth: 0,
            shadowColor: 'rgba(0,0,0,0)',
            shadowBlur: 0,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            edge: false,
        },
        glowAccent: false,
    });
    code.mount(view);
    code.colorize([
        {match: /^executeStep$/, color: TEXT_PRIMARY},
        {match: /^step$/,        color: ACCENT},
        {match: /^ctx$/,         color: ACCENT},
    ]);

    const stepLabel = createRef<Txt>();
    const ctxLabel  = createRef<Txt>();
    view.add(
        <>
            <Txt
                ref={stepLabel}
                text="step ="
                fontFamily={Fonts.code}
                fontSize={26}
                fontWeight={400}
                fill={TEXT_MUTED}
                x={DECODER_LABEL_X}
                y={DECODER_STEP_Y}
                opacity={0}
            />
            <Txt
                ref={ctxLabel}
                text="ctx  ="
                fontFamily={Fonts.code}
                fontSize={26}
                fontWeight={400}
                fill={TEXT_MUTED}
                x={DECODER_LABEL_X}
                y={DECODER_CTX_Y}
                opacity={0}
            />
        </>,
    );

    yield* code.appear(0.6);
    yield* waitFor(0.4);

    // Card → "step =" slot. Anna → "ctx =" slot. Decoders fade in
    // mid-flight. The mini card lands centred at DECODER_VALUE_X+80;
    // Anna's dot lands at DECODER_VALUE_X.
    yield* all(
        SEND().x(DECODER_VALUE_X + 80, 1.0, easeInOutCubic),
        SEND().y(DECODER_STEP_Y, 1.0, easeInOutCubic),
        SEND().scale(MINI_CARD_SCALE, 1.0, easeInOutCubic),
        anna.node().x(DECODER_VALUE_X, 1.0, easeInOutCubic),
        anna.node().y(DECODER_CTX_Y, 1.0, easeInOutCubic),
        stepLabel().opacity(1, 0.6, easeInOutCubic),
        ctxLabel().opacity(1, 0.6, easeInOutCubic),
    );

    yield* waitFor(2.2);

    // ════════════════════════════════════════════════════════════════════
    //  BEAT 5 — execution pipeline
    //
    //   Six stations in a row at PIPELINE_Y. The pipeline shell appears
    //   left-to-right; then Anna's accent dot peels off the "ctx" decoder
    //   and walks through the row. Each station's stroke goes accent
    //   when the dot enters.
    // ════════════════════════════════════════════════════════════════════
    const pipelineLayer = createRef<Node>();
    const stations: StationHandle[] = [];
    const stationConnectors: ConnectorHandle[] = [];
    const pipelineJsx: any[] = [];

    for (let i = 0; i < STATIONS_COUNT; i++) {
        const {jsx, h} = makeStation(STATION_LABELS[i], stationCenterX(i), PIPELINE_Y);
        pipelineJsx.push(jsx);
        stations.push(h);
    }
    for (let i = 0; i < STATIONS_COUNT - 1; i++) {
        const x1 = stationCenterX(i)     + STATION_W / 2 + 4;
        const x2 = stationCenterX(i + 1) - STATION_W / 2 - 4;
        const {jsx, h} = makeConnector(x1, x2, PIPELINE_Y);
        pipelineJsx.push(jsx);
        stationConnectors.push(h);
    }

    view.add(<Node ref={pipelineLayer}>{pipelineJsx}</Node>);

    yield* sequence(
        0.06,
        ...stations.map(s => all(
            s.node().opacity(1, 0.45, easeOutCubic),
            s.node().y(PIPELINE_Y, 0.45, easeOutCubic),
        )),
    );
    yield* all(
        ...stationConnectors.map(c => c.line().opacity(1, 0.4, easeInOutCubic)),
    );

    yield* waitFor(0.4);

    // Drop the "Anna" word; the dot becomes the protagonist.
    yield* all(
        anna.name().opacity(0, 0.4, easeInCubic),
        anna.dot().shadowBlur(22, 0.4, easeOutCubic),
    );

    // Light a station: stroke goes accent + thicker, label gets a touch
    // of accent so the lit state reads at thumbnail size, not just on
    // close inspection.
    const lightStation = (i: number, dur = 0.5) => all(
        stations[i].rect().stroke(STROKE_LIT, dur, easeInOutCubic),
        stations[i].rect().lineWidth(2, dur, easeInOutCubic),
        stations[i].label().fill(ACCENT, dur, easeInOutCubic),
    );

    // Slide the marker (= dot) into station[0]'s centre.
    yield* all(
        anna.node().x(stationCenterX(ANNA_STATION_INDEX), 0.7, easeInOutCubic),
        anna.node().y(PIPELINE_Y, 0.7, easeInOutCubic),
        lightStation(ANNA_STATION_INDEX, 0.5),
    );
    yield* waitFor(0.35);

    // Walk: brighten the leading connector → slide the dot → light the
    // next station → settle the connector to the trail tone.
    for (let i = 1; i < STATIONS_COUNT; i++) {
        const conn = stationConnectors[i - 1];
        yield* conn.line().stroke(STROKE_LIT, 0.25, easeInOutCubic);
        yield* all(
            anna.node().x(stationCenterX(i), 0.55, easeInOutCubic),
            lightStation(i, 0.55),
        );
        yield* conn.line().stroke(CONNECTOR, 0.3, easeInOutCubic);
        yield* waitFor(0.16);
    }

    yield* waitFor(2.0);

    // Soft outro.
    yield* all(
        code.node.opacity(0, 0.7, easeInOutCubic),
        SEND().opacity(0, 0.7, easeInOutCubic),
        anna.node().opacity(0, 0.7, easeInOutCubic),
        stepLabel().opacity(0, 0.7, easeInOutCubic),
        ctxLabel().opacity(0, 0.7, easeInOutCubic),
        pipelineLayer().opacity(0, 0.85, easeInOutCubic),
    );
    yield* waitFor(0.4);
});
