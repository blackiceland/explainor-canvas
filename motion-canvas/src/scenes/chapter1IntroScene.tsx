import {makeScene2D} from '@motion-canvas/2d';
import {playTitleCard} from '../core/templates/TitleCard';
import {applyBackground} from '../core/utils';

export default makeScene2D(function* (view) {
  applyBackground(view);

  yield* playTitleCard(view, {
    lines: ['CHAPTER 1', 'COMMONCONDITIONS', 'TRAP'],
    fill: '#F6E7D4',
    align: 'left',
    fontWeight: 700,
    marginX: 110,
    marginY: 120,
    leftBias: 70,
    baseSize: 240,
    lineHeightFactor: 0.94,
    letterSpacingFactor: 0.03,
    fadeIn: 0.8,
    hold: 1.4,
    fadeOut: 0.8,
  });
});


