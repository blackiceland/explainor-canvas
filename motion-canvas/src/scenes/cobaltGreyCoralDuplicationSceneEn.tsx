import {buildDuplicationScene} from './_duplicationShared';

// Cobalt-grey base — EXPERIMENT 3, v5 (art-direction pass).
// Targeted at "expensive coherence", not brighter colours. BG cooled
// a notch. Code base pulled back from the over-lift so it sits as
// neutral mass, not as a glow. Strings shifted further from green into
// sage-beige so they stop living their own life. Punctuation a hair
// warmer/lighter so it reads as quiet system, not faded ink. Pink
// nudged one click for nobility. "bad." and headline cobalt unchanged.
//
//   HEADLINE clean cobalt    — editorial title
//   PUNCH    champagne       — italic "bad." (single warm accent)
//   KEY      grey-ice blue   — code keywords (system cool)
//   METHOD   noble rose      — function defs AND call sites
//   STRING   sage-beige      — string literals (quietened)
//   BODY     light bone      — INK / PARAM (neutral mass)
//   PROP     quiet grey-blue — .phone, near-neutral
//   PUNC     warm grey       — brackets / commas / operators
const ROSE = '#F6A5B1';

export default buildDuplicationScene({
    BG:     '#17181D',
    INK:    '#FFFFFC',
    KEY:    '#C6E1FF',
    DOMAIN: ROSE,
    CALL:   ROSE,
    STRING: '#A8BAA0',
    PROP:   '#ACB6BC',
    PARAM:  '#FFFFFC',
    PUNC:   '#AAA59D',
    OPERATOR: '#AAA59D',
    PUNCH:  '#D6A06F',
    HERO:   '#A9C6E8',
    QUIET:  'rgba(237, 238, 232, 0.45)',
});
