import {Circle, Line, makeScene2D, Rect} from '@motion-canvas/2d';
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
  const nAY = createSignal(yTop);
  const nBY = createSignal(yTop);
  const nCY = createSignal(yTop);
  const nDY = createSignal(yTop);
  const nAOn = createSignal(0);
  const nBOn = createSignal(0);
  const nCOn = createSignal(0);
  const nDOn = createSignal(0);

  const laneA = 0;
  const laneB = 1;
  const laneC = 3;
  const laneD = 2;
  const noteBaseW = 76;

  noteX(laneX(laneA, hitY));

  view.add(
    <>
      <Rect width={Screen.width} height={Screen.height} fill={BG} opacity={on} />
      <Rect width={Screen.width} height={Screen.height} fill={'rgba(255,255,255,0.03)'} opacity={() => on() * 0.8} />

      {[0, 1, 2, 3, 4].map(i => (
        <Line
          points={[
            [laneX(i, yTop), yTop],
            [laneX(i, yBottom), yBottom],
          ]}
          stroke={STRINGS[i]}
          lineWidth={3}
          lineCap={'round'}
          opacity={() => on() * 0.92}
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
        stroke={'rgba(244,241,235,0.40)'}
        lineWidth={4}
        opacity={on}
      />

      {/* Method notes moving in fretboard plane */}
      <Circle
        x={() => laneX(laneA, nAY())}
        y={nAY}
        width={() => noteWAt(nAY())}
        height={() => noteHAt(nAY())}
        fill={'rgba(18,18,18,0.82)'}
        stroke={'rgba(244,241,235,0.78)'}
        lineWidth={() => 1.4 + depth(nAY()) * 2}
        opacity={() => on() * nAOn()}
      />
      <Circle
        x={() => laneX(laneB, nBY())}
        y={nBY}
        width={() => noteWAt(nBY())}
        height={() => noteHAt(nBY())}
        fill={'rgba(18,18,18,0.82)'}
        stroke={'rgba(244,241,235,0.78)'}
        lineWidth={() => 1.4 + depth(nBY()) * 2}
        opacity={() => on() * nBOn()}
      />
      <Circle
        x={() => laneX(laneC, nCY())}
        y={nCY}
        width={() => noteWAt(nCY())}
        height={() => noteHAt(nCY())}
        fill={'rgba(18,18,18,0.82)'}
        stroke={'rgba(244,241,235,0.78)'}
        lineWidth={() => 1.4 + depth(nCY()) * 2}
        opacity={() => on() * nCOn()}
      />
      <Circle
        x={() => laneX(laneD, nDY())}
        y={nDY}
        width={() => noteWAt(nDY())}
        height={() => noteHAt(nDY())}
        fill={'rgba(18,18,18,0.82)'}
        stroke={'rgba(244,241,235,0.78)'}
        lineWidth={() => 1.4 + depth(nDY()) * 2}
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
      <Circle
        x={() => noteX() - noteBaseW * 0.20}
        y={() => hitY - noteBaseW * 0.11}
        width={() => 12 + notePulse() * 4}
        height={() => 8 + notePulse() * 3}
        fill={'rgba(255,245,248,0.85)'}
        opacity={() => noteOn() * 0.72}
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
  ) {
    const travel = 0.95;
    noteY(yTop);
    noteVisible(1);
    // Pink marker starts moving early, while note is still far.
    yield* all(
      noteY(hitY, travel, linear),
      noteX(laneX(lane, hitY), travel * 0.72, linear),
    );
    yield* all(hit(1, 0.11), notePulse(1, 0.11), noteSquash(1, 0.10));
    yield* all(
      hit(0, 0.28),
      notePulse(0, 0.20),
      noteSquash(0, 0.16),
      noteVisible(0, 0.18), // disappear right after hit
    );
  };

  yield* on(1, 0.55, easeInOutCubic);
  yield* noteOn(1, 0.2, easeInOutCubic);

  yield* noteX(laneX(laneA, hitY), 0.08, linear);
  yield* playNote(laneA, nAY, nAOn, hitA);
  yield* playNote(laneB, nBY, nBOn, hitB);
  yield* playNote(laneC, nCY, nCOn, hitC);
  yield* playNote(laneD, nDY, nDOn, hitD);

  yield* waitFor(0.8);
});

