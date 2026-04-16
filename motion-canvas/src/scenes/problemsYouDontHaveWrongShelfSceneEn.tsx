import {makeScene2D, Node, Line, Rect, Txt} from '@motion-canvas/2d';
import {all, easeInOutCubic, waitFor} from '@motion-canvas/core';
import {Fonts} from '../core/theme';
import {applyBackground} from '../core/utils';

// ── Table audit: what does grab() actually return? ──────────────────────

const TYPE_CLEAN   = 'rgba(220, 215, 255, 0.80)';
const TEXT_COLOR   = 'rgba(244, 241, 235, 0.92)';
const MUTED        = 'rgba(244, 241, 235, 0.45)';
const TRANSFER_BG  = 'rgba(255, 180, 100, 0.045)';

// ── Layout ─────────────────────────────────────────────────────────────
const LABEL_X  = -460;                       // left edge of field names
const COL_X    = [-160, 120, 400];           // column centers
const TITLE_Y  = -170;
const HEADER_Y = -100;
const SEP_Y    = -65;
const ROW_Y    = [-20, 36, 92];              // GripConf, MotionProfile, Orientation
const ROW_GAP  = ROW_Y[1] - ROW_Y[0];       // 56

const FONT_TITLE  = 22;
const FONT_HEADER = 17;
const FONT_CELL   = 16;

// ── Data ───────────────────────────────────────────────────────────────
const HEADERS = ['SoftGrab', 'FirmGrab', 'StandardGrab'];
const DATA = [
    {label: 'GripConfidence', values: ['HIGH',               'HIGH',   'MEDIUM']},
    {label: 'MotionProfile',  values: ['CAUTIOUS',           'FAST',   'LINEAR']},
    {label: 'Orientation',    values: ['cube.orientation()',  'LOCKED', 'ANY']},
];

// ════════════════════════════════════════════════════════════════════════
export default makeScene2D(function* (view) {
    applyBackground(view);

    const root = new Node({});
    view.add(root);

    // ── Title ───────────────────────────────────────────────────────────
    const title = new Txt({
        text: 'grab()  →  GrabResult',
        fontFamily: Fonts.code,
        fontSize: FONT_TITLE,
        fill: MUTED,
        y: TITLE_Y,
        opacity: 0,
    });
    root.add(title);

    // ── Column headers (strategy names) ─────────────────────────────────
    const headerGroup = new Node({opacity: 0});
    root.add(headerGroup);
    for (let i = 0; i < 3; i++) {
        headerGroup.add(new Txt({
            text: HEADERS[i],
            fontFamily: Fonts.code,
            fontSize: FONT_HEADER,
            fill: TYPE_CLEAN,
            x: COL_X[i],
            y: HEADER_Y,
        }));
    }

    // ── Separator ───────────────────────────────────────────────────────
    const sep = new Line({
        points: [[-520, 0], [520, 0]],
        stroke: 'rgba(244, 241, 235, 0.12)',
        lineWidth: 1,
        y: SEP_Y,
        opacity: 0,
    });
    root.add(sep);

    // ── Transfer highlight (behind rows 2–3) ────────────────────────────
    const transferHL = new Rect({
        width: 1060,
        height: ROW_GAP + 44,
        fill: TRANSFER_BG,
        y: (ROW_Y[1] + ROW_Y[2]) / 2,
        opacity: 0,
        radius: 6,
    });
    root.add(transferHL);

    // ── Data rows ───────────────────────────────────────────────────────
    const rows: {group: Node; label: Txt; cells: Txt[]}[] = [];

    for (let r = 0; r < DATA.length; r++) {
        const group = new Node({opacity: 0});

        const label = new Txt({
            text: DATA[r].label,
            fontFamily: Fonts.code,
            fontSize: FONT_CELL,
            fill: TEXT_COLOR,
            x: LABEL_X,
            y: ROW_Y[r],
            offset: [-1, 0],
        });
        group.add(label);

        const cells: Txt[] = [];
        for (let c = 0; c < 3; c++) {
            const cell = new Txt({
                text: DATA[r].values[c],
                fontFamily: Fonts.code,
                fontSize: FONT_CELL,
                fill: TEXT_COLOR,
                x: COL_X[c],
                y: ROW_Y[r],
            });
            group.add(cell);
            cells.push(cell);
        }

        root.add(group);
        rows.push({group, label, cells});
    }

    // ════════════════════════════════════════════════════════════════════
    // Phase 1 — Title + headers
    // ════════════════════════════════════════════════════════════════════
    yield* title.opacity(1, 0.4, easeInOutCubic);
    yield* all(
        headerGroup.opacity(1, 0.3, easeInOutCubic),
        sep.opacity(1, 0.3, easeInOutCubic),
    );
    yield* waitFor(0.3);

    // ════════════════════════════════════════════════════════════════════
    // Phase 2 — Rows appear one by one
    // ════════════════════════════════════════════════════════════════════
    yield* rows[0].group.opacity(1, 0.3, easeInOutCubic);   // GripConfidence
    yield* waitFor(0.5);
    yield* rows[1].group.opacity(1, 0.3, easeInOutCubic);   // MotionProfile
    yield* waitFor(0.5);
    yield* rows[2].group.opacity(1, 0.3, easeInOutCubic);   // Orientation  ← ANY visible
    yield* waitFor(1.5);

    // ════════════════════════════════════════════════════════════════════
    // Phase 3 — Leak: GripConf dims, transfer zone highlighted
    //           "these two rows aren't about grabbing"
    // ════════════════════════════════════════════════════════════════════
    yield* all(
        rows[0].group.opacity(0.2, 0.5, easeInOutCubic),
        transferHL.opacity(1, 0.5, easeInOutCubic),
    );
    yield* waitFor(2.0);

    // ════════════════════════════════════════════════════════════════════
    // Phase 4 — Only Orientation row remains
    // ════════════════════════════════════════════════════════════════════
    yield* all(
        title.opacity(0, 0.5, easeInOutCubic),
        headerGroup.opacity(0, 0.5, easeInOutCubic),
        sep.opacity(0, 0.5, easeInOutCubic),
        rows[0].group.opacity(0, 0.5, easeInOutCubic),
        rows[1].group.opacity(0, 0.5, easeInOutCubic),
        transferHL.opacity(0, 0.5, easeInOutCubic),
    );
    yield* waitFor(1.0);

    // ════════════════════════════════════════════════════════════════════
    // Phase 5 — Only StandardGrab's ANY
    //           SoftGrab + FirmGrab orientation values fade
    // ════════════════════════════════════════════════════════════════════
    yield* all(
        rows[2].cells[0].opacity(0, 0.5, easeInOutCubic),   // cube.orientation()
        rows[2].cells[1].opacity(0, 0.5, easeInOutCubic),   // LOCKED
    );
    yield* waitFor(1.5);

    // ════════════════════════════════════════════════════════════════════
    // Phase 6 — Fade out
    // ════════════════════════════════════════════════════════════════════
    yield* rows[2].group.opacity(0, 0.6, easeInOutCubic);
});
