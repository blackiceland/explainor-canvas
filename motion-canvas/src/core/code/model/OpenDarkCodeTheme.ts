import type {SyntaxTheme} from './SyntaxTheme';
import {OpenDarkStyle} from '../../openDarkStyle';

export const OpenDarkCodeTheme: SyntaxTheme = {
  keyword: OpenDarkStyle.colors.blue,
  type: OpenDarkStyle.colors.blue,
  string: OpenDarkStyle.colors.rose,
  number: OpenDarkStyle.colors.rose,
  operator: OpenDarkStyle.colors.ink,
  punctuation: 'rgba(233,226,216,0.62)',
  method: OpenDarkStyle.colors.ink,
  comment: 'rgba(140,133,125,0.72)',
  annotation: OpenDarkStyle.colors.blue,
  constant: OpenDarkStyle.colors.ink,
  plain: OpenDarkStyle.colors.ink,
};


