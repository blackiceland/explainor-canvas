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
const ROSE = '#C48A92';

export default buildDuplicationScene({
    BG:     '#17181D',
    INK:    '#DAD4CA',
    KEY:    '#8FAAC3',
    DOMAIN: ROSE,
    CALL:   ROSE,
    STRING: '#ADB49B',
    PROP:   '#A0AAB2',
    PARAM:  '#DAD4CA',
    PUNC:   '#AAA59D',
    OPERATOR: '#AAA59D',
    PUNCH:  '#D6A06F',
    HERO:   '#A9C6E8',
    QUIET:  'rgba(218, 212, 202, 0.45)',
});
