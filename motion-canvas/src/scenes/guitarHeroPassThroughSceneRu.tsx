import {Circle, Line, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, linear, waitFor} from '@motion-canvas/core';
import {Screen} from '../core/theme';

const BG = '#121212';
const PINK = '#FF8CA3';
const STRINGS = ['#79B647', '#E4554E', '#E6C746', '#4DA7E3', '#E58A47'];

export default makeScene2D(function* (view) {
  const on = createSignal(1);
  const uiOn = createSignal(0);
  const noteOn = createSignal(0);
  const noteX = createSignal(0);
  const notePulse = createSignal(0);
  const noteSquash = createSignal(0);
  const hitA = createSignal(0);
  const hitB = createSignal(0);
  const hitC = createSignal(0);
  const hitD = createSignal(0);
  const hitE = createSignal(0);

  const yTop = -430;
  const yBottom = 410;
  const wTop = 300;
  const wBottom = 1050;
  const hitY = 320;
  const highlightCutY = hitY - 6;

  const laneX = (lane: number, y: number) => {
    const t = (y - yTop) / (yBottom - yTop);
    const w = wTop + (wBottom - wTop) * Math.max(0, Math.min(1, t));
    return -w / 2 + (lane / 4) * w;
  };
  const depth = (y: number) => Math.max(0, Math.min(1, (y - yTop) / (yBottom - yTop)));
  const noteWAt = (y: number) => 20 + depth(y) * 44;
  const noteHAt = (y: number) => noteWAt(y) * 0.56; // lying in fretboard plane
  const labelGapAt = (y: number) => 9 + depth(y) * 6;
  const labelXAt = (lane: number, y: number) => laneX(lane, y) - noteWAt(y) * 0.66 - labelGapAt(y);
  const labelScaleXAt = (y: number) => 1.14 + depth(y) * 0.1;
  const labelScaleYAt = (y: number) => 0.68 + depth(y) * 0.08;
  const labelScaleYForLane = (lane: number, y: number) => {
    const base = labelScaleYAt(y);
    // Green/red lanes sit a bit more in-plane.
    return lane === 0 || lane === 1 ? base * 0.93 : base;
  };
  // Match text slant with the local string direction.
  const labelSkewByLane = (lane: number, y: number) => {
    const sample = 42;
    const y0 = Math.max(yTop, y - sample);
    const y1 = Math.min(yBottom, y + sample);
    const dx = laneX(lane, y1) - laneX(lane, y0);
    const dy = y1 - y0 || 1;
    const base = ((Math.atan2(dx, dy) * 180) / Math.PI) * 0.55;
    // Yellow lane: tweak top-lean (shear), not rigid rotation.
    if (lane === 2) return base - 1.8;
    if (lane === 3) return base * 0.62;
    return base;
  };
  const nAY = createSignal(yTop);
  const nBY = createSignal(yTop);
  const nCY = createSignal(yTop);
  const nDY = createSignal(yTop);
  const nEY = createSignal(yTop);
  const nAOn = createSignal(0);
  const nBOn = createSignal(0);
  const nCOn = createSignal(0);
  const nDOn = createSignal(0);
  const nEOn = createSignal(0);
  const g0 = createSignal(0);
  const g1 = createSignal(0);
  const g2 = createSignal(0);
  const g3 = createSignal(0);
  const g4 = createSignal(0);
  const s0 = createSignal(0);
  const s1 = createSignal(0);
  const s2 = createSignal(0);
  const s3 = createSignal(0);
  const s4 = createSignal(0);
  const logLimit = 10;
  const methodLogText = Array.from({length: logLimit}, () => createSignal(''));
  const methodLogOn = Array.from({length: logLimit}, () => createSignal(0));

  const laneA = 0;
  const laneB = 1;
  const laneC = 3;
  const laneD = 2;
  const laneE = 4;
  const noteBaseW = 76;
  const laneColor = (lane: number) => STRINGS[Math.max(0, Math.min(4, lane))];
  const laneLabelA = createSignal('');
  const laneLabelB = createSignal('');
  const laneLabelC = createSignal('');
  const laneLabelD = createSignal('');
  const laneLabelE = createSignal('');
  const activeLane = createSignal(laneA);
  const show = () => on() * uiOn();
  const pinkW = () => noteBaseW + notePulse() * 22 + noteSquash() * 10;
  const pinkH = () => (noteBaseW + notePulse() * 22 - noteSquash() * 6) * 0.56;

  noteX(laneX(laneA, hitY));

  view.add(
    <>
      <Rect width={Screen.width} height={Screen.height} fill={BG} opacity={on} />
      <Rect width={Screen.width} height={Screen.height} fill={'rgba(255,255,255,0.03)'} opacity={() => show() * 0.8} />
      {/* Left method match log (max 10 entries), minimal style */}
      {Array.from({length: logLimit}, (_, i) => (
        <Txt
          x={-Screen.width * 0.44}
          y={-Screen.height * 0.40 + i * 40}
          text={() => methodLogText[i]()}
          textAlign={'left'}
          offset={[-1, 0]}
          fontSize={33}
          letterSpacing={0.3}
          fill={'rgba(214,238,208,0.92)'}
          opacity={() => show() * methodLogOn[i]()}
        />
      ))}

      {/* String depth: smooth segmented taper (no step-like pyramid) */}
      {[0, 1, 2, 3, 4].flatMap(i =>
        Array.from({length: 14}, (_, seg) => {
          const t0 = seg / 14;
          const t1 = (seg + 1) / 14;
          const y0s = yTop + (yBottom - yTop) * t0;
          const y1s = yTop + (yBottom - yTop) * t1;
          const tMid = (t0 + t1) * 0.5;
          const width = 1.25 + tMid * 3.15;
          const alpha = 0.24 + tMid * 0.48;
          return (
            <Line
              points={[
                [laneX(i, y0s), y0s],
                [laneX(i, y1s), y1s],
              ]}
              stroke={STRINGS[i]}
              lineWidth={width}
              lineCap={'round'}
              opacity={() => show() * alpha}
            />
          );
        }),
      )}
      {/* Active highlight only above match line (no near-camera glow) */}
      {[0, 1, 2, 3, 4].map(i => (
        <Line
          points={[
            [laneX(i, yTop), yTop],
            [laneX(i, highlightCutY), highlightCutY],
          ]}
          stroke={STRINGS[i]}
          lineWidth={3.2}
          lineCap={'butt'}
          opacity={() => show() * (i === 0 ? g0() : i === 1 ? g1() : i === 2 ? g2() : i === 3 ? g3() : g4()) * 0.72}
        />
      ))}
      {/* Shockwave along the hit string */}
      {[0, 1, 2, 3, 4].map(i => (
        <Line
          points={() => {
            const p = i === 0 ? s0() : i === 1 ? s1() : i === 2 ? s2() : i === 3 ? s3() : s4();
            const span = 8 + p * 115;
            const y0s = hitY - span;
            const y1s = highlightCutY;
            return [
              [laneX(i, y0s), y0s],
              [laneX(i, y1s), y1s],
            ];
          }}
          stroke={STRINGS[i]}
          lineWidth={() => 2 + (i === 0 ? s0() : i === 1 ? s1() : i === 2 ? s2() : i === 3 ? s3() : s4()) * 5}
          lineCap={'round'}
          opacity={() => show() * (i === 0 ? s0() : i === 1 ? s1() : i === 2 ? s2() : i === 3 ? s3() : s4()) * 0.95}
        />
      ))}

      {/* perspective fret lines */}
      {[0.12, 0.25, 0.39, 0.55, 0.72, 0.9].map(k => {
        const y = yTop + (yBottom - yTop) * k;
        return (
          <Line
            points={[
              [laneX(0, y) - 35, y],
              [laneX(4, y) + 35, y],
            ]}
            stroke={'rgba(244,241,235,0.10)'}
            lineWidth={1.5}
            opacity={show}
          />
        );
      })}

      {/* hit line */}
      <Line
        points={[
          [laneX(0, hitY) - 55, hitY],
          [laneX(4, hitY) + 55, hitY],
        ]}
        stroke={'rgba(255,255,255,0.22)'}
        lineWidth={10}
        opacity={show}
      />
      <Line
        points={[
          [laneX(0, hitY) - 55, hitY],
          [laneX(4, hitY) + 55, hitY],
        ]}
        stroke={'rgba(252,251,248,0.82)'}
        lineWidth={2}
        opacity={show}
      />

      {/* Method labels (left), lying in fretboard plane */}
      <Txt
        x={() => labelXAt(laneA, nAY())}
        y={nAY}
        text={laneLabelA}
        fontSize={() => 32 + depth(nAY()) * 20}
        textAlign={'right'}
        offset={[1, 0]}
        letterSpacing={0.7}
        skewX={() => labelSkewByLane(laneA, nAY())}
        fill={laneColor(laneA)}
        scaleX={() => labelScaleXAt(nAY())}
        scaleY={() => labelScaleYForLane(laneA, nAY())}
        shadowColor={'rgba(121,182,71,0.22)'}
        shadowBlur={5}
        opacity={() => show() * nAOn() * 0.9}
      />
      {/* Method notes moving in fretboard plane */}
      <Circle
        x={() => laneX(laneA, nAY())}
        y={nAY}
        width={() => noteWAt(nAY()) * 1.24}
        height={() => noteHAt(nAY()) * 1.24}
        fill={'rgba(0,0,0,0)'}
        stroke={laneColor(laneA)}
        lineWidth={() => 6.2 + depth(nAY()) * 3.4}
        shadowColor={'rgba(121,182,71,0.30)'}
        shadowBlur={5}
        shadowOffset={[0, 2]}
        opacity={() => show() * nAOn()}
      />
      <Txt
        x={() => labelXAt(laneB, nBY())}
        y={nBY}
        text={laneLabelB}
        fontSize={() => 32 + depth(nBY()) * 20}
        textAlign={'right'}
        offset={[1, 0]}
        letterSpacing={0.7}
        skewX={() => labelSkewByLane(laneB, nBY())}
        fill={laneColor(laneB)}
        scaleX={() => labelScaleXAt(nBY())}
        scaleY={() => labelScaleYForLane(laneB, nBY())}
        shadowColor={'rgba(228,85,78,0.22)'}
        shadowBlur={5}
        opacity={() => show() * nBOn() * 0.9}
      />
      <Circle
        x={() => laneX(laneB, nBY())}
        y={nBY}
        width={() => noteWAt(nBY()) * 1.24}
        height={() => noteHAt(nBY()) * 1.24}
        fill={'rgba(0,0,0,0)'}
        stroke={laneColor(laneB)}
        lineWidth={() => 6.2 + depth(nBY()) * 3.4}
        shadowColor={'rgba(228,85,78,0.30)'}
        shadowBlur={5}
        shadowOffset={[0, 2]}
        opacity={() => show() * nBOn()}
      />
      <Txt
        x={() => labelXAt(laneC, nCY())}
        y={nCY}
        text={laneLabelC}
        fontSize={() => 32 + depth(nCY()) * 20}
        textAlign={'right'}
        offset={[1, 0]}
        letterSpacing={0.7}
        skewX={() => labelSkewByLane(laneC, nCY())}
        fill={laneColor(laneC)}
        scaleX={() => labelScaleXAt(nCY())}
        scaleY={() => labelScaleYForLane(laneC, nCY())}
        shadowColor={'rgba(77,167,227,0.22)'}
        shadowBlur={5}
        opacity={() => show() * nCOn() * 0.9}
      />
      <Circle
        x={() => laneX(laneC, nCY())}
        y={nCY}
        width={() => noteWAt(nCY()) * 1.24}
        height={() => noteHAt(nCY()) * 1.24}
        fill={'rgba(0,0,0,0)'}
        stroke={laneColor(laneC)}
        lineWidth={() => 6.2 + depth(nCY()) * 3.4}
        shadowColor={'rgba(77,167,227,0.30)'}
        shadowBlur={5}
        shadowOffset={[0, 2]}
        opacity={() => show() * nCOn()}
      />
      <Txt
        x={() => labelXAt(laneD, nDY())}
        y={nDY}
        text={laneLabelD}
        fontSize={() => 32 + depth(nDY()) * 20}
        textAlign={'right'}
        offset={[1, 0]}
        letterSpacing={0.7}
        skewX={() => labelSkewByLane(laneD, nDY())}
        fill={laneColor(laneD)}
        scaleX={() => labelScaleXAt(nDY())}
        scaleY={() => labelScaleYForLane(laneD, nDY())}
        shadowColor={'rgba(230,199,70,0.22)'}
        shadowBlur={5}
        opacity={() => show() * nDOn() * 0.9}
      />
      <Circle
        x={() => laneX(laneD, nDY())}
        y={nDY}
        width={() => noteWAt(nDY()) * 1.24}
        height={() => noteHAt(nDY()) * 1.24}
        fill={'rgba(0,0,0,0)'}
        stroke={laneColor(laneD)}
        lineWidth={() => 6.2 + depth(nDY()) * 3.4}
        shadowColor={'rgba(230,199,70,0.30)'}
        shadowBlur={5}
        shadowOffset={[0, 2]}
        opacity={() => show() * nDOn()}
      />
      <Txt
        x={() => labelXAt(laneE, nEY())}
        y={nEY}
        text={laneLabelE}
        fontSize={() => 32 + depth(nEY()) * 20}
        textAlign={'right'}
        offset={[1, 0]}
        letterSpacing={0.7}
        skewX={() => labelSkewByLane(laneE, nEY())}
        fill={laneColor(laneE)}
        scaleX={() => labelScaleXAt(nEY())}
        scaleY={() => labelScaleYForLane(laneE, nEY())}
        shadowColor={'rgba(229,138,71,0.22)'}
        shadowBlur={5}
        opacity={() => show() * nEOn() * 0.9}
      />
      <Circle
        x={() => laneX(laneE, nEY())}
        y={nEY}
        width={() => noteWAt(nEY()) * 1.24}
        height={() => noteHAt(nEY()) * 1.24}
        fill={'rgba(0,0,0,0)'}
        stroke={laneColor(laneE)}
        lineWidth={() => 6.2 + depth(nEY()) * 3.4}
        shadowColor={'rgba(229,138,71,0.30)'}
        shadowBlur={5}
        shadowOffset={[0, 2]}
        opacity={() => show() * nEOn()}
      />

      {/* Contact pulses when method circles touch the pink argument */}
      <Circle
        x={noteX}
        y={hitY}
        width={() => pinkW() * 1.34}
        height={() => pinkH() * 1.34}
        skewX={() => labelSkewByLane(activeLane(), hitY) * 0.5}
        fill={PINK}
        opacity={() => noteOn() * (0.12 + notePulse() * 0.12 + Math.max(hitA(), hitB(), hitC(), hitD(), hitE()) * 0.38)}
        shadowColor={'rgba(255,140,163,0.45)'}
        shadowBlur={14}
      />
      <Circle
        x={noteX}
        y={hitY}
        width={pinkW}
        height={pinkH}
        skewX={() => labelSkewByLane(activeLane(), hitY) * 0.5}
        fill={PINK}
        stroke={'rgba(0,0,0,0)'}
        lineWidth={0}
        shadowColor={'rgba(255,140,163,0.28)'}
        shadowBlur={10}
        opacity={noteOn}
      />
    </>,
  );

  const playNote = function* (
    lane: number,
    noteY: ReturnType<typeof createSignal<number>>,
    noteVisible: ReturnType<typeof createSignal<number>>,
    laneLabel: ReturnType<typeof createSignal<string>>,
    hit: ReturnType<typeof createSignal<number>>,
    glow: ReturnType<typeof createSignal<number>>,
    shock: ReturnType<typeof createSignal<number>>,
    methodName: string,
    pace: number,
  ) {
    const travel = 0.56 * pace;
    activeLane(lane);
    noteY(yTop);
    noteVisible(1);
    laneLabel(methodName);
    // Pink marker starts moving early, while note is still far.
    yield* all(
      noteY(hitY, travel, linear),
      noteX(laneX(lane, hitY), travel * 0.45, linear),
    );
    yield* all(
      hit(1, 0.10 * pace),
      notePulse(1.0, 0.10 * pace),
      noteSquash(1, 0.09 * pace),
      glow(1, 0.10 * pace),
      shock(1, 0.08 * pace),
    );
    yield* all(
      hit(0, 0.22 * pace),
      notePulse(0, 0.16 * pace),
      noteSquash(0, 0.12 * pace),
      glow(0, 0.20 * pace),
      shock(0, 0.20 * pace),
      noteVisible(0, 0.14 * pace), // disappear right after hit
    );
    if (matchCount < logLimit) {
      const row = matchCount;
      matchCount += 1;
      methodLogText[row](methodName);
      yield* methodLogOn[row](1, 0.12, easeInOutCubic);
    }
  };

  let matchCount = 0;
  yield* waitFor(0.12);
  yield* uiOn(1, 0.45, easeInOutCubic);
  yield* noteOn(1, 0.2, easeInOutCubic);

  yield* noteX(laneX(laneA, hitY), 0.06, linear);
  const events = [
    {lane: laneA, y: nAY, on: nAOn, label: laneLabelA, hit: hitA, glow: g0, shock: s0, method: 'prepare'},
    {lane: laneB, y: nBY, on: nBOn, label: laneLabelB, hit: hitB, glow: g1, shock: s1, method: 'encodeWithRetry'},
    {lane: laneC, y: nCY, on: nCOn, label: laneLabelC, hit: hitC, glow: g3, shock: s3, method: 'finalizeExport'},
    {lane: laneD, y: nDY, on: nDOn, label: laneLabelD, hit: hitD, glow: g2, shock: s2, method: 'encode'},
    {lane: laneE, y: nEY, on: nEOn, label: laneLabelE, hit: hitE, glow: g4, shock: s4, method: 'mux'},
    {lane: laneB, y: nBY, on: nBOn, label: laneLabelB, hit: hitB, glow: g1, shock: s1, method: 'attachAudioTrack'},
    {lane: laneD, y: nDY, on: nDOn, label: laneLabelD, hit: hitD, glow: g2, shock: s2, method: 'bitrate'},
    {lane: laneC, y: nCY, on: nCOn, label: laneLabelC, hit: hitC, glow: g3, shock: s3, method: 'normalizeFrames'},
    {lane: laneA, y: nAY, on: nAOn, label: laneLabelA, hit: hitA, glow: g0, shock: s0, method: 'grade'},
    {lane: laneB, y: nBY, on: nBOn, label: laneLabelB, hit: hitB, glow: g1, shock: s1, method: 'writeMp4Container'},
    {lane: laneC, y: nCY, on: nCOn, label: laneLabelC, hit: hitC, glow: g3, shock: s3, method: 'injectMetadata'},
    {lane: laneD, y: nDY, on: nDOn, label: laneLabelD, hit: hitD, glow: g2, shock: s2, method: 'verify'},
    {lane: laneA, y: nAY, on: nAOn, label: laneLabelA, hit: hitA, glow: g0, shock: s0, method: 'pack'},
    {lane: laneC, y: nCY, on: nCOn, label: laneLabelC, hit: hitC, glow: g3, shock: s3, method: 'signDeliveryToken'},
    {lane: laneB, y: nBY, on: nBOn, label: laneLabelB, hit: hitB, glow: g1, shock: s1, method: 'persistManifest'},
    {lane: laneD, y: nDY, on: nDOn, label: laneLabelD, hit: hitD, glow: g2, shock: s2, method: 'notify'},
    {lane: laneC, y: nCY, on: nCOn, label: laneLabelC, hit: hitC, glow: g3, shock: s3, method: 'archiveSourceClip'},
  ] as const;
  for (let i = 0; i < events.length; i++) {
    const n = events[i];
    const pace = Math.max(0.44, 1 - i * 0.04); // gradual acceleration into timelapse
    yield* playNote(n.lane, n.y, n.on, n.label, n.hit, n.glow, n.shock, n.method, pace);
  }

  // Explicit timelapse ending: dense, much faster, still unique names.
  const timelapseEvents = [
    {lane: laneA, y: nAY, on: nAOn, label: laneLabelA, hit: hitA, glow: g0, shock: s0, method: 'queue'},
    {lane: laneC, y: nCY, on: nCOn, label: laneLabelC, hit: hitC, glow: g3, shock: s3, method: 'hydratePreviewFrame'},
    {lane: laneE, y: nEY, on: nEOn, label: laneLabelE, hit: hitE, glow: g4, shock: s4, method: 'sealOrange'},
    {lane: laneB, y: nBY, on: nBOn, label: laneLabelB, hit: hitB, glow: g1, shock: s1, method: 'mapSubtitleTrack'},
    {lane: laneD, y: nDY, on: nDOn, label: laneLabelD, hit: hitD, glow: g2, shock: s2, method: 'seal'},
    {lane: laneA, y: nAY, on: nAOn, label: laneLabelA, hit: hitA, glow: g0, shock: s0, method: 'publish'},
    {lane: laneB, y: nBY, on: nBOn, label: laneLabelB, hit: hitB, glow: g1, shock: s1, method: 'emitAuditEnvelope'},
    {lane: laneC, y: nCY, on: nCOn, label: laneLabelC, hit: hitC, glow: g3, shock: s3, method: 'snapshotTranscodeState'},
    {lane: laneE, y: nEY, on: nEOn, label: laneLabelE, hit: hitE, glow: g4, shock: s4, method: 'flushOrange'},
    {lane: laneD, y: nDY, on: nDOn, label: laneLabelD, hit: hitD, glow: g2, shock: s2, method: 'flush'},
    {lane: laneA, y: nAY, on: nAOn, label: laneLabelA, hit: hitA, glow: g0, shock: s0, method: 'close'},
    {lane: laneC, y: nCY, on: nCOn, label: laneLabelC, hit: hitC, glow: g3, shock: s3, method: 'compactExportLedger'},
  ] as const;
  for (let i = 0; i < timelapseEvents.length; i++) {
    const n = timelapseEvents[i];
    const pace = Math.max(0.17, 0.32 - i * 0.02); // hard timelapse ramp
    yield* playNote(n.lane, n.y, n.on, n.label, n.hit, n.glow, n.shock, n.method, pace);
  }

  yield* waitFor(0.35);
});

