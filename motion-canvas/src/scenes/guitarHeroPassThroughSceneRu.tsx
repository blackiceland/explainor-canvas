import {Circle, Line, makeScene2D, Rect, Txt} from '@motion-canvas/2d';
import {all, createSignal, easeInOutCubic, linear, waitFor} from '@motion-canvas/core';
import {Screen} from '../core/theme';

const BG = '#121212';
const PINK = '#FF8CA3';
const STRINGS = ['#79B647', '#E4554E', '#E6C746', '#4DA7E3', '#E58A47'];

export default makeScene2D(function* (view) {
  const on = createSignal(0);
  const noteOn = createSignal(1);
  const noteX = createSignal(0);
  const notePulse = createSignal(0);
  const noteSquash = createSignal(0);
  const hitA = createSignal(0);
  const hitB = createSignal(0);
  const hitC = createSignal(0);
  const hitD = createSignal(0);

  const yTop = -430;
  const yBottom = 410;
  const wTop = 300;
  const wBottom = 1050;
  const hitY = 320;

  const laneX = (lane: number, y: number) => {
    const t = (y - yTop) / (yBottom - yTop);
    const w = wTop + (wBottom - wTop) * Math.max(0, Math.min(1, t));
    return -w / 2 + (lane / 4) * w;
  };
  const depth = (y: number) => Math.max(0, Math.min(1, (y - yTop) / (yBottom - yTop)));
  const noteWAt = (y: number) => 20 + depth(y) * 44;
  const noteHAt = (y: number) => noteWAt(y) * 0.56; // lying in fretboard plane
  const labelGapAt = (y: number) => 9 + depth(y) * 6;
  const labelXAt = (lane: number, y: number, methodName: string) =>
    laneX(lane, y) - noteWAt(y) * 0.66 - labelGapAt(y);
  const labelScaleXAt = (y: number) => 1.14 + depth(y) * 0.1;
  const labelScaleYAt = (y: number) => 0.68 + depth(y) * 0.08;
  // Match text slant with the local string direction.
  const labelSkewByLane = (lane: number, y: number) => {
    const sample = 42;
    const y0 = Math.max(yTop, y - sample);
    const y1 = Math.min(yBottom, y + sample);
    const dx = laneX(lane, y1) - laneX(lane, y0);
    const dy = y1 - y0 || 1;
    return ((Math.atan2(dx, dy) * 180) / Math.PI) * 0.55;
  };
  const nAY = createSignal(yTop);
  const nBY = createSignal(yTop);
  const nCY = createSignal(yTop);
  const nDY = createSignal(yTop);
  const nAOn = createSignal(0);
  const nBOn = createSignal(0);
  const nCOn = createSignal(0);
  const nDOn = createSignal(0);
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

  const laneA = 0;
  const laneB = 1;
  const laneC = 3;
  const laneD = 2;
  const noteBaseW = 76;
  const laneColor = (lane: number) => STRINGS[Math.max(0, Math.min(4, lane))];
  const methodA = 'prepareAndEncode';
  const methodB = 'encodeWithRetry';
  const methodC = 'encode';
  const methodD = 'finalizeExport';

  noteX(laneX(laneA, hitY));

  view.add(
    <>
      <Rect width={Screen.width} height={Screen.height} fill={BG} opacity={on} />
      <Rect width={Screen.width} height={Screen.height} fill={'rgba(255,255,255,0.03)'} opacity={() => on() * 0.8} />

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
              opacity={() => on() * alpha}
            />
          );
        }),
      )}
      {[0, 1, 2, 3, 4].map(i => (
        <Line
          points={[
            [laneX(i, yTop), yTop],
            [laneX(i, yBottom), yBottom],
          ]}
          stroke={STRINGS[i]}
          lineWidth={8}
          lineCap={'round'}
          opacity={() =>
            (i === 0 ? g0() : i === 1 ? g1() : i === 2 ? g2() : i === 3 ? g3() : g4()) * 0.55
          }
        />
      ))}
      {/* Shockwave along the hit string */}
      {[0, 1, 2, 3, 4].map(i => (
        <Line
          points={() => {
            const p = i === 0 ? s0() : i === 1 ? s1() : i === 2 ? s2() : i === 3 ? s3() : s4();
            const span = 8 + p * 115;
            const y0s = hitY - span;
            const y1s = hitY + span;
            return [
              [laneX(i, y0s), y0s],
              [laneX(i, y1s), y1s],
            ];
          }}
          stroke={STRINGS[i]}
          lineWidth={() => 2 + (i === 0 ? s0() : i === 1 ? s1() : i === 2 ? s2() : i === 3 ? s3() : s4()) * 5}
          lineCap={'round'}
          opacity={() => (i === 0 ? s0() : i === 1 ? s1() : i === 2 ? s2() : i === 3 ? s3() : s4()) * 0.95}
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
            opacity={on}
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
        opacity={on}
      />
      <Line
        points={[
          [laneX(0, hitY) - 55, hitY],
          [laneX(4, hitY) + 55, hitY],
        ]}
        stroke={'rgba(252,251,248,0.82)'}
        lineWidth={2}
        opacity={on}
      />

      {/* Method labels (left), lying in fretboard plane */}
      <Txt
        x={() => labelXAt(laneA, nAY(), methodA)}
        y={nAY}
        text={methodA}
        fontSize={() => 32 + depth(nAY()) * 20}
        textAlign={'right'}
        offset={[1, 0]}
        letterSpacing={0.7}
        skewX={() => labelSkewByLane(laneA, nAY())}
        fill={laneColor(laneA)}
        scaleX={() => labelScaleXAt(nAY())}
        scaleY={() => labelScaleYAt(nAY())}
        shadowColor={'rgba(121,182,71,0.22)'}
        shadowBlur={5}
        opacity={() => on() * nAOn() * 0.9}
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
        opacity={() => on() * nAOn()}
      />
      <Txt
        x={() => labelXAt(laneB, nBY(), methodB)}
        y={nBY}
        text={methodB}
        fontSize={() => 32 + depth(nBY()) * 20}
        textAlign={'right'}
        offset={[1, 0]}
        letterSpacing={0.7}
        skewX={() => labelSkewByLane(laneB, nBY())}
        fill={laneColor(laneB)}
        scaleX={() => labelScaleXAt(nBY())}
        scaleY={() => labelScaleYAt(nBY())}
        shadowColor={'rgba(228,85,78,0.22)'}
        shadowBlur={5}
        opacity={() => on() * nBOn() * 0.9}
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
        opacity={() => on() * nBOn()}
      />
      <Txt
        x={() => labelXAt(laneC, nCY(), methodC)}
        y={nCY}
        text={methodC}
        fontSize={() => 32 + depth(nCY()) * 20}
        textAlign={'right'}
        offset={[1, 0]}
        letterSpacing={0.7}
        skewX={() => labelSkewByLane(laneC, nCY())}
        fill={laneColor(laneC)}
        scaleX={() => labelScaleXAt(nCY())}
        scaleY={() => labelScaleYAt(nCY())}
        shadowColor={'rgba(77,167,227,0.22)'}
        shadowBlur={5}
        opacity={() => on() * nCOn() * 0.9}
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
        opacity={() => on() * nCOn()}
      />
      <Txt
        x={() => labelXAt(laneD, nDY(), methodD)}
        y={nDY}
        text={methodD}
        fontSize={() => 32 + depth(nDY()) * 20}
        textAlign={'right'}
        offset={[1, 0]}
        letterSpacing={0.7}
        skewX={() => labelSkewByLane(laneD, nDY())}
        fill={laneColor(laneD)}
        scaleX={() => labelScaleXAt(nDY())}
        scaleY={() => labelScaleYAt(nDY())}
        shadowColor={'rgba(230,199,70,0.22)'}
        shadowBlur={5}
        opacity={() => on() * nDOn() * 0.9}
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
        opacity={() => on() * nDOn()}
      />

      {/* Contact pulses when method circles touch the pink argument */}
      <Circle
        x={noteX}
        y={hitY}
        width={() => noteBaseW * 1.55 + notePulse() * 58}
        height={() => (noteBaseW * 1.55 + notePulse() * 58) * 0.58}
        fill={'rgba(255,140,163,0.26)'}
        opacity={() => noteOn() * (0.42 + notePulse() * 0.25)}
      />
      <Circle
        x={noteX}
        y={hitY}
        width={() => noteBaseW + notePulse() * 34 + noteSquash() * 16}
        height={() => (noteBaseW + notePulse() * 34 - noteSquash() * 10) * 0.56}
        fill={PINK}
        stroke={'rgba(255,220,228,0.72)'}
        lineWidth={2.4}
        opacity={noteOn}
      />
      <Circle
        x={noteX}
        y={() => hitY - 2}
        width={() => noteBaseW * 0.62 + notePulse() * 16}
        height={() => (noteBaseW * 0.62 + notePulse() * 16) * 0.52}
        fill={'rgba(255,188,201,0.72)'}
        opacity={() => noteOn() * 0.78}
      />
      <Circle x={noteX} y={hitY} width={() => 56 + hitA() * 58} height={() => (56 + hitA() * 58) * 0.56} stroke={PINK} lineWidth={3} fill={'rgba(0,0,0,0)'} opacity={() => hitA() * 0.85} />
      <Circle x={noteX} y={hitY} width={() => 56 + hitB() * 58} height={() => (56 + hitB() * 58) * 0.56} stroke={PINK} lineWidth={3} fill={'rgba(0,0,0,0)'} opacity={() => hitB() * 0.85} />
      <Circle x={noteX} y={hitY} width={() => 56 + hitC() * 58} height={() => (56 + hitC() * 58) * 0.56} stroke={PINK} lineWidth={3} fill={'rgba(0,0,0,0)'} opacity={() => hitC() * 0.85} />
      <Circle x={noteX} y={hitY} width={() => 56 + hitD() * 64} height={() => (56 + hitD() * 64) * 0.56} stroke={PINK} lineWidth={3} fill={'rgba(0,0,0,0)'} opacity={() => hitD() * 0.9} />
    </>,
  );

  const playNote = function* (
    lane: number,
    noteY: ReturnType<typeof createSignal<number>>,
    noteVisible: ReturnType<typeof createSignal<number>>,
    hit: ReturnType<typeof createSignal<number>>,
    glow: ReturnType<typeof createSignal<number>>,
    shock: ReturnType<typeof createSignal<number>>,
  ) {
    const travel = 0.52;
    noteY(yTop);
    noteVisible(1);
    // Pink marker starts moving early, while note is still far.
    yield* all(
      noteY(hitY, travel, linear),
      noteX(laneX(lane, hitY), travel * 0.45, linear),
    );
    yield* all(hit(1, 0.10), notePulse(1.15, 0.10), noteSquash(1, 0.09), glow(1, 0.10), shock(1, 0.08));
    yield* all(
      hit(0, 0.22),
      notePulse(0, 0.16),
      noteSquash(0, 0.12),
      glow(0, 0.20),
      shock(0, 0.20),
      noteVisible(0, 0.14), // disappear right after hit
    );
  };

  yield* on(1, 0.55, easeInOutCubic);
  yield* noteOn(1, 0.2, easeInOutCubic);

  yield* noteX(laneX(laneA, hitY), 0.06, linear);
  yield* playNote(laneA, nAY, nAOn, hitA, g0, s0);
  yield* playNote(laneB, nBY, nBOn, hitB, g1, s1);
  yield* playNote(laneC, nCY, nCOn, hitC, g3, s3);
  yield* playNote(laneD, nDY, nDOn, hitD, g2, s2);
  // Extend sequence while keeping each approach fast.
  yield* playNote(laneB, nBY, nBOn, hitB, g1, s1);
  yield* playNote(laneD, nDY, nDOn, hitD, g2, s2);
  yield* playNote(laneC, nCY, nCOn, hitC, g3, s3);

  yield* waitFor(1.2);
});

