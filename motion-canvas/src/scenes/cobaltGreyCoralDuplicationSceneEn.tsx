import {buildDuplicationScene} from './_duplicationShared';

// Cobalt-grey base — EXPERIMENT 3, v4 (second review pass).
// Headline blue and code keyword blue split into one family, two ranks:
// headline cleaner and lighter, code keyword tighter and greyer, so
// they relate without speaking in unison. Method rose nudged a hair
// dustier. "bad." accent pulled out of bright peach into a dustier
// champagne so it stops living in its own temperature class.
//
//   HEADLINE clean cobalt    — editorial title (top of frame)
//   KEY      grey-ice blue   — code keywords (related to HEADLINE, tighter)
//   METHOD   dusty rose      — function defs AND call sites
//   STRING   olive bone      — string literals
//   BODY     warm off-white  — INK / PARAM (lifted ~6 %)
//   PROP     quiet grey-blue — .phone, near-neutral, NOT an accent
//   PUNC     cool grey       — brackets / commas / operators
//   PUNCH    champagne       — italic "bad." (dustier than peach)
const ROSE = '#C58993';

export default buildDuplicationScene({
    BG:     '#1B1B1F',
    INK:    '#E2DDD3',                    // warm off-white base — lifted ~6 %
    KEY:    '#8FAAC3',                    // code keyword — tighter, greyer
    DOMAIN: ROSE,
    CALL:   ROSE,
    STRING: '#A7B59A',                    // olive bone
    PROP:   '#A0AAB2',                    // very quiet grey-blue — almost neutral
    PARAM:  '#E2DDD3',                    // base lifted — user / cart / …
    PUNC:   '#A7A29A',                    // cool grey
    OPERATOR: '#A7A29A',
    PUNCH:  '#D6A06F',                    // champagne — italic "bad."
    HERO:   '#A9C6E8',                    // headline cobalt — cleaner than code KEY
    QUIET:  'rgba(215, 209, 200, 0.45)',
});
