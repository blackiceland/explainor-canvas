import {buildDuplicationScene} from './_duplicationShared';

// Paper at dusk. Warm earth ground, three accents that walk a tight
// arc across the warm half (tan → olive → peach). The olive DOMAIN
// is the only hue-shifted breath in an otherwise monochromatic warm
// palette — it's what keeps the scene from collapsing into one tone.
export default buildDuplicationScene({
    BG:     '#1F1810', // warm dark earth
    INK:    '#F2E8D5', // warm cream body
    KEY:    '#D4B57A', // warm honey gold — keywords
    DOMAIN: '#9EA67A', // warm olive      — function defs + strings
    PUNCH:  '#E8B594', // warm peach      — italic "bad."
    HERO:   '#D4B57A', // gold for frame + hero
    QUIET:  '#7B7160',
});
