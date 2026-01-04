import type {SyntaxTheme} from './SyntaxTheme';
import {OpenDarkStyle} from '../../openDarkStyle';

export const OpenDarkCodeTheme: SyntaxTheme = {
  plain: OpenDarkStyle.colors.ink,
  punctuation: 'rgba(233,226,216,0.45)',
  operator: 'rgba(233,226,216,0.60)',
  comment: 'rgba(140,133,125,0.70)',
  keyword: OpenDarkStyle.colors.ink,
  type: OpenDarkStyle.colors.blue,
  method: OpenDarkStyle.colors.ink,
  annotation: OpenDarkStyle.colors.ink,
  constant: OpenDarkStyle.colors.ink,
  string: OpenDarkStyle.colors.ink,
  number: OpenDarkStyle.colors.ink,
};


